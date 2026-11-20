package com.smartbeam.app.nativemods

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.FileOutputStream
import android.graphics.Bitmap

class PdfModule(private val rc: ReactApplicationContext) : ReactContextBaseJavaModule(rc) {
    override fun getName() = "SmartBeamPdf"

    @ReactMethod
    fun pageCount(path: String, promise: Promise) {
        Thread {
            try { promise.resolve(PdfUtil.pageCount(path)) }
            catch (e: Exception) { promise.reject("PDF_OPEN_FAILED", e.message ?: "Could not open PDF", e) }
        }.start()
    }

    /** Renders a page (0-based) to a cached PNG and returns its absolute path. */
    @ReactMethod
    fun renderThumbnail(path: String, index: Int, width: Int, promise: Promise) {
        Thread {
            try {
                val src = File(path)
                val dir = File(rc.cacheDir, "thumbs").apply { mkdirs() }
                val key = "${src.name.hashCode()}_${src.lastModified()}_${index}_$width.png"
                val out = File(dir, key)
                if (!out.exists()) {
                    val bmp = PdfUtil.render(path, index, width, width * 4)
                    FileOutputStream(out).use { bmp.compress(Bitmap.CompressFormat.PNG, 90, it) }
                    bmp.recycle()
                }
                promise.resolve(out.absolutePath)
            } catch (e: Exception) {
                promise.reject("PDF_RENDER_FAILED", e.message ?: "Could not render page", e)
            }
        }.start()
    }
}
