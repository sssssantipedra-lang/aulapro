package android.print;

import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;

/**
 * Escribe un documento (el de un WebView) como PDF en un archivo, sin el
 * diálogo de impresión del sistema.
 *
 * Está en el paquete android.print a propósito: las clases de respuesta
 * (LayoutResultCallback y WriteResultCallback) tienen el constructor visible
 * solo dentro de ese paquete, y sin ellas no se puede pedir al adaptador de
 * impresión que escriba. Es la forma habitual de hacerlo. Si en algún
 * dispositivo fallara, AulaNativePlugin.savePdfInDocuments lo cuenta como error
 * y la aplicación vuelve al diálogo del sistema.
 */
public class PdfPrint {

    public interface Listener {
        void onDone();
        void onError(String message);
    }

    private final PrintAttributes attributes;

    public PdfPrint(PrintAttributes attributes) {
        this.attributes = attributes;
    }

    public void write(final PrintDocumentAdapter adapter, final ParcelFileDescriptor destination, final Listener listener) {
        adapter.onLayout(null, attributes, null, new PrintDocumentAdapter.LayoutResultCallback() {
            @Override
            public void onLayoutFinished(PrintDocumentInfo info, boolean changed) {
                adapter.onWrite(new PageRange[] { PageRange.ALL_PAGES }, destination, new CancellationSignal(),
                    new PrintDocumentAdapter.WriteResultCallback() {
                        @Override
                        public void onWriteFinished(PageRange[] pages) {
                            listener.onDone();
                        }

                        @Override
                        public void onWriteFailed(CharSequence error) {
                            listener.onError(error == null ? "No se pudo escribir el PDF" : error.toString());
                        }
                    });
            }

            @Override
            public void onLayoutFailed(CharSequence error) {
                listener.onError(error == null ? "No se pudo preparar el PDF" : error.toString());
            }
        }, null);
    }
}
