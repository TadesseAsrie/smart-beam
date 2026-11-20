package com.smartbeam.app.nativemods

import android.app.Presentation
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.media.MediaPlayer
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.DisplayMetrics
import android.view.Display
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.TextView
import android.widget.VideoView

/** Full-screen content shown on a secondary display. Contains no app UI. */
class SmartBeamPresentation(ctx: Context, display: Display) : Presentation(ctx, display) {
    private lateinit var root: FrameLayout
    private lateinit var image: ImageView
    private lateinit var video: VideoView
    private lateinit var black: View
    private lateinit var pointer: View
    private lateinit var badge: TextView
    private var player: MediaPlayer? = null
    private val ui = Handler(Looper.getMainLooper())
    private var renderToken = 0
    var onVideoProgress: ((Long, Long, Boolean) -> Unit)? = null

    private val ticker = object : Runnable {
        override fun run() {
            if (video.visibility == View.VISIBLE && player != null) {
                try { onVideoProgress?.invoke(video.currentPosition.toLong(), video.duration.toLong(), video.isPlaying) } catch (_: Exception) {}
            }
            ui.postDelayed(this, 1000)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window?.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        root = FrameLayout(context).apply { setBackgroundColor(Color.BLACK) }
        image = ImageView(context).apply { scaleType = ImageView.ScaleType.FIT_CENTER; visibility = View.GONE }
        video = VideoView(context).apply { visibility = View.GONE }
        black = View(context).apply { setBackgroundColor(Color.BLACK); visibility = View.GONE }
        pointer = View(context).apply {
            background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(Color.argb(200, 255, 40, 40)); setStroke(3, Color.WHITE) }
            visibility = View.GONE
        }
        badge = TextView(context).apply {
            text = "Paused"; setTextColor(Color.WHITE); textSize = 20f; setPadding(32, 16, 32, 16)
            background = GradientDrawable().apply { cornerRadius = 24f; setColor(Color.argb(170, 16, 27, 54)) }
            visibility = View.GONE
        }
        root.addView(image, FrameLayout.LayoutParams(-1, -1))
        root.addView(video, FrameLayout.LayoutParams(-1, -1, Gravity.CENTER))
        root.addView(pointer, FrameLayout.LayoutParams(40, 40))
        root.addView(badge, FrameLayout.LayoutParams(-2, -2, Gravity.TOP or Gravity.END).apply { setMargins(32, 32, 32, 32) })
        root.addView(black, FrameLayout.LayoutParams(-1, -1))
        setContentView(root)
        ui.postDelayed(ticker, 1000)
    }

    override fun onStop() { ui.removeCallbacks(ticker); stopVideo(); super.onStop() }

    private fun metrics(): DisplayMetrics = DisplayMetrics().also { display.getRealMetrics(it) }

    fun showBitmap(bmp: Bitmap) { stopVideo(); video.visibility = View.GONE; image.setImageBitmap(bmp); image.visibility = View.VISIBLE }

    fun showPdfPage(path: String, index: Int, done: (Throwable?) -> Unit) {
        val token = ++renderToken
        val m = metrics()
        Thread {
            try {
                val bmp = PdfUtil.render(path, index, m.widthPixels, m.heightPixels)
                ui.post { if (token == renderToken) showBitmap(bmp); done(null) }
            } catch (e: Throwable) { ui.post { done(e) } }
        }.start()
    }

    fun showImageFile(path: String, done: (Throwable?) -> Unit) {
        val m = metrics()
        Thread {
            try {
                val opts = android.graphics.BitmapFactory.Options().apply { inJustDecodeBounds = true }
                android.graphics.BitmapFactory.decodeFile(path, opts)
                var sample = 1
                while (opts.outWidth / sample > m.widthPixels * 2 || opts.outHeight / sample > m.heightPixels * 2) sample *= 2
                val bmp = android.graphics.BitmapFactory.decodeFile(path, android.graphics.BitmapFactory.Options().apply { inSampleSize = sample })
                    ?: throw IllegalArgumentException("Unsupported image")
                ui.post { showBitmap(bmp); done(null) }
            } catch (e: Throwable) { ui.post { done(e) } }
        }.start()
    }

    fun playVideo(path: String, done: (Throwable?) -> Unit) {
        image.visibility = View.GONE
        video.visibility = View.VISIBLE
        video.setOnPreparedListener { mp -> player = mp; mp.isLooping = false; video.start(); done(null) }
        video.setOnErrorListener { _, what, extra -> done(IllegalStateException("Video error $what/$extra")); true }
        video.setVideoPath(path)
    }

    fun videoControl(action: String, value: Double) {
        when (action) {
            "play" -> video.start()
            "pause" -> video.pause()
            "seek" -> video.seekTo(value.toInt())
            "volume" -> player?.setVolume(value.toFloat(), value.toFloat())
            "stop" -> stopVideo()
        }
    }

    private fun stopVideo() { try { video.stopPlayback() } catch (_: Exception) {}; player = null }

    fun setBlackout(on: Boolean) { black.visibility = if (on) View.VISIBLE else View.GONE }
    fun setPausedBadge(on: Boolean) { badge.visibility = if (on) View.VISIBLE else View.GONE }

    fun setPointer(x: Float, y: Float, visible: Boolean) {
        pointer.visibility = if (visible) View.VISIBLE else View.GONE
        if (visible) { pointer.x = x * root.width - 20; pointer.y = y * root.height - 20 }
    }

    fun clear() {
        stopVideo(); renderToken++
        image.setImageDrawable(null); image.visibility = View.GONE; video.visibility = View.GONE
        setBlackout(false); setPausedBadge(false); setPointer(0f, 0f, false)
    }
}
