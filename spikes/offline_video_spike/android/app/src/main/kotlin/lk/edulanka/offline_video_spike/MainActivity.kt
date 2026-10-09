package lk.edulanka.offline_video_spike

import android.app.ActivityManager
import android.content.Context
import android.os.Build
import android.view.Surface
import androidx.media3.common.MediaItem
import androidx.media3.datasource.DataSpec
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.ProgressiveMediaSource
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import io.flutter.view.TextureRegistry
import java.io.File

class MainActivity : FlutterActivity() {
    private val CHANNEL = "lk.edulanka.offline_video_spike/exoplayer"

    private var exoPlayer: ExoPlayer? = null
    private var surfaceTextureEntry: TextureRegistry.SurfaceTextureEntry? = null
    private var surface: Surface? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler {
                call,
                result ->
            when (call.method) {
                "isExoPlayerAvailable" -> {
                    result.success(true)
                }
                "getHardwareMemoryInfo" -> {
                    val actManager = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
                    val memInfo = ActivityManager.MemoryInfo()
                    actManager.getMemoryInfo(memInfo)
                    val totalRamGb = memInfo.totalMem.toDouble() / (1024.0 * 1024.0 * 1024.0)
                    val availRamGb = memInfo.availMem.toDouble() / (1024.0 * 1024.0 * 1024.0)

                    val res =
                            mapOf(
                                    "totalRamGb" to totalRamGb,
                                    "availRamGb" to availRamGb,
                                    "isLowRam" to memInfo.lowMemory,
                                    "osVersion" to
                                            "Android ${Build.VERSION.RELEASE} (SDK ${Build.VERSION.SDK_INT})",
                                    "model" to "${Build.MANUFACTURER} ${Build.MODEL}"
                            )
                    result.success(res)
                }
                "verifyNativeGcmDecryption" -> {
                    try {
                        val filePath =
                                call.argument<String>("filePath")
                                        ?: throw IllegalArgumentException("Missing filePath")
                        val key =
                                call.argument<ByteArray>("key")
                                        ?: throw IllegalArgumentException("Missing key")
                        val nonce =
                                call.argument<ByteArray>("nonce")
                                        ?: throw IllegalArgumentException("Missing nonce")

                        val dataSource = ChunkedGcmEncryptedDataSource(key, nonce)
                        val dataSpec = DataSpec(android.net.Uri.fromFile(File(filePath)))
                        val bytesTotal = dataSource.open(dataSpec)

                        val sampleBuffer = ByteArray(minOf(1024, bytesTotal.toInt()))
                        val bytesRead = dataSource.read(sampleBuffer, 0, sampleBuffer.size)
                        dataSource.close()

                        result.success(
                                mapOf(
                                        "success" to true,
                                        "bytesTotal" to bytesTotal,
                                        "bytesSampleRead" to bytesRead
                                )
                        )
                    } catch (e: Exception) {
                        result.error("DECRYPTION_ERROR", e.message, null)
                    }
                }
                "createPlayer" -> {
                    try {
                        val filePath =
                                call.argument<String>("filePath")
                                        ?: throw IllegalArgumentException("Missing filePath")
                        val key =
                                call.argument<ByteArray>("key")
                                        ?: throw IllegalArgumentException("Missing key")
                        val nonce =
                                call.argument<ByteArray>("nonce")
                                        ?: throw IllegalArgumentException("Missing nonce")

                        releasePlayerInternal()

                        val entry = flutterEngine.renderer.createSurfaceTexture()
                        surfaceTextureEntry = entry
                        val surf = Surface(entry.surfaceTexture())
                        surface = surf

                        val player = ExoPlayer.Builder(this).build()
                        player.setVideoSurface(surf)

                        val dataSourceFactory = ChunkedGcmEncryptedDataSource.Factory(key, nonce)
                        val mediaSource =
                                ProgressiveMediaSource.Factory(dataSourceFactory)
                                        .createMediaSource(
                                                MediaItem.fromUri(
                                                        android.net.Uri.fromFile(File(filePath))
                                                )
                                        )

                        player.setMediaSource(mediaSource)
                        player.prepare()
                        exoPlayer = player

                        result.success(mapOf("textureId" to entry.id()))
                    } catch (e: Exception) {
                        result.error("PLAYER_INIT_ERROR", e.message, null)
                    }
                }
                "play" -> {
                    exoPlayer?.play()
                    result.success(true)
                }
                "pause" -> {
                    exoPlayer?.pause()
                    result.success(true)
                }
                "seekTo" -> {
                    val positionMs = (call.argument<Number>("positionMs"))?.toLong() ?: 0L
                    exoPlayer?.seekTo(positionMs)
                    result.success(true)
                }
                "releasePlayer" -> {
                    releasePlayerInternal()
                    result.success(true)
                }
                else -> {
                    result.notImplemented()
                }
            }
        }
    }

    private fun releasePlayerInternal() {
        exoPlayer?.release()
        exoPlayer = null
        surface?.release()
        surface = null
        surfaceTextureEntry?.release()
        surfaceTextureEntry = null
    }

    override fun onDestroy() {
        releasePlayerInternal()
        super.onDestroy()
    }
}
