package com.smartbeam.app.nativemods

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.core.DeviceEventManagerModule

/** Emits an event to JS (listened to with DeviceEventEmitter). */
fun ReactApplicationContext.emit(event: String, payload: Any?) {
    if (!hasActiveReactInstance()) return
    getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit(event, payload)
}
