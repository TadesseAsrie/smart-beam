package com.smartbeam.app.nativemods

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.OutputStream
import java.io.RandomAccessFile
import java.net.Inet4Address
import java.net.NetworkInterface
import java.net.ServerSocket
import java.net.Socket
import java.security.SecureRandom
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Temporary LAN HTTP server (GET/HEAD, byte ranges) that serves ONLY files explicitly registered by the app
 * under unguessable one-time tokens. It exists so a Cast receiver on the same network can fetch media
 * instead of being handed an inaccessible phone-local path. Everything is revoked on stop().
 */
class ServerModule(private val rc: ReactApplicationContext) : ReactContextBaseJavaModule(rc) {
    override fun getName() = "SmartBeamServer"

    private var server: ServerSocket? = null
    private var pool: ExecutorService? = null
    private val files = ConcurrentHashMap<String, Pair<File, String>>()
    private val rnd = SecureRandom()
    private val cors = "Access-Control-Allow-Origin: *\r\nAccess-Control-Allow-Headers: Range\r\nCache-Control: no-store\r\n"

    private fun localIp(): String? = try {
        NetworkInterface.getNetworkInterfaces().toList()
            .filter { it.isUp && !it.isLoopback }
            .sortedBy { if (it.name.startsWith("wlan")) 0 else 1 }
            .flatMap { it.inetAddresses.toList() }
            .firstOrNull { it is Inet4Address && it.isSiteLocalAddress }?.hostAddress
    } catch (e: Exception) { null }

    @ReactMethod
    fun start(promise: Promise) {
        try {
            val ip = localIp() ?: run { promise.reject("NO_LAN", "The phone has no Wi-Fi/LAN address. Connect to the same network as the receiver."); return }
            if (server == null) {
                val s = ServerSocket(0, 20)
                server = s
                pool = Executors.newCachedThreadPool()
                Thread { accept(s) }.apply { isDaemon = true; start() }
            }
            promise.resolve(Arguments.createMap().apply { putString("ip", ip); putInt("port", server!!.localPort) })
        } catch (e: Exception) { promise.reject("SERVER_START_FAILED", e.message, e) }
    }

    @ReactMethod
    fun registerFile(path: String, mime: String, promise: Promise) {
        val s = server
        val f = File(path)
        if (s == null) { promise.reject("SERVER_STOPPED", "Server is not running"); return }
        if (!f.isFile) { promise.reject("NO_FILE", "File not found"); return }
        val bytes = ByteArray(18); rnd.nextBytes(bytes)
        val token = bytes.joinToString("") { "%02x".format(it) }
        files[token] = Pair(f, mime)
        promise.resolve("http://${localIp()}:${s.localPort}/f/$token")
    }

    @ReactMethod
    fun stop(promise: Promise) { shutdown(); promise.resolve(true) }

    private fun shutdown() {
        files.clear()
        try { server?.close() } catch (_: Exception) {}
        server = null
        pool?.shutdownNow(); pool = null
    }

    private fun accept(s: ServerSocket) {
        while (!s.isClosed) {
            try { val c = s.accept(); pool?.execute { handle(c) } } catch (_: Exception) { break }
        }
    }

    private fun head(out: OutputStream, status: String, extra: String = "") {
        out.write(("HTTP/1.1 $status\r\n" + cors + extra + "Connection: close\r\n\r\n").toByteArray())
    }

    private fun handle(sock: Socket) {
        sock.use {
            try {
                sock.soTimeout = 15000
                val reader = sock.getInputStream().bufferedReader(Charsets.ISO_8859_1)
                val line = reader.readLine() ?: return
                val parts = line.split(" ")
                val method = parts[0]
                val path = parts.getOrNull(1) ?: "/"
                val headers = HashMap<String, String>()
                while (true) {
                    val l = reader.readLine() ?: break
                    if (l.isEmpty()) break
                    val i = l.indexOf(':')
                    if (i > 0) headers[l.substring(0, i).trim().lowercase()] = l.substring(i + 1).trim()
                }
                val out = sock.getOutputStream()
                if (method == "OPTIONS") { head(out, "204 No Content", "Content-Length: 0\r\n"); return }
                if (method != "GET" && method != "HEAD") { head(out, "405 Method Not Allowed", "Content-Length: 0\r\n"); return }
                val entry = files[path.removePrefix("/f/").substringBefore('?')]
                if (!path.startsWith("/f/") || entry == null) { head(out, "404 Not Found", "Content-Length: 0\r\n"); return }
                val (file, mime) = entry
                val len = file.length()
                var start = 0L
                var end = len - 1
                var status = "200 OK"
                headers["range"]?.let { r ->
                    Regex("bytes=(\\d*)-(\\d*)").find(r)?.let { m ->
                        val a = m.groupValues[1]; val b = m.groupValues[2]
                        if (a.isNotEmpty()) { start = a.toLong(); if (b.isNotEmpty()) end = minOf(b.toLong(), len - 1) }
                        else if (b.isNotEmpty()) start = maxOf(0L, len - b.toLong())
                        status = "206 Partial Content"
                    }
                }
                if (len == 0L || start > end || start >= len) { head(out, "416 Range Not Satisfiable", "Content-Range: bytes */$len\r\nContent-Length: 0\r\n"); return }
                val extra = "Content-Type: $mime\r\nContent-Length: ${end - start + 1}\r\nAccept-Ranges: bytes\r\n" +
                    (if (status.startsWith("206")) "Content-Range: bytes $start-$end/$len\r\n" else "")
                head(out, status, extra)
                if (method == "GET") {
                    RandomAccessFile(file, "r").use { raf ->
                        raf.seek(start)
                        val buf = ByteArray(64 * 1024)
                        var remaining = end - start + 1
                        while (remaining > 0) {
                            val n = raf.read(buf, 0, minOf(buf.size.toLong(), remaining).toInt())
                            if (n < 0) break
                            out.write(buf, 0, n); remaining -= n
                        }
                    }
                }
                out.flush()
            } catch (_: Exception) { /* client closed the connection: normal for video seeking */ }
        }
    }

    override fun invalidate() { shutdown(); super.invalidate() }
}
