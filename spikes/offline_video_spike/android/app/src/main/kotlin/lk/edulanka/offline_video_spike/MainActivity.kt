package lk.edulanka.offline_video_spike

import android.app.ActivityManager
import android.content.Context
import android.os.Build
import androidx.media3.datasource.DataSpec
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File

class MainActivity : FlutterActivity() {
    private val CHANNEL = "lk.edulanka.offline_video_spike/exoplayer"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
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

                    val res = mapOf(
                        "totalRamGb" to totalRamGb,
                        "availRamGb" to availRamGb,
                        "isLowRam" to memInfo.lowMemory,
                        "osVersion" to "Android ${Build.VERSION.RELEASE} (SDK ${Build.VERSION.SDK_INT})",
                        "model" to "${Build.MANUFACTURER} ${Build.MODEL}"
                    )
                    result.success(res)
                }
                "verifyNativeGcmDecryption" -> {
                    try {
                        val filePath = call.argument<String>("filePath") ?: throw IllegalArgumentException("Missing filePath")
                        val key = call.argument<ByteArray>("key") ?: throw IllegalArgumentException("Missing key")
                        val nonce = call.argument<ByteArray>("nonce") ?: throw IllegalArgumentException("Missing nonce")

                        val dataSource = ChunkedGcmEncryptedDataSource(key, nonce)
                        val dataSpec = DataSpec(android.net.Uri.fromFile(File(filePath)))
                        val bytesTotal = dataSource.open(dataSpec)

                        val sampleBuffer = ByteArray(minOf(1024, bytesTotal.toInt()))
                        val bytesRead = dataSource.read(sampleBuffer, 0, sampleBuffer.size)
                        dataSource.close()

                        result.success(mapOf(
                            "success" to true,
                            "bytesTotal" to bytesTotal,
                            "bytesSampleRead" to bytesRead
                        ))
                    } catch (e: Exception) {
                        result.error("DECRYPTION_ERROR", e.message, null)
                    }
                }
                else -> {
                    result.notImplemented()
                }
            }
        }
    }
}
