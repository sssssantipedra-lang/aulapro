/**
 * Batería adversarial de contacto, salud y documentos (auditoría del 5-11-2026). Nombres inventados. Cada caso dice qué
 * no puede quedar en lo que va a la IA. Lo que no se puede reconocer está en el último bloque, a la vista.
 */
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { esFechaDeNacimiento, leerDocumento, quitarDatosDeSalud, textoDeDocumento, textoLibreParaIA } from './documentoParaIA';
import { buildPseudonymizer } from '../services/privacy';

const p = buildPseudonymizer([{ id: '1', name: 'Lucía Pérez Navarro' }, { id: '2', name: 'Marco Rodríguez Gil' }]);
const doc = (t: string) => textoDeDocumento(t, x => p.mask(x));
const hoy = new Date(2026, 10, 5);
const libre = (t: string) => textoLibreParaIA(t);

type Caso = [string, string, string[]];
const prueba = (fn: (t: string) => string, casos: Caso[]) => {
  for (const [nombre, entrada, prohibidas] of casos) {
    it(nombre, () => {
      const salida = fn(entrada);
      for (const x of prohibidas) expect(salida, salida).not.toContain(x);
    });
  }
};

describe('quitarDatosDeContacto (texto libre sobre el alumnado)', () => {
  prueba(libre, [
    ['teléfonos de otros países con prefijo', 'madre +44 7911 123456; padre 0033 6 12 34 56 78', ['7911', '123456', '12 34 56 78']],
    ['teléfonos con el prefijo entre paréntesis', 'tel (+34) 612 345 678 y (96) 123 45 67', ['612', '345', '123 45 67']],
    ['teléfonos con cualquier separación', 'wasap: 612.345.678 // 612-34-56-78 // 612345678 // 96 12 34 567', ['612', '567']],
    ['correos disimulados', 'lucia.perez (at) gmail.com, lucia [arroba] gmail . com', ['lucia.perez', 'gmail']],
    ['DNI y NIE en minúscula, con espacios y con puntos', 'DNI 12345678z; 12345678 Z; x-1234567-l; Y1234567L; 12.345.678z', ['12345678', '1234567', '12.345.678']],
    ['fecha de nacimiento sin etiqueta, de hace entre 3 y 22 años', 'Lucía (3/5/2015) y nació el 03-05-2015; nacida 3 de mayo de 2015; birth: 2015-05-03', ['2015']],
    ['fecha de nacimiento con etiquetas raras', 'F.N.: 3/5/15; Fecha Nac: 3-5-2015; DOB 03/05/2015; Nacimiento 3.5.2015; va néixer el 3/5/2015', ['3/5/15', '3-5-2015', '03/05/2015', '3.5.2015', '3/5/2015']],
    ['expediente, NIA, SIP y tarjeta sanitaria aunque sean cortos', 'Exp. 2023/0456; NIA 1234567; SIP 12345678; expediente nº 4567-B; tarjeta sanitaria 123 456 78 90', ['2023/0456', '1234567', '12345678', '4567', '123 456']],
    ['IBAN', 'cuenta ES91 2100 0418 4502 0005 1332', ['2100', '1332']],
    ['dirección en texto libre', 'vive en C/ Mayor 12, 3ºB, 46001 Valencia; calle de la Paz nº 4', ['Mayor 12', 'Paz']],
    ['centro educativo por su nombre', 'viene del CEIP Las Acacias de Burjassot; antes IES Pere Boïl; Escola Pau Vila', ['Acacias', 'Boïl', 'Pau Vila']],
    ['usuarios de redes', 'instagram @lucia_pn_2015 y tiktok @marquitos.rg', ['lucia_pn', 'marquitos']],
  ]);

  it('no quita las fechas del curso ni los números cortos', () => {
    expect(textoLibreParaIA('Examen el 15/03/2027; reunión 12/11/2026; nota 8,5; aula 12; lista 23')).toBe('Examen el 15/03/2027; reunión 12/11/2026; nota 8,5; aula 12; lista 23');
    expect(esFechaDeNacimiento('03/05/2015', hoy)).toBe(true);
    expect(esFechaDeNacimiento('03/05/2025', hoy)).toBe(false);
    expect(esFechaDeNacimiento('03/05/1999', hoy)).toBe(false);
    expect(esFechaDeNacimiento('31/13/2015', hoy)).toBe(false);
  });
});

