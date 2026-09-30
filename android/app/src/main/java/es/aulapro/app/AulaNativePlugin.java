package es.aulapro.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.print.PrintAttributes;
import android.print.PrintManager;
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

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.Collections;
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
    private static final Set<String> ALLOWED = Collections.singleton("gemini");

    /** El documento que se está imprimiendo: sin una referencia viva, Android lo libera a mitad. */
    private WebView printing;

    @PluginMethod
    public void print(PluginCall call) {
        final String html = call.getString("html", "");
        final String name = call.getString("name", "Aula Pro");
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
