/**
 * Traducciones de la mejora «trimestres» (tanda de mejoras del 20-11-2026). La clave es el texto en castellano,
 * como en el resto de la app. Cada mejora tiene su archivo para que varias se puedan hacer a la vez.
 */
export const EN: Record<string, string> = {
  // El selector de evaluación
  '1.ª': 'T1',
  '2.ª': 'T2',
  '3.ª': 'T3',
  'Curso@@evaluacion': 'Year',
  'la de hoy': 'the current one',
  'Cambiar las fechas de esta evaluación': 'Change the dates of this term',
  '{desde} a {hasta}': '{desde} to {hasta}',
  'Cámbialas si tu centro cierra la evaluación otro día: las evaluaciones vecinas se ajustan solas y las fechas se recuerdan en este dispositivo.':
    'Change them if your school closes the term on another day: the neighbouring terms adjust themselves and the dates are remembered on this device.',
  'El cuaderno enseña y cuenta las actividades y las anotaciones de estas fechas.': 'The gradebook shows and counts the activities and the notes of these dates.',
  'El acta cuenta las notas y las evaluaciones de estas fechas.': 'The report counts the grades and the assessments of these dates.',
  // Cómo se nombra cada evaluación dentro de una frase
  'la 1.ª evaluación': 'Term 1',
  'la 2.ª evaluación': 'Term 2',
  'la 3.ª evaluación': 'Term 3',
  'todo el curso': 'the whole year',
  // El cuaderno por evaluaciones
  'No hay actividades en {evaluacion}.': 'There are no activities in {evaluacion}.',
  'Va del {desde} al {hasta}. Lo que añadas ahora caerá en ella, y lo de las demás evaluaciones sigue en su sitio.':
    'It runs from {desde} to {hasta}. What you add now will fall in it, and the other terms keep what they had.',
  'Ver todo el curso': 'See the whole year',
  'Ver todas las actividades del curso ({n})': 'See all the activities of the year ({n})',
  'Ocultar las actividades del curso': 'Hide the activities of the year',
  'La nota final de curso, con la regla elegida arriba': 'The final grade of the year, with the rule chosen above',
  'La nota de {evaluacion}': 'The grade for {evaluacion}',
  'Final@@nota': 'Final',
  '✅ Añadida. Por su fecha cuenta en {evaluacion}: cambia de evaluación para verla.': '✅ Added. By its date it counts in {evaluacion}: switch term to see it.',
  '✅ Añadida. Su fecha es de otro curso: solo sale en «Curso».': '✅ Added. Its date belongs to another school year: it only shows under “Year”.',
  '✅ Actualizada. Por su fecha ahora cuenta en {evaluacion}.': '✅ Updated. By its date it now counts in {evaluacion}.',
  'Sin fecha, sale en todas las evaluaciones.': 'With no date, it shows in every term.',
  'Esa fecha es de otro curso: no cuenta en ninguna evaluación de este, solo sale en «Curso».':
    'That date belongs to another school year: it does not count in any term of this one and only shows under “Year”.',
  'Por su fecha, cuenta en {evaluacion}.': 'By its date, it counts in {evaluacion}.',
  'Cuenta un {pct}% de «{cat}» en su evaluación, un {final}% de la nota de esa evaluación.':
    'It counts {pct}% of “{cat}” in its term, {final}% of the grade for that term.',
  'Lo que cuenta cada nota dentro de la categoría se cambia en su evaluación (1.ª, 2.ª o 3.ª): con la media de las evaluaciones, las notas se reparten el peso dentro de cada una.':
    'How much each grade counts within the category is changed in its term (T1, T2 or T3): with the average of the terms, grades share the weight within each one.',
  // La nota final de curso
  'Cómo sale la nota final de curso': 'How the final grade of the year is worked out',
  'Nota final de curso': 'Final grade of the year',
  'Evaluación continua': 'Continuous assessment',
  'Media de las evaluaciones': 'Average of the terms',
  'Usar esta regla en todas mis clases': 'Use this rule in all my classes',
  '✅ Todas tus clases calculan la nota final con la media de las evaluaciones': '✅ All your classes work out the final grade with the average of the terms',
  '✅ Todas tus clases calculan la nota final con evaluación continua': '✅ All your classes work out the final grade with continuous assessment',
  'La nota final es la media de las notas de las tres evaluaciones, cada una con su peso:': 'The final grade is the average of the grades of the three terms, each with its weight:',
  'Peso de la {evaluacion} en la nota final (%)': 'Weight of {evaluacion} in the final grade (%)',
  'Suman {n}%: cada evaluación cuenta en proporción (lo ideal es 100%)': 'They add up to {n}%: each term counts in proportion (100% is ideal)',
  'Todas las notas del curso cuentan juntas, con el peso de cada categoría, como si fuera una sola evaluación. Es lo que sale si no eliges otra cosa.':
    'All the grades of the year count together, with the weight of each category, as if it were a single term. It is what you get unless you choose otherwise.',
  'El peso de cada evaluación debe ser un número entre 0 y 100, y alguna tiene que contar.': 'The weight of each term must be a number between 0 and 100, and at least one has to count.',
  'Ver la {evaluacion}': 'See {evaluacion}',
  'La {evaluacion} aún no tiene notas: la final es provisional y sale de las demás.': '{evaluacion} has no grades yet: the final grade is provisional and comes from the others.',
  'Solo una evaluación tiene notas: de momento, la final es la suya.': 'Only one term has grades: for now, the final grade is that one.',
  // El acta
  'Nota final: media de las evaluaciones ({pesos}).': 'Final grade: average of the terms ({pesos}).',
  'Nota final: evaluación continua, con todas las notas del curso.': 'Final grade: continuous assessment, with all the grades of the year.',
  'Cambiar la regla en el Cuaderno': 'Change the rule in the Gradebook',
};