describe('quitarDatosDeSalud, ampliado', () => {
  prueba(libre, [
    ['siglas en minúscula (las que no son otra palabra) y con puntos', 'tiene tdah; T.D.A.H. y T.E.A.; T.E.L.; TEA grado 1', ['tdah', 'T.D.A.H', 'T.E.A', 'T.E.L', 'grado 1']],
    ['déficit atencional, auditivo, visual', 'déficit atencional sin hiperactividad; déficit auditivo; déficit visual', ['atencional', 'auditivo', 'visual']],
    ['medicación por su nombre', 'toma Medikinet por la mañana; Rubifen; atomoxetina; Ritalin; melatonina; insulina; Ventolín; lleva EpiPen; se toma la pastilla en el comedor', ['Medikinet', 'atomoxetina', 'Ritalin', 'melatonina', 'insulina', 'Ventolín', 'EpiPen', 'pastilla']],
    ['alergias e intolerancias', 'alergia a los frutos secos; alérgica al látex; intolerancia a la lactosa; celíaca; anafilaxia', ['alergia', 'alérgica', 'frutos secos', 'lactosa', 'anafilaxia']],
    ['salud mental', 'ansiedad; ataques de pánico; fobia escolar; mutismo selectivo; autolesiones; ideación suicida; anorexia; TCA', ['ansiedad', 'pánico', 'fobia', 'mutismo', 'autolesiones', 'suicida', 'anorexia', 'TCA']],
    ['habla y lenguaje', 'tartamudea; dislalia; disartria; va al logopeda; terapia ocupacional; fisioterapia', ['tartamud', 'dislalia', 'disartria', 'logopeda', 'terapia']],
    ['especialistas y servicios', 'la ve el psicólogo; psicoterapia; neurólogo; pediatra; va a la USMIJ; CSMIJ; atención temprana', ['psicólogo', 'neurólogo', 'USMIJ', 'CSMIJ', 'temprana']],
    ['el síndrome sin la palabra «síndrome»', 'tiene Down; niño Down; síndrome de down', ['Down', 'down']],
    ['categorías de necesidades', 'altas capacidades; AACC; alumno NEAE; ACNEE; NEE; dictamen de escolarización', ['altas capacidades', 'AACC', 'NEAE', 'ACNEE', 'dictamen']],
    ['retrasos del desarrollo', 'retraso madurativo; retraso del lenguaje; retraso psicomotor', ['madurativo', 'retraso del lenguaje', 'psicomotor']],
    ['enfermedad y hospital', 'enfermedad crónica; ingresado en el hospital; operado del corazón; quimioterapia; leucemia; convulsiones; crisis epilépticas', ['enfermedad', 'hospital', 'quimio', 'leucemia', 'convulsiones', 'epilépticas', 'corazón']],
    ['movilidad', 'silla de ruedas; muletas; prótesis', ['silla de ruedas', 'muletas', 'prótesis']],
    ['catalán', 'té TDAH; al·lèrgia al gluten; malaltia; cadira de rodes; ansietat; va al psicòleg; tartamudeja', ['al·lèrgia', 'malaltia', 'cadira', 'ansietat', 'psicòleg', 'tartamud']],
    ['inglés', 'has asthma; allergic to nuts; anxiety; wheelchair; sees a psychologist; speech therapist; on Ritalin; gifted', ['asthma', 'allergic', 'anxiety', 'wheelchair', 'psychologist', 'therapist', 'Ritalin', 'gifted']],
    ['grado y porcentaje', 'dislexia moderada; TEA grado 1; discapacidad intelectual leve (33%)', ['dislexia', 'TEA', 'grado 1', '33']],
  ]);

  it('no toca «TIC», «toc» en catalán ni «tea» en inglés (son otras palabras), ni la descripción de lo que necesita', () => {
    expect(quitarDatosDeSalud('competencia TIC; fa un toc; a cup of tea; necesita instrucciones cortas y apoyo visual')).toBe('competencia TIC; fa un toc; a cup of tea; necesita instrucciones cortas y apoyo visual');
    expect(quitarDatosDeSalud('Pedagogía Terapéutica; intolerante a la frustración')).toBe('Pedagogía Terapéutica; intolerante a la frustración');
  });
});

