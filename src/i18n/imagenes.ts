/**
 * Textos de las imágenes en las sesiones (25-10-2026): `components/sesiones/ImagenesSesion.tsx`
 * y el PDF de la sesión (`services/exportSesionEF.ts`). Se suman a `EN` en `core.ts`
 * y a `CA` en `ca.ts`.
 */
export const IMAGENES_EN: Record<string, string> = {
  'Imágenes': 'Images',
  'Pega una imagen con Ctrl+V, arrástrala al editor o elígela de un archivo.': 'Paste an image with Ctrl+V, drag it onto the editor or choose it from a file.',
  'Añadiendo…': 'Adding…',
  'Se reducen para que los datos no pesen. Guarda la sesión para conservarlas: el borrador automático no las incluye.': 'They are shrunk so your data stays light. Save the session to keep them: the automatic draft does not include them.',
  'Suelta la imagen para añadirla': 'Drop the image to add it',
  'Imagen {n} de la sesión': 'Image {n} of the session',
  'Pie de foto (opcional)': 'Caption (optional)',
  'Pie de la imagen {n}': 'Caption of image {n}',
  'Mover antes': 'Move earlier',
  'Mover después': 'Move later',
  'Quitar la imagen {n}': 'Remove image {n}',
  'Solo caben {n} imágenes en una sesión.': 'A session holds at most {n} images.',
  'No se ha podido leer {n} imagen.': '{n} image could not be read.',
  'No se han podido leer {n} imágenes.': '{n} images could not be read.',
  'No se ha podido traer la imagen de esa web. Guárdala en tu equipo y arrástrala aquí.': 'The image could not be fetched from that website. Save it to your device and drag it here.',
};

export const IMAGENES_CA: Record<string, string> = {
  'Imágenes': 'Imatges',
  'Pega una imagen con Ctrl+V, arrástrala al editor o elígela de un archivo.': 'Enganxa una imatge amb Ctrl+V, arrossega-la a l’editor o tria-la d’un arxiu.',
  'Añadiendo…': 'Afegint…',
  'Se reducen para que los datos no pesen. Guarda la sesión para conservarlas: el borrador automático no las incluye.': 'Es redueixen perquè les dades no pesin. Desa la sessió per conservar-les: l’esborrany automàtic no les inclou.',
  'Suelta la imagen para añadirla': 'Deixa anar la imatge per afegir-la',
  'Imagen {n} de la sesión': 'Imatge {n} de la sessió',
  'Pie de foto (opcional)': 'Peu de foto (opcional)',
  'Pie de la imagen {n}': 'Peu de la imatge {n}',
  'Mover antes': 'Moure abans',
  'Mover después': 'Moure després',
  'Quitar la imagen {n}': 'Treure la imatge {n}',
  'Solo caben {n} imágenes en una sesión.': 'Només hi caben {n} imatges en una sessió.',
  'No se ha podido leer {n} imagen.': 'No s’ha pogut llegir {n} imatge.',
  'No se han podido leer {n} imágenes.': 'No s’han pogut llegir {n} imatges.',
  'No se ha podido traer la imagen de esa web. Guárdala en tu equipo y arrástrala aquí.': 'No s’ha pogut portar la imatge d’aquest web. Desa-la al teu equip i arrossega-la aquí.',
};
