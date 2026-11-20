package com.smartbeam.app.nativemods

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.display.DisplayManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.os.StatFs
import android.provider.Settings
import android.view.Display
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

/** Wireless-display (Miracast) guidance, network state and storage statistics. No hidden APIs are used. */
class SystemModule(private val rc: ReactApplicationContext) : ReactContextBaseJavaModule(rc) {
    override fun getName() = "SmartBeamSystem"

    private fun castIntent() = Intent(Settings.ACTION_CAST_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

    @ReactMethod
    fun getWirelessDisplayInfo(promise: Promise) {
        val pm = rc.packageManager
        val dm = rc.getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
        promise.resolve(Arguments.createMap().apply {
            putInt("sdk", Build.VERSION.SDK_INT)
            putString("manufacturer", Build.MANUFACTURER)
            putString("model", Build.MODEL)
            putBoolean("castSettingsAvailable", castIntent().resolveActivity(pm) != null)
            putBoolean("wifiDirect", pm.hasSystemFeature(PackageManager.FEATURE_WIFI_DIRECT))
            putInt("externalDisplays", dm.displays.count { it.displayId != Display.DEFAULT_DISPLAY })
        })
    }

    @ReactMethod
    fun openWirelessSettings(promise: Promise) {
        val candidates = listOf(castIntent(), Intent("android.settings.WIFI_DISPLAY_SETTINGS").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        val pm = rc.packageManager
        val target = candidates.firstOrNull { it.resolveActivity(pm) != null }
        if (target == null) {
            promise.reject("UNSUPPORTED", "This device does not expose a wireless display / Cast settings screen. Look for 'Smart View', 'Screen Cast' or 'Wireless display' in Quick Settings.")
            return
        }
        try { rc.startActivity(target); promise.resolve(target.action) } catch (e: Exception) { promise.reject("E_OPEN", e.message, e) }
    }

    @ReactMethod
    fun getNetworkState(promise: Promise) {
        val cm = rc.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val caps = cm.getNetworkCapabilities(cm.activeNetwork)
        val transport = when {
            caps == null -> "none"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ethernet"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "cellular"
            else -> "other"
        }
        promise.resolve(Arguments.createMap().apply { putString("transport", transport); putBoolean("lan", transport == "wifi" || transport == "ethernet") })
    }

    @ReactMethod
    fun getStorageInfo(promise: Promise) {
        Thread {
            try {
                val stat = StatFs(rc.filesDir.absolutePath)
                val used = listOf(File(rc.filesDir, "presentations"), File(rc.filesDir, "converted"), File(rc.cacheDir, "thumbs"))
                    .sumOf { d -> d.walkTopDown().filter { it.isFile }.sumOf { it.length() } }
                promise.resolve(Arguments.createMap().apply {
                    putDouble("total", stat.totalBytes.toDouble()); putDouble("free", stat.availableBytes.toDouble()); putDouble("appUsed", used.toDouble())
                })
            } catch (e: Exception) { promise.reject("E_STORAGE", e.message, e) }
        }.start()
    }
}
