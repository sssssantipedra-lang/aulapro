package es.aulapro.app;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.SocketException;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Servidor HTTP mínimo de la Sala de alumnos en Android: el equivalente de
 * electron/classroom.cjs. Aquí solo se reciben y se contestan peticiones; qué
 * se contesta lo decide la interfaz (src/platform/classroomRoom.ts), la misma
 * lógica que en el escritorio. Cada petición se pasa a la interfaz como evento
 * y se espera su respuesta.
 */
class RoomServer {

    interface Handler {
        void onRequest(String id, String method, String path, String query, String body);
    }

    private static final int MAX_BODY = 64 * 1024;
    private static final String TEXT = "text/plain; charset=utf-8";

    private final Handler handler;
    private final ExecutorService pool = Executors.newCachedThreadPool();
    private final ConcurrentHashMap<String, CompletableFuture<String[]>> pending = new ConcurrentHashMap<>();
    private final AtomicLong seq = new AtomicLong();
    private volatile ServerSocket socket;
    private int port = 0;

    RoomServer(Handler handler) {
        this.handler = handler;
    }

    boolean running() {
        ServerSocket s = socket;
        return s != null && !s.isClosed();
    }

    int port() {
        return port;
    }

    /** Escucha en el primer puerto libre desde `preferred`. */
    int start(int preferred, int tries) throws IOException {
        if (running()) return port;
        for (int i = 0; i <= tries; i++) {
            ServerSocket s = new ServerSocket();
            try {
                s.bind(new InetSocketAddress(preferred + i));
            } catch (IOException busy) {
                s.close();
                continue;
            }
            socket = s;
            port = preferred + i;
            pool.execute(this::acceptLoop);
            return port;
        }
        throw new IOException("No se pudo abrir la sala: no hay ningún puerto libre en este dispositivo.");
    }

    void stop() {
        ServerSocket s = socket;
        socket = null;
        port = 0;
        if (s != null) {
            try { s.close(); } catch (IOException ignored) { }
        }
        for (CompletableFuture<String[]> f : pending.values()) {
            f.complete(new String[] { "503", TEXT, "Sala cerrada" });
        }
        pending.clear();
    }

    void respond(String id, int status, String type, String body) {
        CompletableFuture<String[]> f = pending.remove(id);
        if (f != null) f.complete(new String[] { String.valueOf(status), type, body });
    }

    private void acceptLoop() {
        ServerSocket s = socket;
        while (s != null && !s.isClosed()) {
            try {
                Socket client = s.accept();
                pool.execute(() -> serve(client));
            } catch (IOException closed) {
                break;
            }
        }
    }

    private void serve(Socket c) {
        try (Socket client = c) {
            client.setSoTimeout(10000);
            InputStream in = new BufferedInputStream(client.getInputStream());
            String requestLine = readLine(in);
            if (requestLine == null) return;
            String[] parts = requestLine.split(" ");
            if (parts.length < 2) return;

            int length = 0;
            String line;
            while ((line = readLine(in)) != null && !line.isEmpty()) {
                int colon = line.indexOf(':');
                if (colon > 0 && line.substring(0, colon).trim().equalsIgnoreCase("content-length")) {
                    try { length = Integer.parseInt(line.substring(colon + 1).trim()); } catch (NumberFormatException ignored) { }
                }
            }
            if (length < 0 || length > MAX_BODY) {
                write(client, 413, TEXT, "Demasiado grande");
                return;
            }
            byte[] body = new byte[length];
            int read = 0;
            while (read < length) {
                int r = in.read(body, read, length - read);
                if (r < 0) break;
                read += r;
            }

            String target = parts[1];
            int q = target.indexOf('?');
            String path = q < 0 ? target : target.substring(0, q);
            String query = q < 0 ? "" : target.substring(q + 1);

            String id = String.valueOf(seq.incrementAndGet());
            CompletableFuture<String[]> answer = new CompletableFuture<>();
            pending.put(id, answer);
            handler.onRequest(id, parts[0], path, query, new String(body, 0, read, StandardCharsets.UTF_8));

            String[] res;
            try {
                res = answer.get(10, TimeUnit.SECONDS);
            } catch (Exception timeout) {
                pending.remove(id);
                res = new String[] { "503", TEXT, "Sin respuesta" };
            }
            write(client, Integer.parseInt(res[0]), res[1], res[2]);
        } catch (Exception ignored) {
            // El móvil se fue a mitad: no pasa nada
        }
    }

    private static String readLine(InputStream in) throws IOException {
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        int ch = -1;
        while (buf.size() < 8192 && (ch = in.read()) != -1) {
            if (ch == '\n') break;
            if (ch != '\r') buf.write(ch);
        }
        if (ch == -1 && buf.size() == 0) return null;
        return new String(buf.toByteArray(), StandardCharsets.UTF_8);
    }

    private static String reason(int status) {
        switch (status) {
            case 200: return "OK";
            case 400: return "Bad Request";
            case 403: return "Forbidden";
            case 404: return "Not Found";
            case 413: return "Payload Too Large";
            default: return "Service Unavailable";
        }
    }

    private static void write(Socket c, int status, String type, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        String head = "HTTP/1.1 " + status + " " + reason(status) + "\r\n"
            + "Content-Type: " + type + "\r\n"
            + "Content-Length: " + bytes.length + "\r\n"
            + "Cache-Control: no-store\r\n"
            + "X-Content-Type-Options: nosniff\r\n"
            + "Connection: close\r\n\r\n";
        OutputStream out = c.getOutputStream();
        out.write(head.getBytes(StandardCharsets.US_ASCII));
        out.write(bytes);
        out.flush();
    }

    /**
     * Direcciones por las que un móvil puede llegar a la tableta: la wifi y,
     * si la tableta comparte datos, su propia zona wifi. Se descartan los
     * datos móviles y las VPN, a las que un alumno no puede llegar.
     */
    static JSArray addresses() {
        JSArray list = new JSArray();
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                String name = ni.getName();
                if (name.matches("(?i).*(tun|rmnet|ccmni|dummy|ppp|ipsec).*")) continue;
                for (InetAddress a : Collections.list(ni.getInetAddresses())) {
                    if (!(a instanceof Inet4Address) || a.isLoopbackAddress() || a.isLinkLocalAddress()) continue;
                    JSObject o = new JSObject();
                    o.put("iface", name);
                    o.put("ip", a.getHostAddress());
                    list.put(o);
                }
            }
        } catch (SocketException ignored) {
            // Sin red: la lista va vacía y la interfaz lo explica
        }
        return list;
    }
}
