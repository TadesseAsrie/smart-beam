package com.smartbeam.app.nativemods

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class SmartBeamPackage : ReactPackage {
    override fun createNativeModules(ctx: ReactApplicationContext): List<NativeModule> = listOf(
        CastModule(ctx), DisplayModule(ctx), ServerModule(ctx), PdfModule(ctx), FilesModule(ctx), SystemModule(ctx)
    )

    override fun createViewManagers(ctx: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
