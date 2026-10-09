package lk.edulanka.offline_video_spike

import android.net.Uri
import androidx.media3.common.C
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.TransferListener
import java.io.File
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec
import kotlin.math.min

/**
 * Native Android Media3 / ExoPlayer DataSource using Chunked AES-GCM (Tink Streaming AEAD format).
 *
 * Each chunk consists of up to [chunkSizeBytes] plaintext bytes encrypted with AES/GCM/NoPadding,
 * appended with a 16-byte (128-bit) GCM authentication tag.
 *
 * Random-Access Seeking:
 * - Chunk Index = `position / chunkSizeBytes`.
 * - In-Chunk Offset = `position % chunkSizeBytes`.
 * - File Offset = `chunkIndex * (chunkSizeBytes + TAG_SIZE)`.
 * - Nonce derivation incorporates the chunk index into the base nonce, ensuring unique nonces per segment.
 * - Memory is strictly bounded to the decrypted chunk size (<= 64 KB).
 */
class ChunkedGcmEncryptedDataSource(
    private val key: ByteArray,
    private val baseNonce: ByteArray,
    private val chunkSizeBytes: Int = 64 * 1024
) : DataSource {

    companion object {
        const val TAG_SIZE_BYTES = 16
    }

    private var file: RandomAccessFile? = null
    private var uri: Uri? = null
    private var totalPlaintextLength: Long = 0
    private var currentPosition: Long = 0
    private var bytesRemaining: Long = 0

    // Cache of the single most recent decrypted chunk (64KB max)
    private var cachedChunkIndex: Long = -1
    private var cachedDecryptedChunk: ByteArray? = null

    class Factory(
        private val key: ByteArray,
        private val baseNonce: ByteArray,
        private val chunkSizeBytes: Int = 64 * 1024
    ) : DataSource.Factory {
        override fun createDataSource(): DataSource {
            return ChunkedGcmEncryptedDataSource(key, baseNonce, chunkSizeBytes)
        }
    }

    override fun addTransferListener(transferListener: TransferListener) {
        // TransferListener for playback profiling / metrics
    }

    override fun open(dataSpec: DataSpec): Long {
        this.uri = dataSpec.uri
        val path = dataSpec.uri.path ?: throw IllegalArgumentException("Uri path is null")
        val localFile = File(path)
        val raf = RandomAccessFile(localFile, "r")
        this.file = raf

        val totalEncryptedLength = raf.length()
        val storedChunkSize = (chunkSizeBytes + TAG_SIZE_BYTES).toLong()
        val numFullChunks = totalEncryptedLength / storedChunkSize
        val remainder = totalEncryptedLength % storedChunkSize
        val lastChunkPlaintext = if (remainder > TAG_SIZE_BYTES) remainder - TAG_SIZE_BYTES else 0L

        this.totalPlaintextLength = (numFullChunks * chunkSizeBytes) + lastChunkPlaintext
        this.currentPosition = dataSpec.position

        this.bytesRemaining = if (dataSpec.length != C.LENGTH_UNSET.toLong()) {
            dataSpec.length
        } else {
            totalPlaintextLength - dataSpec.position
        }

        cachedChunkIndex = -1
        cachedDecryptedChunk = null

        return bytesRemaining
    }

    override fun read(buffer: ByteArray, offset: Int, length: Int): Int {
        if (length == 0) return 0
        if (bytesRemaining <= 0) return C.RESULT_END_OF_INPUT

        val raf = file ?: return C.RESULT_END_OF_INPUT
        val bytesToRead = min(length.toLong(), bytesRemaining).toInt()

        val chunkIndex = currentPosition / chunkSizeBytes
        val inChunkOffset = (currentPosition % chunkSizeBytes).toInt()

        // Ensure current chunk is decrypted in cache
        if (chunkIndex != cachedChunkIndex || cachedDecryptedChunk == null) {
            val decrypted = decryptChunk(raf, chunkIndex)
            cachedChunkIndex = chunkIndex
            cachedDecryptedChunk = decrypted
        }

        val decrypted = cachedDecryptedChunk ?: return C.RESULT_END_OF_INPUT
        val availableInChunk = decrypted.size - inChunkOffset
        if (availableInChunk <= 0) return C.RESULT_END_OF_INPUT

        val bytesFromThisChunk = min(bytesToRead, availableInChunk)
        System.arraycopy(decrypted, inChunkOffset, buffer, offset, bytesFromThisChunk)

        currentPosition += bytesFromThisChunk
        bytesRemaining -= bytesFromThisChunk
        return bytesFromThisChunk
    }

    private fun decryptChunk(raf: RandomAccessFile, chunkIndex: Long): ByteArray {
        val storedChunkSize = chunkSizeBytes + TAG_SIZE_BYTES
        val fileOffset = chunkIndex * storedChunkSize

        val totalFileLength = raf.length()
        val bytesAvailable = (totalFileLength - fileOffset).toInt()
        val encryptedLength = min(storedChunkSize, bytesAvailable)

        if (encryptedLength <= TAG_SIZE_BYTES) {
            return ByteArray(0)
        }

        val encryptedBytes = ByteArray(encryptedLength)
        synchronized(raf) {
            raf.seek(fileOffset)
            raf.readFully(encryptedBytes)
        }

        // Derive unique chunk nonce by combining baseNonce with chunkIndex
        val isLast = (fileOffset + encryptedLength >= totalFileLength)
        val chunkNonce = deriveChunkNonce(baseNonce, chunkIndex)
        val secretKey = SecretKeySpec(key, "AES")
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, secretKey, GCMParameterSpec(128, chunkNonce))
        cipher.updateAAD(if (isLast) byteArrayOf(1) else byteArrayOf(0))

        return cipher.doFinal(encryptedBytes)
    }

    private fun deriveChunkNonce(base: ByteArray, index: Long): ByteArray {
        val nonce = base.clone()
        val buffer = ByteBuffer.wrap(nonce)
        // Add chunk index to the last 4 bytes of 12-byte nonce
        if (nonce.size >= 12) {
            val original = buffer.getInt(8)
            buffer.putInt(8, original + index.toInt())
        }
        return nonce
    }

    override fun getUri(): Uri? = uri

    override fun close() {
        try {
            file?.close()
        } finally {
            file = null
            cachedDecryptedChunk = null
            cachedChunkIndex = -1
            bytesRemaining = 0
        }
    }
}
