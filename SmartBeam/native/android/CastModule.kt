package com.smartbeam.app.nativemods

import android.os.Handler
import android.os.Looper
import androidx.mediarouter.media.MediaRouteSelector
import androidx.mediarouter.media.MediaRouter
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.google.android.gms.cast.CastDevice
import com.google.android.gms.cast.CastMediaControlIntent
import com.google.android.gms.cast.CastStatusCodes
import com.google.android.gms.cast.MediaInfo
import com.google.android.gms.cast.MediaLoadRequestData
import com.google.android.gms.cast.MediaMetadata
import com.google.android.gms.cast.MediaSeekOptions
import com.google.android.gms.cast.framework.CastContext
import com.google.android.gms.cast.framework.CastSession
import com.google.android.gms.cast.framework.SessionManagerListener
import com.google.android.gms.cast.framework.media.RemoteMediaClient
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import java.util.concurrent.Executors

/**
 * Google Cast sender. Discovery uses MediaRouter with the Cast selector, sessions use the official Cast framework,
 * presentation commands travel over the custom namespace handled by the SmartBeam Web Receiver.
 */
class CastModule(private val rc: ReactApplicationContext) : ReactContextBaseJavaModule(rc) {
    override fun getName() = "SmartBeamCast"

    private val main = Handler(Looper.getMainLooper())
    private val ns = "urn:x-cast:com.smartbeam.presentation"
    private var castContext: CastContext? = null
    private var router: MediaRouter? = null
    private var selector: MediaRouteSelector? = null
    private val routes = LinkedHashMap<String, MediaRouter.RouteInfo>()
    private var discovering = false
    private var progressListener: RemoteMediaClient.ProgressListener? = null
    private var progressClient: RemoteMediaClient? = null

    private fun playServicesOk() = GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(rc) == ConnectionResult.SUCCESS

    private fun ensure(cb: (CastContext?, Throwable?) -> Unit) {
        castContext?.let { cb(it, null); return }
        if (!playServicesOk()) { cb(null, IllegalStateException("Google Play services is unavailable")); return }
        try {
            CastContext.getSharedInstance(rc, Executors.newSingleThreadExecutor())
                .addOnSuccessListener { ctx ->
                    main.post {
                        castContext = ctx
                        router = MediaRouter.getInstance(rc)
                        selector = ctx.mergedSelector ?: MediaRouteSelector.Builder()
                            .addControlCategory(CastMediaControlIntent.categoryForCast(CastOptionsProvider.appId(rc))).build()
                        ctx.sessionManager.addSessionManagerListener(sessionListener, CastSession::class.java)
                        cb(ctx, null)
                    }
                }
                .addOnFailureListener { e -> main.post { cb(null, e) } }
        } catch (e: Throwable) { cb(null, e) }
    }

    private val routeCb = object : MediaRouter.Callback() {
        override fun onRouteAdded(r: MediaRouter, route: MediaRouter.RouteInfo) = publish()
        override fun onRouteRemoved(r: MediaRouter, route: MediaRouter.RouteInfo) = publish()
        override fun onRouteChanged(r: MediaRouter, route: MediaRouter.RouteInfo) = publish()
    }

    private fun publish() {
        val r = router ?: return
        val sel = selector ?: return
        routes.clear()
        val arr = Arguments.createArray()
        for (route in r.routes) {
            if (route.isDefault || !route.matchesSelector(sel)) continue
            routes[route.id] = route
            val model = route.extras?.let { CastDevice.getFromBundle(it)?.modelName }
            arr.pushMap(Arguments.createMap().apply {
                putString("id", route.id)
                putString("name", route.name)
                putString("description", route.description)
                putInt("connectionState", route.connectionState)
                putString("model", model)
            })
        }
        rc.emit("SmartBeamCastDevices", arr)
    }

    private fun sessionEvent(state: String, message: String? = null, name: String? = null) {
        rc.emit("SmartBeamCastSession", Arguments.createMap().apply {
            putString("state", state)
            if (message != null) putString("message", message)
            if (name != null) putString("deviceName", name)
        })
    }

    private fun attach(s: CastSession) {
        try { s.setMessageReceivedCallbacks(ns) { _, _, msg -> rc.emit("SmartBeamCastMessage", msg) } } catch (_: Exception) {}
        s.remoteMediaClient?.let { c ->
            detachProgress()
            val l = RemoteMediaClient.ProgressListener { pos, dur ->
                rc.emit("SmartBeamCastMedia", Arguments.createMap().apply {
                    putDouble("positionMs", pos.toDouble()); putDouble("durationMs", dur.toDouble()); putBoolean("playing", c.isPlaying)
                })
            }
            c.addProgressListener(l, 1000)
            progressListener = l; progressClient = c
        }
        sessionEvent("connected", name = s.castDevice?.friendlyName)
    }

    private fun detachProgress() {
        try { progressListener?.let { progressClient?.removeProgressListener(it) } } catch (_: Exception) {}
        progressListener = null; progressClient = null
    }

