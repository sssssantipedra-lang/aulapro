package es.aulapro.app;

import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.ParcelFileDescriptor;
import android.print.PdfPrint;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.provider.DocumentsContract;
import android.provider.MediaStore;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.view.WindowManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Lo que en el escritorio hace Electron y en Android necesita código nativo:
 *
 *  - print: abre el diálogo de impresión del sistema con un documento (acta,
 *    ficha, SdA…). Desde ahí se imprime o se elige «Guardar como PDF». Es el
 *    equivalente de docs:savePdf / docs:print de electron/main.cjs.
 *  - savePdfInDocuments / saveFileInDocuments: guardan un PDF o un archivo en
 *    Documentos/AulaPro/<carpeta> (MediaStore, Android 10 o más, sin permisos),
 *    y openFile / openFolder los abren desde el aviso de «Guardado».
 *  - secretGet / secretSet: la clave de la IA, cifrada con una llave del
 *    Android Keystore que no sale del dispositivo (como electron/secrets.cjs).
 *  - roomStart / roomStop / roomRespond: la Sala de alumnos (ver RoomServer).
 *    Cada petición de un móvil llega a la interfaz como evento «roomRequest».
 */
@CapacitorPlugin(name = "AulaNative")
public class AulaNativePlugin extends Plugin {

    private static final String KEY_ALIAS = "aulapro_secretos";
    private static final String PREFS = "aulapro_secretos";
    private static final int IV_BYTES = 12;
    /** Nombres permitidos: la interfaz no puede guardar un secreto cualquiera. */
    private static final Set<String> ALLOWED = new HashSet<>(Arrays.asList("gemini", "licencia"));

    /** El documento que se está imprimiendo: sin una referencia viva, Android lo libera a mitad. */
    private WebView printing;

    @PluginMethod
    public void print(PluginCall call) {
        final String html = call.getString("html", "");
        final String name = call.getString("name", "AulaPro");
        final boolean landscape = call.getBoolean("landscape", true);

        getActivity().runOnUiThread(() -> {
            try {
                WebView view = new WebView(getActivity());
                view.getSettings().setJavaScriptEnabled(false);
                final boolean[] started = { false };
                view.setWebViewClient(new WebViewClient() {
                    @Override
                    public void onPageFinished(WebView v, String url) {
                        if (started[0]) return;
                        started[0] = true;
                        PrintManager manager = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                        PrintAttributes.MediaSize a4 = landscape
                            ? PrintAttributes.MediaSize.ISO_A4.asLandscape()
                            : PrintAttributes.MediaSize.ISO_A4.asPortrait();
                        manager.print(name, v.createPrintDocumentAdapter(name),
                            new PrintAttributes.Builder().setMediaSize(a4).build());
                        JSObject ret = new JSObject();
                        ret.put("ok", true);
                        call.resolve(ret);
                    }
                });
                printing = view;
                view.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
            } catch (Exception e) {
                call.reject(e.getMessage());
            }
        });
    }

    /* ── Guardar en Documentos/AulaPro/<carpeta> ── */

    private static final String ROOT_FOLDER = "AulaPro";