export const CA: Record<string, string> = {
  '1.ª': '1a',
  '2.ª': '2a',
  '3.ª': '3a',
  'Curso@@evaluacion': 'Curs',
  'la de hoy': 'la d’avui',
  'Cambiar las fechas de esta evaluación': 'Canviar les dates d’aquesta avaluació',
  '{desde} a {hasta}': '{desde} a {hasta}',
  'Cámbialas si tu centro cierra la evaluación otro día: las evaluaciones vecinas se ajustan solas y las fechas se recuerdan en este dispositivo.':
    'Canvia-les si el teu centre tanca l’avaluació un altre dia: les avaluacions veïnes s’ajusten soles i les dates es recorden en aquest dispositiu.',
  'El cuaderno enseña y cuenta las actividades y las anotaciones de estas fechas.': 'El quadern mostra i compta les activitats i les anotacions d’aquestes dates.',
  'El acta cuenta las notas y las evaluaciones de estas fechas.': 'L’acta compta les notes i les avaluacions d’aquestes dates.',
  'la 1.ª evaluación': 'la 1a avaluació',
  'la 2.ª evaluación': 'la 2a avaluació',
  'la 3.ª evaluación': 'la 3a avaluació',
  'todo el curso': 'tot el curs',
  'No hay actividades en {evaluacion}.': 'No hi ha activitats en {evaluacion}.',
  'Va del {desde} al {hasta}. Lo que añadas ahora caerá en ella, y lo de las demás evaluaciones sigue en su sitio.':
    'Va del {desde} al {hasta}. El que afegeixis ara hi caurà, i el de les altres avaluacions continua al seu lloc.',
  'Ver todo el curso': 'Veure tot el curs',
  'Ver todas las actividades del curso ({n})': 'Veure totes les activitats del curs ({n})',
  'Ocultar las actividades del curso': 'Amagar les activitats del curs',
  'La nota final de curso, con la regla elegida arriba': 'La nota final de curs, amb la regla triada a dalt',
  'La nota de {evaluacion}': 'La nota de {evaluacion}',
  'Final@@nota': 'Final',
  '✅ Añadida. Por su fecha cuenta en {evaluacion}: cambia de evaluación para verla.': '✅ Afegida. Per la data compta en {evaluacion}: canvia d’avaluació per veure-la.',
  '✅ Añadida. Su fecha es de otro curso: solo sale en «Curso».': '✅ Afegida. La data és d’un altre curs: només surt en «Curs».',
  '✅ Actualizada. Por su fecha ahora cuenta en {evaluacion}.': '✅ Actualitzada. Per la data ara compta en {evaluacion}.',
  'Sin fecha, sale en todas las evaluaciones.': 'Sense data, surt en totes les avaluacions.',
  'Esa fecha es de otro curso: no cuenta en ninguna evaluación de este, solo sale en «Curso».':
    'Aquesta data és d’un altre curs: no compta en cap avaluació d’aquest, només surt en «Curs».',
  'Por su fecha, cuenta en {evaluacion}.': 'Per la data, compta en {evaluacion}.',
  'Cuenta un {pct}% de «{cat}» en su evaluación, un {final}% de la nota de esa evaluación.':
    'Compta un {pct}% de «{cat}» en la seva avaluació, un {final}% de la nota d’aquella avaluació.',
  'Lo que cuenta cada nota dentro de la categoría se cambia en su evaluación (1.ª, 2.ª o 3.ª): con la media de las evaluaciones, las notas se reparten el peso dentro de cada una.':
    'El que compta cada nota dins de la categoria es canvia en la seva avaluació (1a, 2a o 3a): amb la mitjana de les avaluacions, les notes es reparteixen el pes dins de cadascuna.',
  'Cómo sale la nota final de curso': 'Com surt la nota final de curs',
  'Nota final de curso': 'Nota final de curs',
  'Evaluación continua': 'Avaluació contínua',
  'Media de las evaluaciones': 'Mitjana de les avaluacions',
  'Usar esta regla en todas mis clases': 'Fer servir aquesta regla en totes les meves classes',
  '✅ Todas tus clases calculan la nota final con la media de las evaluaciones': '✅ Totes les teves classes calculen la nota final amb la mitjana de les avaluacions',
  '✅ Todas tus clases calculan la nota final con evaluación continua': '✅ Totes les teves classes calculen la nota final amb avaluació contínua',
  'La nota final es la media de las notas de las tres evaluaciones, cada una con su peso:': 'La nota final és la mitjana de les notes de les tres avaluacions, cadascuna amb el seu pes:',
  'Peso de la {evaluacion} en la nota final (%)': 'Pes de la {evaluacion} en la nota final (%)',
  'Suman {n}%: cada evaluación cuenta en proporción (lo ideal es 100%)': 'Sumen {n}%: cada avaluació compta en proporció (l’ideal és 100%)',
  'Todas las notas del curso cuentan juntas, con el peso de cada categoría, como si fuera una sola evaluación. Es lo que sale si no eliges otra cosa.':
    'Totes les notes del curs compten juntes, amb el pes de cada categoria, com si fos una sola avaluació. És el que surt si no tries una altra cosa.',
  'El peso de cada evaluación debe ser un número entre 0 y 100, y alguna tiene que contar.': 'El pes de cada avaluació ha de ser un nombre entre 0 i 100, i alguna ha de comptar.',
  'Ver la {evaluacion}': 'Veure la {evaluacion}',
  'La {evaluacion} aún no tiene notas: la final es provisional y sale de las demás.': 'La {evaluacion} encara no té notes: la final és provisional i surt de les altres.',
  'Solo una evaluación tiene notas: de momento, la final es la suya.': 'Només una avaluació té notes: de moment, la final és la seva.',
  'Nota final: media de las evaluaciones ({pesos}).': 'Nota final: mitjana de les avaluacions ({pesos}).',
  'Nota final: evaluación continua, con todas las notas del curso.': 'Nota final: avaluació contínua, amb totes les notes del curs.',
  'Cambiar la regla en el Cuaderno': 'Canviar la regla al Quadern',
};
