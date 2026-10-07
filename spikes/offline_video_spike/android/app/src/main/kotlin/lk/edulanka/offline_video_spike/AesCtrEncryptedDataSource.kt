package lk.edulanka.offline_video_spike

import android.net.Uri
import androidx.media3.common.C
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.TransferListener
import java.io.File
import java.io.RandomAccessFile
import java.math.BigInteger
import javax.crypto.Cipher
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec
import kotlin.math.min

/**
 * Native Android ExoPlayer DataSource using hardware-accelerated AES/CTR/NoPadding.
 *
 * Seeking Mechanism:
 * - AES block size is 16 bytes.
 * - Given an arbitrary byte seek position [position], the counter offset is calculated as `position / 16`.
 * - The base IV is incremented as a 128-bit big-endian integer by `position / 16`.
 * - If [position] does not fall on a 16-byte boundary, the remaining offset `position % 16`
 *   is discarded by consuming that many keystream bytes immediately after cipher initialization.
 * - This provides O(1) random-access seeking with minimal RAM overhead (~64KB read buffer).
 */
class AesCtrEncryptedDataSource(
    private val key: ByteArray,
    private val baseIv: ByteArray
) : DataSource {

    private var file: RandomAccessFile? = null
    private var uri: Uri? = null
    private var bytesRemaining: Long = 0
    private var currentPosition: Long = 0
    private var cipher: Cipher? = null

    class Factory(
        private val key: ByteArray,
        private val baseIv: ByteArray
    ) : DataSource.Factory {
        override fun createDataSource(): DataSource {
            return AesCtrEncryptedDataSource(key, baseIv)
        }
    }

    override fun addTransferListener(transferListener: TransferListener) {
        // Can be attached for bandwidth monitoring
    }

    override fun open(dataSpec: DataSpec): Long {
        this.uri = dataSpec.uri
        val path = dataSpec.uri.path ?: throw IllegalArgumentException("Uri path is null")
        val localFile = File(path)
        val raf = RandomAccessFile(localFile, "r")
        this.file = raf

        val fileLength = raf.length()
        this.currentPosition = dataSpec.position
        raf.seek(dataSpec.position)

        this.bytesRemaining = if (dataSpec.length != C.LENGTH_UNSET.toLong()) {
            dataSpec.length
        } else {
            fileLength - dataSpec.position
        }

        initCipherAtPosition(dataSpec.position)
        return bytesRemaining
    }

    /**
     * Initializes the AES/CTR/NoPadding cipher for random access at [position].
     * Counter block index = position / 16.
     * In-block offset = position % 16.
     */
    private fun initCipherAtPosition(position: Long) {
        val blockIndex = position / 16
        val blockOffset = (position % 16).toInt()

        val ivBigInt = BigInteger(1, baseIv)
        val offsetIvBigInt = ivBigInt.add(BigInteger.valueOf(blockIndex))
        val offsetIvBytes = offsetIvBigInt.toByteArray()

        val adjustedIv = ByteArray(16)
        if (offsetIvBytes.size > 16) {
            System.arraycopy(offsetIvBytes, offsetIvBytes.size - 16, adjustedIv, 0, 16)
        } else {
            System.arraycopy(offsetIvBytes, 0, adjustedIv, 16 - offsetIvBytes.size, offsetIvBytes.size)
        }

        val secretKey = SecretKeySpec(key, "AES")
        val newCipher = Cipher.getInstance("AES/CTR/NoPadding")
        newCipher.init(Cipher.DECRYPT_MODE, secretKey, IvParameterSpec(adjustedIv))

        // Discard partial block keystream bytes if seek is not 16-byte aligned
        if (blockOffset > 0) {
            val discardBuffer = ByteArray(blockOffset)
            newCipher.update(discardBuffer)
        }

        this.cipher = newCipher
    }

    override fun read(buffer: ByteArray, offset: Int, length: Int): Int {
        if (length == 0) return 0
        if (bytesRemaining == 0L) return C.RESULT_END_OF_INPUT

        val raf = file ?: return C.RESULT_END_OF_INPUT
        val bytesToRead = min(length.toLong(), bytesRemaining).toInt()
        val rawBuffer = ByteArray(bytesToRead)
        val bytesRead = raf.read(rawBuffer, 0, bytesToRead)

        if (bytesRead == -1) {
            return C.RESULT_END_OF_INPUT
        }

        val decrypted = cipher?.update(rawBuffer, 0, bytesRead) ?: rawBuffer
        System.arraycopy(decrypted, 0, buffer, offset, bytesRead)

        currentPosition += bytesRead
        bytesRemaining -= bytesRead
        return bytesRead
    }

    override fun getUri(): Uri? = uri

    override fun close() {
        try {
            file?.close()
        } finally {
            file = null
            cipher = null
            bytesRemaining = 0
        }
    }
}
