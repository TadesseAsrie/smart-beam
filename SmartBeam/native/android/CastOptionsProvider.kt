package com.smartbeam.app.nativemods

import android.content.Context
import android.content.pm.PackageManager
import com.google.android.gms.cast.CastMediaControlIntent
import com.google.android.gms.cast.framework.CastOptions
import com.google.android.gms.cast.framework.OptionsProvider
import com.google.android.gms.cast.framework.SessionProvider
import com.google.android.gms.cast.framework.media.CastMediaOptions

class CastOptionsProvider : OptionsProvider {
    override fun getCastOptions(context: Context): CastOptions {
        val media = CastMediaOptions.Builder().setNotificationOptions(null).setMediaSessionEnabled(false).build()
        return CastOptions.Builder()
            .setReceiverApplicationId(appId(context))
            .setStopReceiverApplicationWhenEndingSession(true)
            .setCastMediaOptions(media)
            .build()
    }

    override fun getAdditionalSessionProviders(context: Context): List<SessionProvider>? = null

    companion object {
        fun appId(context: Context): String {
            val fromManifest = try {
                context.packageManager.getApplicationInfo(context.packageName, PackageManager.GET_META_DATA)
                    .metaData?.get("com.smartbeam.CAST_APP_ID")?.toString()
            } catch (e: Exception) { null }
            return fromManifest?.takeIf { it.isNotBlank() } ?: CastMediaControlIntent.DEFAULT_MEDIA_RECEIVER_APPLICATION_ID
        }
    }
}
