package es.aulapro.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Imprimir / guardar en PDF y la clave de la IA cifrada (ver AulaNativePlugin)
        registerPlugin(AulaNativePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
