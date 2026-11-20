package com.smartbeam.app.nativemods

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import java.io.File

/** Small helper around the platform PdfRenderer (memory-efficient: one page rendered at a time). */
object PdfUtil {
    private fun <T> withRenderer(path: String, block: (PdfRenderer) -> T): T {
        val pfd = ParcelFileDescriptor.open(File(path), ParcelFileDescriptor.MODE_READ_ONLY)
        val renderer = PdfRenderer(pfd)
        try {
            return block(renderer)
        } finally {
            renderer.close()
            pfd.close()
        }
    }

    fun pageCount(path: String): Int = withRenderer(path) { it.pageCount }

    @Synchronized
    fun render(path: String, index: Int, maxW: Int, maxH: Int): Bitmap = withRenderer(path) { r ->
        require(index in 0 until r.pageCount) { "Page $index is out of range (0..${r.pageCount - 1})" }
        val page = r.openPage(index)
        try {
            val scale = minOf(maxW.toFloat() / page.width, maxH.toFloat() / page.height)
            val w = (page.width * scale).toInt().coerceAtLeast(1)
            val h = (page.height * scale).toInt().coerceAtLeast(1)
            val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
            bmp.eraseColor(Color.WHITE)
            page.render(bmp, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
            bmp
        } finally {
            page.close()
        }
    }
}
