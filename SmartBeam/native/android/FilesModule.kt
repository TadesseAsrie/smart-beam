package com.smartbeam.app.nativemods

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract
import androidx.documentfile.provider.DocumentFile
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

/** Storage Access Framework helpers: user-granted folder trees, listing, and copying files into app storage. */
class FilesModule(private val rc: ReactApplicationContext) : ReactContextBaseJavaModule(rc), ActivityEventListener {
    override fun getName() = "SmartBeamFiles"

    private val reqTree = 4711
    private var pending: Promise? = null

    init { rc.addActivityEventListener(this) }

    @ReactMethod
    fun pickTree(promise: Promise) {
        val a = rc.currentActivity ?: run { promise.reject("NO_ACTIVITY", "App is not in the foreground"); return }
        pending = promise
        val i = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
        a.startActivityForResult(i, reqTree)
    }

    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != reqTree) return
        val p = pending ?: return
        pending = null
        val uri = data?.data
        if (resultCode != Activity.RESULT_OK || uri == null) { p.reject("E_CANCELLED", "Cancelled"); return }
        try {
            rc.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
            p.resolve(Arguments.createMap().apply { putString("uri", uri.toString()); putString("name", DocumentFile.fromTreeUri(rc, uri)?.name ?: "Folder") })
        } catch (e: Exception) { p.reject("E_PERMISSION", e.message, e) }
    }

    override fun onNewIntent(intent: Intent) {}

    @ReactMethod
    fun persistedTrees(promise: Promise) {
        val arr = Arguments.createArray()
        rc.contentResolver.persistedUriPermissions.filter { it.isReadPermission && DocumentsContract.isTreeUri(it.uri) }.forEach {
            arr.pushMap(Arguments.createMap().apply { putString("uri", it.uri.toString()); putString("name", DocumentFile.fromTreeUri(rc, it.uri)?.name ?: "Folder") })
        }
        promise.resolve(arr)
    }

    @ReactMethod
    fun releaseTree(uri: String, promise: Promise) {
        try { rc.contentResolver.releasePersistableUriPermission(Uri.parse(uri), Intent.FLAG_GRANT_READ_URI_PERMISSION); promise.resolve(true) }
        catch (e: Exception) { promise.reject("E_RELEASE", e.message, e) }
    }

    @ReactMethod
    fun listTree(uri: String, promise: Promise) {
        Thread {
            try {
                val dir = DocumentFile.fromTreeUri(rc, Uri.parse(uri)) ?: throw IllegalArgumentException("Folder unavailable")
                val arr = Arguments.createArray()
                dir.listFiles().forEach { f ->
                    arr.pushMap(Arguments.createMap().apply {
                        putString("uri", f.uri.toString()); putString("name", f.name ?: "?"); putBoolean("isDir", f.isDirectory)
                        putDouble("size", f.length().toDouble()); putString("mime", f.type); putDouble("modified", f.lastModified().toDouble())
                    })
                }
                promise.resolve(arr)
            } catch (e: Exception) { promise.reject("E_LIST", e.message ?: "Cannot read folder", e) }
        }.start()
    }

    @ReactMethod
    fun getInfo(uri: String, promise: Promise) {
        try {
            val f = DocumentFile.fromSingleUri(rc, Uri.parse(uri)) ?: throw IllegalArgumentException("File unavailable")
            promise.resolve(Arguments.createMap().apply {
                putString("name", f.name ?: "file"); putDouble("size", f.length().toDouble()); putString("mime", f.type); putDouble("modified", f.lastModified().toDouble())
            })
        } catch (e: Exception) { promise.reject("E_INFO", e.message, e) }
    }

    /** Copies a content:// document into app-private storage (the app then manages/deletes that copy). */
    @ReactMethod
    fun importFile(uri: String, name: String, promise: Promise) {
        Thread {
            try {
                val dir = File(rc.filesDir, "presentations").apply { mkdirs() }
                val safe = name.replace(Regex("[\\\\/:*?\"<>|]"), "_")
                var dest = File(dir, safe)
                var n = 1
                while (dest.exists()) { dest = File(dir, safe.substringBeforeLast('.', safe) + " ($n)" + (if (safe.contains('.')) "." + safe.substringAfterLast('.') else "")); n++ }
                val u = Uri.parse(uri)
                rc.contentResolver.openInputStream(u)?.use { input -> dest.outputStream().use { input.copyTo(it) } } ?: throw IllegalStateException("Cannot open file")
                promise.resolve(Arguments.createMap().apply {
                    putString("path", dest.absolutePath); putString("name", dest.name); putDouble("size", dest.length().toDouble())
                    putString("mime", rc.contentResolver.getType(u)); putDouble("modified", dest.lastModified().toDouble())
                })
            } catch (e: Exception) { promise.reject("E_IMPORT", e.message ?: "Import failed", e) }
        }.start()
    }

    private fun inAppStorage(f: File): Boolean {
        val p = f.canonicalPath
        return p.startsWith(rc.filesDir.canonicalPath) || p.startsWith(rc.cacheDir.canonicalPath)
    }

    @ReactMethod
    fun deleteFile(path: String, promise: Promise) {
        try {
            val f = File(path)
            if (!inAppStorage(f)) { promise.reject("E_FORBIDDEN", "Only app-managed files can be deleted"); return }
            promise.resolve(!f.exists() || f.delete())
        } catch (e: Exception) { promise.reject("E_DELETE", e.message, e) }
    }

    @ReactMethod
    fun renameFile(path: String, newName: String, promise: Promise) {
        try {
            val f = File(path)
            if (!inAppStorage(f)) { promise.reject("E_FORBIDDEN", "Only app-managed files can be renamed"); return }
            val target = File(f.parentFile, newName.replace(Regex("[\\\\/:*?\"<>|]"), "_"))
            if (target.exists()) { promise.reject("E_EXISTS", "A file with that name already exists"); return }
            if (!f.renameTo(target)) { promise.reject("E_RENAME", "Rename failed"); return }
            promise.resolve(target.absolutePath)
        } catch (e: Exception) { promise.reject("E_RENAME", e.message, e) }
    }

    @ReactMethod
    fun clearThumbnails(promise: Promise) {
        val dir = File(rc.cacheDir, "thumbs")
        val freed = dir.walkTopDown().filter { it.isFile }.sumOf { it.length() }
        dir.deleteRecursively()
        promise.resolve(freed.toDouble())
    }
}