describe('textoDeDocumento, documentos del alumnado', () => {
  prueba(doc, [
    ['etiquetas del alumno en tres idiomas', 'ALUMNO/A: Carla Sanz Mir\nNombre del alumno: Pedro Gil Rey\nNom de l\'alumne: Jordi Puig', ['Carla', 'Sanz', 'Pedro', 'Jordi']],
    ['familia', 'Padres: Elena Mir y Luis Sanz\nHermanos: Dani (3º)\nAbuela: Pilar\nRepresentante legal: Luis Sanz\nPersona de contacto: Elena', ['Elena', 'Luis', 'Dani', 'Pilar']],
    ['profesionales y quien firma', 'Orientadora: Marta Gil\nLogopeda: Eva Roca\nPediatra: Dr. Jaime Soto\nJefa de estudios: Inés Vila\nProfesora de PT: Sara Bou\nElaborado por: Marta Gil\nFirma: Eva Roca', ['Marta', 'Eva', 'Jaime', 'Inés', 'Sara', 'Bou']],
    ['apellidos, nombre', 'Apellidos y nombre: Sanz Mir, Carla\nApellidos, Nombre: Gil Rey, Pedro', ['Sanz', 'Carla', 'Gil Rey']],
    ['etiqueta sin dos puntos, como una tabla de PDF', 'Nombre y apellidos  Carla Sanz Mir\nFecha de nacimiento  03/05/2015', ['Carla', '03/05/2015']],
    ['dos columnas en una línea', 'Nombre: Carla Sanz Mir     Fecha de nacimiento: 3/5/2015     Tutor/a: D. Andrés Ferrer\nNivel / Curso: 4º   Centro: CEIP Las Acacias   Localidad: Burjassot', ['Carla', '2015', 'Andrés', 'Acacias', 'Burjassot']],
    ['el nombre vuelve en el texto y en el pie de página', 'Nombre: Carla Sanz Mir\nTexto. Carla presenta dificultades. La familia de Carla colabora.\nInforme de Carla Sanz Mir – pág. 2', ['Carla', 'Sanz']],
    ['tratamientos', 'D.ª Marta Gil, Prof. Soto, Profa. Vila, Hno. Pedro, Dª. Eva Roca', ['Marta', 'Soto', 'Vila', 'Eva']],
    ['centro en el texto', 'escolarizado en el CEIP Las Acacias desde 2020, antes en el Colegio San José', ['Acacias', 'San José']],
    ['código postal y teléfono de la madre', 'Domicilio: Calle Mayor 12\nCódigo postal: 46100\nC.P.: 46100\nTeléfono madre: 612 345 678', ['Mayor', '46100', '612']],
    ['edad con la fecha de nacimiento entre paréntesis', 'Edad: 10 años (03/05/2015)\nCurso: 4º', ['2015']],
    ['tabla con separadores (CSV de la lista de clase)', 'Nombre;Apellidos;Fecha nac.;Tel\nCarla;Sanz Mir;03/05/2015;612345678\nPedro;Gil Rey;01/01/2016;600000000', ['Carla', 'Sanz', '2015', '612', 'Pedro', 'Gil Rey']],
    ['identificadores del alumno', 'NIA: 1234567\nSIP: 12345678\nNº expediente: 23/0456', ['1234567', '12345678', '0456']],
    ['el alumno de la lista con un apellido que la app no tiene', 'Lucía Pérez Navarro Ortiz presenta; Pérez Navarro, Lucía', ['Lucía', 'Pérez', 'Ortiz']],
  ]);

  it('conserva lo pedagógico: curso, orientaciones y lo que necesita en el aula', () => {
    const r = doc('Nombre: Carla Sanz Mir\nCurso: 4º de Primaria\nOrientaciones: instrucciones cortas, apoyo visual y tiempo extra en las pruebas.\nFirmado: Marta Gil');
    expect(r).toContain('Curso: 4º de Primaria');
    expect(r).toContain('instrucciones cortas, apoyo visual y tiempo extra');
    expect(r).not.toContain('Carla');
    expect(r).not.toContain('Marta');
  });

  it('un tratamiento no arrastra la línea siguiente («Dr. Jaime Soto» y debajo «Jefa de estudios:»)', () => {
    const r = doc('Pediatra: Dr. Jaime Soto\nJefa de estudios: Inés Vila');
    expect(r).toContain('Jefa de estudios:');
    expect(r).not.toContain('Inés');
  });

  it('un Word con control de cambios: lo borrado no llega (ni el nombre que había antes)', async () => {
    const zip = new JSZip();
    zip.file('word/document.xml', '<w:document><w:body><w:p><w:r><w:t>Informe de la alumna</w:t></w:r><w:del w:id="1"><w:r><w:delText>Carla Sanz Mir</w:delText></w:r></w:del><w:ins><w:r><w:t xml:space="preserve"> del grupo</w:t></w:r></w:ins></w:p></w:body></w:document>');
    const texto = await leerDocumento(new File([await zip.generateAsync({ type: 'arraybuffer' })], 'informe.docx'));
    expect(texto).toContain('Informe de la alumna del grupo');
    expect(texto).not.toContain('Carla');
  });
});

describe('lo que no se puede reconocer (y la privacidad lo dice)', () => {
  it('una descripción clínica sin palabras clave, un nombre no listado sin etiqueta ni tratamiento, un apodo', () => {
    expect(textoLibreParaIA('le cuesta mantener la mirada y repite frases; aletea cuando se emociona')).toBe('le cuesta mantener la mirada y repite frases; aletea cuando se emociona');
    expect(doc('Hoy Carla ha venido contenta.')).toBe('Hoy Carla ha venido contenta.');
    expect(doc('Lu y Marquitos se han peleado.')).toBe('Lu y Marquitos se han peleado.');
  });
});