    /** Crea el archivo en Documentos/AulaPro/<carpeta> y devuelve su dirección. Solo Android 10 o más. */
    private Uri createInDocuments(String folder, String name, String mime) throws Exception {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) throw new Exception("Android anterior al 10");
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
        values.put(MediaStore.MediaColumns.MIME_TYPE, mime);
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, "Documents/" + ROOT_FOLDER + "/" + folder);
        Uri uri = getContext().getContentResolver().insert(MediaStore.Files.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY), values);
        if (uri == null) throw new Exception("No se pudo crear el archivo");
        return uri;
    }

    /** El nombre con el que quedó (Android añade «(1)» si ya había uno igual). */
    private String displayName(Uri uri, String fallback) {
        try (Cursor c = getContext().getContentResolver().query(uri, new String[] { MediaStore.MediaColumns.DISPLAY_NAME }, null, null, null)) {
            if (c != null && c.moveToFirst()) return c.getString(0);
        } catch (Exception e) {
            // se queda el nombre pedido
        }
        return fallback;
    }

    private JSObject saved(Uri uri, String name) {
        JSObject ret = new JSObject();
        ret.put("uri", uri.toString());
        ret.put("name", displayName(uri, name));
        return ret;
    }

    @PluginMethod
    public void saveFileInDocuments(PluginCall call) {
        final String name = call.getString("name", "archivo");
        final String mime = call.getString("mime", "application/octet-stream");
        final String folder = call.getString("folder", "Otros");
        final String base64 = call.getString("base64", "");
        Uri uri = null;
        try {
            uri = createInDocuments(folder, name, mime);
            try (OutputStream out = getContext().getContentResolver().openOutputStream(uri)) {
                if (out == null) throw new Exception("No se pudo abrir el archivo");
                out.write(Base64.decode(base64, Base64.DEFAULT));
            }
            call.resolve(saved(uri, name));
        } catch (Exception e) {
            if (uri != null) getContext().getContentResolver().delete(uri, null, null);
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void savePdfInDocuments(PluginCall call) {
        final String html = call.getString("html", "");
        final String name = call.getString("name", "AulaPro.pdf");
        final String folder = call.getString("folder", "Otros");
        final boolean landscape = call.getBoolean("landscape", true);
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            call.reject("Android anterior al 10");
            return;
        }

        getActivity().runOnUiThread(() -> {
            try {
                WebView view = new WebView(getActivity());
                view.getSettings().setJavaScriptEnabled(false);
                final boolean[] started = { false };
                view.setWebViewClient(new WebViewClient() {
                    @Override
                    public void onPageFinished(WebView v, String url) {
                        if (started[0]) return;
                        started[0] = true;
                        writePdf(call, v, name, folder, landscape);
                    }
                });
                printing = view;
                view.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
            } catch (Throwable e) {
                call.reject(String.valueOf(e.getMessage()));
            }
        });
    }

    private void writePdf(PluginCall call, WebView view, String name, String folder, boolean landscape) {
        Uri uri = null;
        ParcelFileDescriptor fd = null;
        try {
            uri = createInDocuments(folder, name, "application/pdf");
            fd = getContext().getContentResolver().openFileDescriptor(uri, "w");
            if (fd == null) throw new Exception("No se pudo abrir el archivo");
            // Los mismos márgenes que el PDF del escritorio (electron/main.cjs): 0,5 pulgadas arriba y abajo, 0,55 a los lados
            PrintAttributes.MediaSize a4 = landscape
                ? PrintAttributes.MediaSize.ISO_A4.asLandscape()
                : PrintAttributes.MediaSize.ISO_A4.asPortrait();
            PrintAttributes attrs = new PrintAttributes.Builder()
                .setMediaSize(a4)
                .setResolution(new PrintAttributes.Resolution("pdf", "pdf", 300, 300))
                .setMinMargins(new PrintAttributes.Margins(550, 500, 550, 500))
                .setColorMode(PrintAttributes.COLOR_MODE_COLOR)
                .build();
            final Uri target = uri;
            final ParcelFileDescriptor out = fd;
            new PdfPrint(attrs).write(view.createPrintDocumentAdapter(name), out, new PdfPrint.Listener() {
                @Override
                public void onDone() {
                    closeQuietly(out);
                    printing = null;
                    call.resolve(saved(target, name));
                }

                @Override
                public void onError(String message) {
                    closeQuietly(out);
                    getContext().getContentResolver().delete(target, null, null);
                    printing = null;
                    call.reject(message);
                }
            });
        } catch (Throwable e) {
            closeQuietly(fd);
            if (uri != null) getContext().getContentResolver().delete(uri, null, null);
            printing = null;
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    private static void closeQuietly(ParcelFileDescriptor fd) {
        if (fd == null) return;
        try { fd.close(); } catch (Exception e) { /* ya cerrado */ }
    }

    /** Abre el archivo guardado con la aplicación que lo sepa leer. */
    @PluginMethod
    public void openFile(PluginCall call) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(Uri.parse(call.getString("uri", "")), call.getString("mime", "*/*"));
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("No hay ninguna aplicación para abrirlo");
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    /**
     * Abre la carpeta de AulaPro (o la de un tipo de documento) en el explorador de archivos; si el dispositivo
     * no sabe, se intenta con el selector de documentos (lo que muestran todas las capas) y, como último recurso,
     * se devuelve `abierto: false` para que la interfaz abra el archivo o explique dónde está. Si la carpeta aún
     * no existe (no se ha guardado nada), apunta a Documentos y responde `existe: false`.
     */
    @PluginMethod
    public void openFolder(PluginCall call) {
        final String folder = call.getString("folder", "");
        final String rel = ROOT_FOLDER + (folder.isEmpty() ? "" : "/" + folder);
        final String ruta = "Documents/" + rel;
        boolean existe = new java.io.File(android.os.Environment.getExternalStoragePublicDirectory(
            android.os.Environment.DIRECTORY_DOCUMENTS), rel).exists();

        boolean abierto = false;
        // 1) El explorador de Android de serie (funciona en la mayoría de tabletas).
        try {
            Uri dir = DocumentsContract.buildDocumentUri("com.android.externalstorage.documents",
                "primary:" + (existe ? ruta : "Documents"));
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(dir, DocumentsContract.Document.MIME_TYPE_DIR);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            abierto = true;
        } catch (ActivityNotFoundException e) {
            // 2) MIUI y otras capas no abren carpetas con ACTION_VIEW: se usa el selector
            //    de documentos, que todos los fabricantes muestran, apuntando a la carpeta.
            try {
                Intent tree = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    Uri inicial = DocumentsContract.buildTreeDocumentUri("com.android.externalstorage.documents",
                        existe ? "primary:" + ruta : "primary:Documents");
                    tree.putExtra(DocumentsContract.EXTRA_INITIAL_URI, inicial);
                }
                tree.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(tree);
                abierto = true;
            } catch (Exception e2) {
                // se queda abierto = false
            }
        } catch (Exception e) {
            // se queda abierto = false
        }

        JSObject ret = new JSObject();
        ret.put("existe", existe);
        ret.put("abierto", abierto);
        call.resolve(ret);
    }

    /** Abre la pantalla de ajustes de AulaPro, donde se activan los permisos (micrófono, cámara) que se negaron. */
    @PluginMethod
    public void openAppSettings(PluginCall call) {
        try {
            Intent intent = new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.fromParts("package", getContext().getPackageName(), null));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    /** El tamaño de las letras: el zoom de texto del WebView, entre el 80 % y el 160 %. */
    @PluginMethod
    public void setTextZoom(PluginCall call) {
        final int percent = Math.max(80, Math.min(160, call.getInt("percent", 100)));
        getActivity().runOnUiThread(() -> {
            try {
                getBridge().getWebView().getSettings().setTextZoom(percent);
                call.resolve();
            } catch (Exception e) {
                call.reject(e.getMessage());
            }
        });
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (store.containsAlias(KEY_ALIAS)) {
            return ((KeyStore.SecretKeyEntry) store.getEntry(KEY_ALIAS, null)).getSecretKey();
        }
        KeyGenerator gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        gen.init(new KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .build());
        return gen.generateKey();
    }

    @PluginMethod
    public void secretGet(PluginCall call) {
        String name = call.getString("name", "");
        JSObject ret = new JSObject();
        ret.put("value", "");
        String stored = ALLOWED.contains(name) ? prefs().getString(name, null) : null;
        if (stored != null) {
            try {
                byte[] all = Base64.decode(stored, Base64.NO_WRAP);
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, all, 0, IV_BYTES));
                byte[] plain = cipher.doFinal(all, IV_BYTES, all.length - IV_BYTES);
                ret.put("value", new String(plain, StandardCharsets.UTF_8));
            } catch (Exception e) {
                // Dañado o de otra instalación: como si no hubiera clave
            }
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void secretSet(PluginCall call) {
        String name = call.getString("name", "");
        String value = call.getString("value", "");
        JSObject ret = new JSObject();
        if (!ALLOWED.contains(name)) {
            ret.put("ok", false);
            call.resolve(ret);
            return;
        }
        try {
            if (value == null || value.isEmpty()) {
                prefs().edit().remove(name).apply();
            } else {
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.ENCRYPT_MODE, key());
                byte[] iv = cipher.getIV();
                byte[] enc = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
                byte[] all = new byte[iv.length + enc.length];
                System.arraycopy(iv, 0, all, 0, iv.length);
                System.arraycopy(enc, 0, all, iv.length, enc.length);
                prefs().edit().putString(name, Base64.encodeToString(all, Base64.NO_WRAP)).apply();
            }
            ret.put("ok", true);
        } catch (Exception e) {
            ret.put("ok", false);
        }
        call.resolve(ret);
    }

    /* ── Sala de alumnos ── */

    private static final int ROOM_PORT = 8080;
    private static final int ROOM_PORT_TRIES = 12;
    private RoomServer room;

    private RoomServer room() {
        if (room == null) {
            room = new RoomServer((id, method, path, query, body) -> {
                JSObject req = new JSObject();
                req.put("id", id);
                req.put("method", method);
                req.put("path", path);
                req.put("query", query);
                req.put("body", body);
                notifyListeners("roomRequest", req);
            });
        }
        return room;
    }

    /** Con la sala abierta la pantalla no se apaga: si se apaga, la wifi se duerme y los móviles pierden la sala. */
    private void keepScreenOn(boolean on) {
        getActivity().runOnUiThread(() -> {
            if (on) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        });
    }

    @PluginMethod
    public void roomStart(PluginCall call) {
        try {
            int port = room().start(ROOM_PORT, ROOM_PORT_TRIES);
            keepScreenOn(true);
            JSObject ret = new JSObject();
            ret.put("port", port);
            ret.put("addresses", RoomServer.addresses());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void roomStop(PluginCall call) {
        if (room != null) room.stop();
        keepScreenOn(false);
        call.resolve();
    }

    @PluginMethod
    public void roomAddresses(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("addresses", RoomServer.addresses());
        call.resolve(ret);
    }

    @PluginMethod
    public void roomRespond(PluginCall call) {
        if (room != null) {
            room.respond(call.getString("id", ""), call.getInt("status", 200),
                call.getString("type", "text/plain; charset=utf-8"), call.getString("body", ""));
        }
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        if (room != null) room.stop();
    }
}