    private val sessionListener = object : SessionManagerListener<CastSession> {
        override fun onSessionStarting(s: CastSession) = sessionEvent("connecting")
        override fun onSessionStarted(s: CastSession, id: String) = attach(s)
        override fun onSessionStartFailed(s: CastSession, error: Int) = sessionEvent("error", "Could not start session: ${CastStatusCodes.getStatusCodeString(error)}")
        override fun onSessionEnding(s: CastSession) {}
        override fun onSessionEnded(s: CastSession, error: Int) { detachProgress(); sessionEvent("disconnected", if (error != 0) CastStatusCodes.getStatusCodeString(error) else null) }
        override fun onSessionResuming(s: CastSession, id: String) = sessionEvent("connecting")
        override fun onSessionResumed(s: CastSession, wasSuspended: Boolean) = attach(s)
        override fun onSessionResumeFailed(s: CastSession, error: Int) = sessionEvent("error", "Could not resume session: ${CastStatusCodes.getStatusCodeString(error)}")
        override fun onSessionSuspended(s: CastSession, reason: Int) = sessionEvent("suspended", "Connection to the receiver was interrupted")
    }

    private fun currentSession(): CastSession? = castContext?.sessionManager?.currentCastSession

    @ReactMethod
    fun getConfig(promise: Promise) {
        val id = CastOptionsProvider.appId(rc)
        promise.resolve(Arguments.createMap().apply {
            putString("appId", id)
            putBoolean("isDefaultReceiver", id == CastMediaControlIntent.DEFAULT_MEDIA_RECEIVER_APPLICATION_ID)
            putBoolean("playServices", playServicesOk())
        })
    }

    @ReactMethod
    fun startDiscovery(promise: Promise) {
        main.post {
            ensure { _, err ->
                if (err != null) { promise.reject("CAST_INIT_FAILED", err.message ?: "Cast initialisation failed", err); return@ensure }
                if (!discovering) {
                    router?.addCallback(selector!!, routeCb, MediaRouter.CALLBACK_FLAG_REQUEST_DISCOVERY or MediaRouter.CALLBACK_FLAG_PERFORM_ACTIVE_SCAN)
                    discovering = true
                }
                publish()
                promise.resolve(true)
            }
        }
    }

    @ReactMethod
    fun stopDiscovery(promise: Promise) {
        main.post {
            if (discovering) { router?.removeCallback(routeCb); discovering = false }
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun connect(routeId: String, promise: Promise) {
        main.post {
            ensure { _, err ->
                if (err != null) { promise.reject("CAST_INIT_FAILED", err.message, err); return@ensure }
                val route = routes[routeId] ?: router?.routes?.firstOrNull { it.id == routeId }
                if (route == null) { promise.reject("NO_ROUTE", "This receiver is no longer available."); return@ensure }
                router?.selectRoute(route)
                promise.resolve(true)
            }
        }
    }

    @ReactMethod
    fun disconnect(promise: Promise) {
        main.post {
            castContext?.sessionManager?.endCurrentSession(true)
            router?.let { it.selectRoute(it.defaultRoute) }
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun sendMessage(json: String, promise: Promise) {
        main.post {
            val s = currentSession()
            if (s == null || !s.isConnected) { promise.reject("NO_SESSION", "No active Cast session"); return@post }
            s.sendMessage(ns, json).setResultCallback { st ->
                if (st.isSuccess) promise.resolve(true) else promise.reject("SEND_FAILED", st.statusMessage ?: "Message was not delivered")
            }
        }
    }

    @ReactMethod
    fun loadMedia(url: String, contentType: String, title: String, positionMs: Double, promise: Promise) {
        main.post {
            val client = currentSession()?.remoteMediaClient
            if (client == null) { promise.reject("NO_SESSION", "No active Cast session"); return@post }
            val isImage = contentType.startsWith("image/")
            val meta = MediaMetadata(if (isImage) MediaMetadata.MEDIA_TYPE_PHOTO else MediaMetadata.MEDIA_TYPE_MOVIE)
            meta.putString(MediaMetadata.KEY_TITLE, title)
            val info = MediaInfo.Builder(url).setContentType(contentType)
                .setStreamType(MediaInfo.STREAM_TYPE_BUFFERED).setMetadata(meta).build()
            val req = MediaLoadRequestData.Builder().setMediaInfo(info).setAutoplay(true).setCurrentTime(positionMs.toLong()).build()
            client.load(req).setResultCallback { r ->
                if (r.status.isSuccess) promise.resolve(true) else promise.reject("LOAD_FAILED", r.status.statusMessage ?: "The receiver could not load this media")
            }
        }
    }

    @ReactMethod
    fun mediaControl(action: String, value: Double, promise: Promise) {
        main.post {
            val s = currentSession()
            val c = s?.remoteMediaClient
            if (s == null || c == null) { promise.reject("NO_SESSION", "No active Cast session"); return@post }
            try {
                when (action) {
                    "play" -> c.play()
                    "pause" -> c.pause()
                    "stop" -> c.stop()
                    "seek" -> c.seek(MediaSeekOptions.Builder().setPosition(value.toLong()).build())
                    "volume" -> s.volume = value.coerceIn(0.0, 1.0)
                    else -> { promise.reject("BAD_ACTION", "Unknown action $action"); return@post }
                }
                promise.resolve(true)
            } catch (e: Exception) { promise.reject("CONTROL_FAILED", e.message, e) }
        }
    }

    override fun invalidate() {
        main.post {
            detachProgress()
            if (discovering) { router?.removeCallback(routeCb); discovering = false }
            castContext?.sessionManager?.removeSessionManagerListener(sessionListener, CastSession::class.java)
        }
        super.invalidate()
    }
}
