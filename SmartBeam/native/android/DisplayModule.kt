package com.smartbeam.app.nativemods

import android.content.Context
import android.hardware.display.DisplayManager
import android.os.Handler
import android.os.Looper
import android.view.Display
import android.view.WindowManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap

/** Secondary-display discovery and Android Presentation lifecycle. */
class DisplayModule(private val rc: ReactApplicationContext) : ReactContextBaseJavaModule(rc), LifecycleEventListener {
    override fun getName() = "SmartBeamDisplay"

    private val dm = rc.getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
    private val main = Handler(Looper.getMainLooper())
    private var presentation: SmartBeamPresentation? = null
    private var shownId = -1

    private val listener = object : DisplayManager.DisplayListener {
        override fun onDisplayAdded(id: Int) = emitList()
        override fun onDisplayChanged(id: Int) = emitList()
        override fun onDisplayRemoved(id: Int) {
            if (id == shownId) main.post { dismissInternal(); rc.emit("SmartBeamDisplayLost", id) }
            emitList()
        }
    }

    init {
        dm.registerDisplayListener(listener, main)
        rc.addLifecycleEventListener(this)
    }

    private fun describe(d: Display): WritableMap = Arguments.createMap().apply {
        putInt("id", d.displayId)
        putString("name", d.name)
        val mode = d.mode
        putInt("width", mode.physicalWidth); putInt("height", mode.physicalHeight)
        putBoolean("presentation", (d.flags and Display.FLAG_PRESENTATION) != 0)
        putBoolean("isDefault", d.displayId == Display.DEFAULT_DISPLAY)
    }

    private fun presentationList(): WritableArray {
        val arr = Arguments.createArray()
        dm.getDisplays(DisplayManager.DISPLAY_CATEGORY_PRESENTATION).filter { it.displayId != Display.DEFAULT_DISPLAY }.forEach { arr.pushMap(describe(it)) }
        return arr
    }

    private fun emitList() = rc.emit("SmartBeamDisplays", presentationList())

    @ReactMethod fun getDisplays(promise: Promise) = promise.resolve(presentationList())

    @ReactMethod
    fun getAllDisplays(promise: Promise) {
        val arr = Arguments.createArray()
        dm.displays.forEach { arr.pushMap(describe(it)) }
        promise.resolve(arr)
    }

    private fun dismissInternal() { try { presentation?.dismiss() } catch (_: Exception) {}; presentation = null; shownId = -1 }

    private fun withPresentation(promise: Promise, block: (SmartBeamPresentation) -> Unit) {
        main.post {
            val p = presentation
            if (p == null) promise.reject("NO_DISPLAY", "No external display is active") else block(p)
        }
    }

    @ReactMethod
    fun show(displayId: Int, promise: Promise) {
        val act = rc.currentActivity
        if (act == null) { promise.reject("NO_ACTIVITY", "App is not in the foreground"); return }
        act.runOnUiThread {
            dismissInternal()
            val d = dm.getDisplay(displayId)
            if (d == null) { promise.reject("NO_DISPLAY", "The display is no longer connected"); return@runOnUiThread }
            try {
                val p = SmartBeamPresentation(act, d)
                p.onVideoProgress = { pos, dur, playing ->
                    rc.emit("SmartBeamDisplayVideo", Arguments.createMap().apply {
                        putDouble("positionMs", pos.toDouble()); putDouble("durationMs", dur.toDouble()); putBoolean("playing", playing)
                    })
                }
                p.show(); presentation = p; shownId = displayId
                promise.resolve(true)
            } catch (e: WindowManager.InvalidDisplayException) {
                promise.reject("DISPLAY_INVALID", "This display cannot be used for presentations", e)
            } catch (e: Exception) { promise.reject("DISPLAY_FAILED", e.message, e) }
        }
    }

    @ReactMethod
    fun showPdf(path: String, index: Int, promise: Promise) = withPresentation(promise) { p ->
        p.showPdfPage(path, index) { err -> if (err == null) promise.resolve(true) else promise.reject("RENDER_FAILED", err.message, err) }
    }

    @ReactMethod
    fun showImage(path: String, promise: Promise) = withPresentation(promise) { p ->
        p.showImageFile(path) { err -> if (err == null) promise.resolve(true) else promise.reject("RENDER_FAILED", err.message, err) }
    }

    @ReactMethod
    fun playVideo(path: String, promise: Promise) = withPresentation(promise) { p ->
        var settled = false
        p.playVideo(path) { err -> if (!settled) { settled = true; if (err == null) promise.resolve(true) else promise.reject("VIDEO_FAILED", err.message, err) } }
    }

    @ReactMethod fun videoControl(action: String, value: Double, promise: Promise) = withPresentation(promise) { it.videoControl(action, value); promise.resolve(true) }
    @ReactMethod fun setBlackout(on: Boolean, promise: Promise) = withPresentation(promise) { it.setBlackout(on); promise.resolve(true) }
    @ReactMethod fun setPaused(on: Boolean, promise: Promise) = withPresentation(promise) { it.setPausedBadge(on); promise.resolve(true) }
    @ReactMethod fun setPointer(x: Double, y: Double, visible: Boolean, promise: Promise) = withPresentation(promise) { it.setPointer(x.toFloat(), y.toFloat(), visible); promise.resolve(true) }
    @ReactMethod fun clear(promise: Promise) { main.post { presentation?.clear(); promise.resolve(true) } }
    @ReactMethod fun dismiss(promise: Promise) { main.post { dismissInternal(); promise.resolve(true) } }

    override fun onHostResume() {}
    override fun onHostPause() {}
    override fun onHostDestroy() { main.post { dismissInternal() } }
    override fun invalidate() { dm.unregisterDisplayListener(listener); main.post { dismissInternal() }; super.invalidate() }
}
