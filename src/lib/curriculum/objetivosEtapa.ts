/**
 * Los objetivos de etapa oficiales (16-11-2026, aviso del dueño: una SdA de la Comunitat Valenciana salía con «objetivos de
 * etapa» resumidos o inventados por la IA, como «a) Conocer y comprender las normas de convivencia», cuando el
 * Decreto 106/2022 tiene 17 numerados). Como las competencias y los saberes, la IA solo elige de esta lista y el texto lo
 * pone la app, palabra por palabra.
 *
 * Copiados de la publicación oficial (no se traducen ni se resumen): BOE (versión consolidada) para los reales decretos,
 * DOGV para la Comunitat Valenciana (en castellano y en valenciano), BOCM para Madrid, DOGC para Cataluña (solo en catalán,
 * un mismo artículo para Primaria y ESO) y BOJA para Andalucía. Las demás comunidades, y quien no tiene comunidad, usan
 * los del real decreto, como el resto del currículo. Si una norma cambia sus objetivos, se cambian aquí.
 *
 * GENERADO desde los PDF de docs/Normativa y del BOE: si se corrige un texto, se corrige contra el original.
 */
import type { ComunidadId } from './comunidades';
import type { Etapa } from './index';

type Lista = readonly (readonly [string, string])[];
interface Fuente {
  cita: { es: string; ca: string };
  /** `true`: «1.», «2.»… (Comunitat Valenciana); `false`: «a)», «b)»… */
  numerado: boolean;
  es?: Lista;
  ca?: Lista;
}

const FUENTES: Record<string, Fuente> = {
  "estatal-primaria": {
    cita: {"es": "Real Decreto 157/2022, de 1 de marzo, artículo 7", "ca": "Reial decret 157/2022, d’1 de març, article 7"},
    numerado: false,
    es: [
      ["a", "Conocer y apreciar los valores y las normas de convivencia, aprender a obrar de acuerdo con ellas de forma empática, prepararse para el ejercicio activo de la ciudadanía y respetar los derechos humanos, así como el pluralismo propio de una sociedad democrática."],
      ["b", "Desarrollar hábitos de trabajo individual y de equipo, de esfuerzo y de responsabilidad en el estudio, así como actitudes de confianza en sí mismo, sentido crítico, iniciativa personal, curiosidad, interés y creatividad en el aprendizaje, y espíritu emprendedor."],
      ["c", "Adquirir habilidades para la resolución pacífica de conflictos y la prevención de la violencia, que les permitan desenvolverse con autonomía en el ámbito escolar y familiar, así como en los grupos sociales con los que se relacionan."],
      ["d", "Conocer, comprender y respetar las diferentes culturas y las diferencias entre las personas, la igualdad de derechos y oportunidades de hombres y mujeres y la no discriminación de personas por motivos de etnia, orientación o identidad sexual, religión o creencias, discapacidad u otras condiciones."],
      ["e", "Conocer y utilizar de manera apropiada la lengua castellana y, si la hubiere, la lengua cooficial de la comunidad autónoma y desarrollar hábitos de lectura."],
      ["f", "Adquirir en, al menos, una lengua extranjera la competencia comunicativa básica que les permita expresar y comprender mensajes sencillos y desenvolverse en situaciones cotidianas."],
      ["g", "Desarrollar las competencias matemáticas básicas e iniciarse en la resolución de problemas que requieran la realización de operaciones elementales de cálculo, conocimientos geométricos y estimaciones, así como ser capaces de aplicarlos a las situaciones de su vida cotidiana."],
      ["h", "Conocer los aspectos fundamentales de las Ciencias de la Naturaleza, las Ciencias Sociales, la Geografía, la Historia y la Cultura."],
      ["i", "Desarrollar las competencias tecnológicas básicas e iniciarse en su utilización, para el aprendizaje, desarrollando un espíritu crítico ante su funcionamiento y los mensajes que reciben y elaboran."],
      ["j", "Utilizar diferentes representaciones y expresiones artísticas e iniciarse en la construcción de propuestas visuales y audiovisuales."],
      ["k", "Valorar la higiene y la salud, aceptar el propio cuerpo y el de los otros, respetar las diferencias y utilizar la educación física, el deporte y la alimentación como medios para favorecer el desarrollo personal y social."],
      ["l", "Conocer y valorar los animales más próximos al ser humano y adoptar modos de comportamiento que favorezcan la empatía y su cuidado."],
      ["m", "Desarrollar sus capacidades afectivas en todos los ámbitos de la personalidad y en sus relaciones con las demás personas, así como una actitud contraria a la violencia, a los prejuicios de cualquier tipo y a los estereotipos sexistas."],
      ["n", "Desarrollar hábitos cotidianos de movilidad activa autónoma saludable, fomentando la educación vial y actitudes de respeto que incidan en la prevención de los accidentes de tráfico."],
    ],
  },
  "estatal-eso": {
    cita: {"es": "Real Decreto 217/2022, de 29 de marzo, artículo 7", "ca": "Reial decret 217/2022, de 29 de març, article 7"},
    numerado: false,
    es: [
      ["a", "Asumir responsablemente sus deberes, conocer y ejercer sus derechos en el respeto a las demás personas, practicar la tolerancia, la cooperación y la solidaridad entre las personas y grupos, ejercitarse en el diálogo afianzando los derechos humanos como valores comunes de una sociedad plural y prepararse para el ejercicio de la ciudadanía democrática."],
      ["b", "Desarrollar y consolidar hábitos de disciplina, estudio y trabajo individual y en equipo como condición necesaria para una realización eficaz de las tareas del aprendizaje y como medio de desarrollo personal."],
      ["c", "Valorar y respetar la diferencia de sexos y la igualdad de derechos y oportunidades entre ellos. Rechazar los estereotipos que supongan discriminación entre hombres y mujeres."],
      ["d", "Fortalecer sus capacidades afectivas en todos los ámbitos de la personalidad y en sus relaciones con las demás personas, así como rechazar la violencia, los prejuicios de cualquier tipo, los comportamientos sexistas y resolver pacíficamente los conflictos."],
      ["e", "Desarrollar destrezas básicas en la utilización de las fuentes de información para, con sentido crítico, adquirir nuevos conocimientos. Desarrollar las competencias tecnológicas básicas y avanzar en una reflexión ética sobre su funcionamiento y utilización."],
      ["f", "Concebir el conocimiento científico como un saber integrado, que se estructura en distintas disciplinas, así como conocer y aplicar los métodos para identificar los problemas en los diversos campos del conocimiento y de la experiencia."],
      ["g", "Desarrollar el espíritu emprendedor y la confianza en sí mismo, la participación, el sentido crítico, la iniciativa personal y la capacidad para aprender a aprender, planificar, tomar decisiones y asumir responsabilidades."],
      ["h", "Comprender y expresar con corrección, oralmente y por escrito, en la lengua castellana y, si la hubiere, en la lengua cooficial de la comunidad autónoma, textos y mensajes complejos, e iniciarse en el conocimiento, la lectura y el estudio de la literatura."],
      ["i", "Comprender y expresarse en una o más lenguas extranjeras de manera apropiada."],
      ["j", "Conocer, valorar y respetar los aspectos básicos de la cultura y la historia propias y de las demás personas, así como el patrimonio artístico y cultural."],
      ["k", "Conocer y aceptar el funcionamiento del propio cuerpo y el de los otros, respetar las diferencias, afianzar los hábitos de cuidado y salud corporales e incorporar la educación física y la práctica del deporte para favorecer el desarrollo personal y social. Conocer y valorar la dimensión humana de la sexualidad en toda su diversidad. Valorar críticamente los hábitos sociales relacionados con la salud, el consumo, el cuidado, la empatía y el respeto hacia los seres vivos, especialmente los animales, y el medio ambiente, contribuyendo a su conservación y mejora."],
      ["l", "Apreciar la creación artística y comprender el lenguaje de las distintas manifestaciones artísticas, utilizando diversos medios de expresión y representación."],
    ],
  },
  "comunitat-valenciana-primaria": {
    cita: {"es": "Decreto 106/2022, de 5 de agosto, artículo 7", "ca": "Decret 106/2022, de 5 d’agost, article 7"},
    numerado: true,
    es: [
      ["1", "Conocer y apreciar los valores y las normas de convivencia, aprender a obrar de acuerdo con estas de manera empática, prepararse para el ejercicio activo de la ciudadanía y respetar los derechos humanos, así como el pluralismo propio de una sociedad democrática."],
      ["2", "Desarrollar hábitos de trabajo individual y de equipo, de esfuerzo y de responsabilidad en el estudio, así como actitudes de confianza en sí mismo, sentido crítico, iniciativa personal, curiosidad, interés y creatividad en el aprendizaje, y espíritu emprendedor."],
      ["3", "Adquirir habilidades para la resolución pacífica de conflictos y la prevención de la violencia, que les permitan desarrollarse con autonomía en el ámbito escolar y familiar, así como desarrollar actitudes de respeto mutuo en los grupos sociales con los que se relacionen."],
      ["4", "Conocer, comprender y respetar las diferentes culturas y las diferencias entre las personas desde una perspectiva crítica, la igualdad de derechos y oportunidades de hombres y mujeres y la no discriminación de personas por motivos género, cultura, ideología, etnia, orientación o identidad sexual, religión, diversidad funcional u otras condiciones."],
      ["5", "Conocer y utilizar de manera adecuada y efectiva, oralmente y por escrito, las lenguas oficiales: el valenciano, como lengua propia y oficial, y el castellano, como lengua cooficial, y desarrollar hábitos de lectura individual y en contextos de diálogo, debate e intercambio de experiencias."],
      ["6", "Adquirir en lengua extranjera la competencia comunicativa básica que les permita comprender y expresar mensajes sencillos en situaciones cotidianas."],
      ["7", "Desarrollar actitudes positivas hacia la riqueza multilingüe y multicultural presente en la sociedad, donde conviven el valenciano y el castellano, además de otras lenguas familiares."],
      ["8", "Desarrollar las competencias matemáticas básicas e iniciarse en la resolución de problemas que requieran la realización de operaciones elementales de cálculo, conocimientos geométricos y estimaciones, así como ser capaces de aplicarlos a las situaciones de su vida cotidiana."],
      ["9", "Conocer los aspectos fundamentales de las ciencias de la naturaleza, las Ciencias Sociales, la Geografía, la Historia y la Cultura, a través de la asignatura de Conocimiento del Medio Natural, Social y Cultural o en el desarrollo de proyectos interdisciplinarios."],
      ["10", "Desarrollar las competencias tecnológicas básicas e iniciarse en su utilización para el aprendizaje, desarrollando un espíritu crítico ante su funcionamiento y los mensajes que reciben y elaboran."],
      ["11", "Utilizar diferentes representaciones y expresiones artísticas e iniciarse en la construcción de propuestas visuales y audiovisuales, desarrollando la sensibilidad estética y potenciando la creación artística."],
      ["12", "Valorar la higiene y la salud, aceptar el propio cuerpo y el de los otros, respetar las diferencias y utilizar la educación física, el deporte y la alimentación como medios para favorecer el desarrollo personal y social."],
      ["13", "Desarrollar actitudes de respeto y cuidado hacia todos los animales, prestando una atención especial al desarrollo de formas de comportamientos empáticos y correctos con los animales de compañía."],
      ["14", "Desarrollar sus capacidades afectivas en todos los ámbitos de la personalidad y en sus relaciones con otras personas, así como una actitud contraria a la violencia, a los prejuicios de cualquier tipo y a los estereotipos sexistas."],
      ["15", "Desarrollar hábitos cotidianos de movilidad activa autónoma saludable, fomentando la educación viaria y actitudes de respeto que incidan en la prevención de los accidentes de tráfico."],
      ["16", "Desarrollar hábitos de consumo responsable en el contexto de la educación para la sostenibilidad y la protección del medio ambiente, en el camino hacia la transición ecológica."],
      ["17", "Promover actitudes de respeto entre todos los miembros de la comunidad educativa, así como la cooperación entre iguales."],
    ],
    ca: [
      ["1", "Conéixer i apreciar els valors i les normes de convivència, aprendre a obrar d’acord amb aquestes de manera empàtica, preparar-se per a l’exercici actiu de la ciutadania i respectar els drets humans, així com el pluralisme propi d’una societat democràtica."],
      ["2", "Desenvolupar hàbits de treball individual i d’equip, d’esforç i de responsabilitat en l’estudi, així com actituds de confiança en si mateix, sentit crític, iniciativa personal, curiositat, interés i creativitat en l’aprenentatge, i esperit emprenedor."],
      ["3", "Adquirir habilitats per a la resolució pacífica de conflictes i la prevenció de la violència, que els permeten desenvolupar-se amb autonomia en l’àmbit escolar i familiar, així com desenvolupar actituds de respecte mutu en els grups socials amb els quals es relacionen."],
      ["4", "Conéixer, comprendre i respectar les diferents cultures i les diferències entre les persones des d’una perspectiva crítica, la igualtat de drets i oportunitats d’homes i dones i la no discriminació de persones per motius gènere, cultura, ideologia, d’ètnia, orientació o identitat sexual, religió, diversitat funcional o altres condicions."],
      ["5", "Conéixer i utilitzar de manera adequada i efectiva, oralment i per escrit, les llengües oficials: el valencià, com a llengua pròpia i oficial, i el castellà, com a llengua cooficial, i desenvolupar hàbits de lectura individual i en contextos de diàleg, debat i intercanvi d’experiències."],
      ["6", "Adquirir en llengua estrangera la competència comunicativa bàsica que els permeta comprendre i expressar missatges senzills en situacions quotidianes."],
      ["7", "Desenvolupar actituds positives envers la riquesa multilingüe i multicultural present en la societat, on conviuen el valencià i el castellà, a més d’altres llengües familiars."],
      ["8", "Desenvolupar les competències matemàtiques bàsiques i iniciar-se en la resolució de problemes que requerisquen la realització d’operacions elementals de càlcul, coneixements geomètrics i estimacions, així com ser capaços d’aplicar-los a les situacions de la seua vida quotidiana."],
      ["9", "Conéixer els aspectes fonamentals de les Ciències de la Naturalesa, les Ciències Socials, la Geografia, la Història i la Cultura, a través de l’assignatura de Coneixement del Medi Natural, Social i Cultural o en desenvolupament de projectes interdisciplinaris."],
      ["10", "Desenvolupar les competències tecnològiques bàsiques i iniciar-se en la seua utilització per a l’aprenentatge, desenvolupant un esperit crític davant del seu funcionament i els missatges que reben i elaboren."],
      ["11", "Utilitzar diferents representacions i expressions artístiques i iniciar-se en la construcció de propostes visuals i audiovisuals, desenvolupant la sensibilitat estètica i potenciant la creació artística."],
      ["12", "Valorar la higiene i la salut, acceptar el propi cos i el dels altres, respectar les diferències i utilitzar l’educació física, l’esport i l’alimentació com a mitjans per a afavorir el desenvolupament personal i social."],
      ["13", "Desenvolupar actituds de respecte i cura envers tots els animals, parant atenció especial al desenvolupament de formes de comportaments empàtics i correctes amb els animals de companyia."],
      ["14", "Desenvolupar les seues capacitats afectives en tots els àmbits de la personalitat i en les seues relacions amb altres persones, així com una actitud contrària a la violència, als prejudicis de qualsevol tipus i als estereotips sexistes."],
      ["15", "Desenvolupar hàbits quotidians de mobilitat activa autònoma saludable, fomentant l’educació viària i actituds de respecte que incidisquen en la prevenció dels accidents de trànsit."],
      ["16", "Desenvolupar hàbits de consum responsable en el context de l’educació per a la sostenibilitat i la protecció del medi ambient, en el camí cap a la transició ecològica."],
      ["17", "Promoure actituds de respecte entre tots els membres de la comunitat educativa, així com la cooperació entre iguals."],
    ],
  },
  "comunitat-valenciana-eso": {
    cita: {"es": "Decreto 107/2022, de 5 de agosto, artículo 7", "ca": "Decret 107/2022, de 5 d’agost, article 7"},
    numerado: true,
    es: [
      ["1", "Asumir responsablemente sus deberes, conocer y ejercer sus derechos en el respeto a los otros, practicar la tolerancia, la cooperación y la solidaridad entre las personas y grupos, ejercitarse en el diálogo afianzando los derechos humanos como valores comunes de una sociedad plural y prepararse para el ejercicio de la ciudadanía democrática."],
      ["2", "Desarrollar y consolidar hábitos de disciplina, estudio y trabajo individual y en equipo como condición necesaria para una realización eficaz de las tareas del aprendizaje y como medio de desarrollo personal."],
      ["3", "Valorar y respetar las diferencias de géneros y la igualdad de derechos y oportunidades entre ellos. Rechazar los estereotipos que suponen discriminación entre hombres y mujeres."],
      ["4", "Fortalecer sus capacidades afectivas en todos los ámbitos de la personalidad y en sus relaciones con los otros, así como rechazar la violencia, los prejuicios de cualquier tipo, los comportamientos sexistas y resolver pacíficamente los conflictos."],
      ["5", "Desarrollar destrezas básicas en la utilización de las fuentes de información para, con sentido crítico, adquirir nuevos conocimientos. Desarrollar las competencias tecnológicas básicas y avanzar en una reflexión ética sobre su funcionamiento y utilización."],
      ["6", "Concebir el conocimiento científico como un saber integrado, que se estructura en diferentes disciplinas, así como conocer y aplicar los métodos para identificar los problemas en los diversos campos del conocimiento y de la experiencia."],
      ["7", "Desarrollar el espíritu emprendedor y la confianza en sí mismo, la participación, el sentido crítico, la iniciativa personal y la capacidad para aprender a aprender, planificar, tomar decisiones y asumir responsabilidades."],
      ["8", "Comprender y expresar con corrección, oralmente y por escrito, en las lenguas oficiales, el valenciano como lengua propia y el castellano como lengua cooficial, textos y mensajes complejos, e iniciarse en el conocimiento, la lectura y el estudio de la literatura."],
      ["9", "Comprender y expresarse en una o más lenguas extranjeras de manera apropiada."],
      ["10", "Conocer, valorar y respetar los aspectos básicos de la cultura y la historia propias y de los demás, incluyendo las lenguas familiares, así como el patrimonio artístico y cultural, como muestra del multilingüismo y de la multiculturalidad del mundo, que también se tiene que valorar y respetar."],
      ["11", "Conocer y aceptar el funcionamiento del propio cuerpo y el de los demás, respetar las diferencias, afianzar los hábitos de atención y salud corporales e incorporar la educación física y la práctica del deporte para favorecer el desarrollo personal y social. Conocer y valorar la dimensión humana de la sexualidad en toda su diversidad."],
      ["12", "Valorar críticamente los hábitos sociales relacionados con la salud, el consumo, el cuidado, la empatía y el respeto hacia los seres vivos, especialmente los animales, y el medio ambiente, y contribuir así a su conservación y mejora."],
      ["13", "Apreciar la creación artística y comprender el lenguaje de las diferentes manifestaciones artísticas, utilizando varios medios de expresión y representación."],
      ["14", "Tomar conciencia de las problemáticas que tiene planteadas la humanidad y que se concretan en los Objetivos de Desarrollo Sostenible."],
    ],
    ca: [
      ["1", "Assumir responsablement els seus deures, conéixer i exercir els seus drets en el respecte als altres, practicar la tolerància, la cooperació i la solidaritat entre les persones i grups, exercitar-se en el diàleg refermant els drets humans com a valors comuns d’una societat plural i preparar-se per a l’exercici de la ciutadania democràtica."],
      ["2", "Desenvolupar i consolidar hàbits de disciplina, estudi i treball individual i en equip com a condició necessària per a una realització eficaç de les tasques de l’aprenentatge i com a mitjà de desenvolupament personal."],
      ["3", "Valorar i respectar les diferències de gèneres i la igualtat de drets i oportunitats entre ells. Rebutjar els estereotips que suposen discriminació entre homes i dones."],
      ["4", "Enfortir les seues capacitats afectives en tots els àmbits de la personalitat i en les seues relacions amb els altres, així com rebutjar la violència, els prejudicis de qualsevol tipus, els comportaments sexistes i resoldre pacíficament els conflictes."],
      ["5", "Desenvolupar destreses bàsiques en la utilització de les fonts d’informació per a adquirir, amb sentit crític, nous coneixements. Desenvolupar les competències tecnològiques bàsiques i avançar en una reflexió ètica sobre el seu funcionament i utilització."],
      ["6", "Concebre el coneixement científic com un saber integrat, que s’estructura en diferents disciplines, així com conéixer i aplicar els mètodes per a identificar els problemes en els diversos camps del coneixement i de l’experiència."],
      ["7", "Desenvolupar l’esperit emprenedor i la confiança en si mateix, la participació, el sentit crític, la iniciativa personal i la capacitat per a aprendre a aprendre, planificar, prendre decisions i assumir responsabilitats."],
      ["8", "Comprendre i expressar amb correcció, oralment i per escrit, en les llengües oficials, el valencià, com a llengua pròpia, i el castellà, com a llengua cooficial, textos i missatges complexos, i iniciar-se en el coneixement, la lectura i l’estudi de la literatura."],
      ["9", "Comprendre i expressar-se en una o més llengües estrangeres de manera apropiada."],
      ["10", "Conéixer, valorar i respectar els aspectes bàsics de la cultura i la història pròpies i dels altres, incloses les llengües familiars, així com el patrimoni artístic i cultural, com a mostra del multilingüisme i de la multiculturalitat del món, que també s’ha de valorar i respectar."],
      ["11", "Conéixer i acceptar el funcionament del seu cos i el dels altres, respectar les diferències, consolidar els hàbits de cura i salut corporals i incorporar l’educació física i la pràctica de l’esport per a afavorir el desenvolupament personal i social. Conéixer i valorar la dimensió humana de la sexualitat en tota la seua diversitat."],
      ["12", "Valorar críticament els hàbits socials relacionats amb la salut, el consum, la cura, l’empatia i el respecte cap als éssers vius, especialment els animals, i el medi ambient, i contribuir a la conservació i millora."],
      ["13", "Apreciar la creació artística i comprendre el llenguatge de les diferents manifestacions artístiques utilitzant diversos mitjans d’expressió i representació."],
      ["14", "Prendre consciència de les problemàtiques que té plantejades la humanitat i que es concreten en els Objectius de Desenvolupament Sostenible."],
    ],
  },
  "madrid-primaria": {
    cita: {"es": "Decreto 61/2022, de 13 de julio, artículo 5", "ca": "Decret 61/2022, de 13 de juliol, article 5"},
    numerado: false,
    es: [
      ["a", "Conocer y apreciar los valores y las normas de convivencia, aprender a obrar poniéndose en el lugar del otro, prepararse para el ejercicio activo de la ciudadanía y respetar los derechos humanos, así como su participación en una sociedad democrática."],
      ["b", "Desarrollar hábitos de trabajo individual y de equipo, de esfuerzo y de responsabilidad en el estudio, así como actitudes de confianza en sí mismo, sentido crítico, iniciativa personal, curiosidad, interés y creatividad en el aprendizaje, y espíritu emprendedor."],
      ["c", "Adquirir habilidades para la resolución pacífica de conflictos y la prevención de la violencia, que les permitan desenvolverse con autonomía en el ámbito escolar y familiar, así como en los grupos sociales con los que se relacionan."],
      ["d", "Conocer, comprender y respetar las diferentes culturas y las diferencias entre las personas, la igualdad de derechos y oportunidades de hombres y mujeres, y la no discriminación de personas por motivos de etnia, orientación o identidad sexual, religión o creencias, discapacidad u otras condiciones."],
      ["e", "Conocer y utilizar de manera apropiada la lengua española y desarrollar hábitos de lectura."],
      ["f", "Adquirir en, al menos, la lengua inglesa, la competencia comunicativa básica que les permita expresar y comprender mensajes sencillos y desenvolverse en situaciones cotidianas en este idioma."],
      ["g", "Desarrollar las competencias matemáticas básicas e iniciarse en la resolución de problemas que requieran la realización de operaciones elementales de cálculo, conocimientos geométricos y estimaciones, así como ser capaces de aplicarlos a las situaciones de su vida cotidiana."],
      ["h", "Conocer los aspectos fundamentales de las Ciencias de la Naturaleza, las Ciencias Sociales, la Geografía, la Historia y la Cultura."],
      ["i", "Desarrollar las competencias tecnológicas básicas e iniciarse en su utilización, para el aprendizaje, desarrollando un espíritu crítico ante su funcionamiento y los mensajes que reciben y elaboran."],
      ["j", "Utilizar diferentes representaciones y expresiones artísticas e iniciarse en la construcción de propuestas visuales y audiovisuales."],
      ["k", "Valorar la higiene y la salud, aceptar el propio cuerpo y el de los otros, respetar las diferencias y utilizar la educación física, el deporte y la alimentación como medios para favorecer el desarrollo personal y social."],
      ["l", "Conocer y valorar los animales más próximos al ser humano y adoptar modos de comportamiento que favorezcan la empatía y su cuidado."],
      ["m", "Desarrollar sus capacidades afectivas en todos los ámbitos de la personalidad y en sus relaciones con las demás personas, así como una actitud contraria a la violencia, a los prejuicios y estereotipos de cualquier tipo."],
      ["n", "Desarrollar hábitos cotidianos de movilidad activa autónoma saludable, fomentando la educación vial y actitudes de respeto que incidan en la prevención de los accidentes de tráfico."],
    ],
  },
  "madrid-eso": {
    cita: {"es": "Decreto 65/2022, de 20 de julio, artículo 13", "ca": "Decret 65/2022, de 20 de juliol, article 13"},
    numerado: false,
    es: [
      ["a", "Asumir responsablemente sus deberes, conocer y ejercer sus derechos en el respeto a las demás personas, practicar la tolerancia, la cooperación y la solidaridad entre las personas y grupos, ejercitarse en el diálogo afianzando los derechos humanos como valores comunes de una sociedad plural y prepararse para el ejercicio de la ciudadanía democrática."],
      ["b", "Desarrollar y consolidar hábitos de disciplina, estudio y trabajo individual y en equipo como condición necesaria para una realización eficaz de las tareas del aprendizaje y como medio de desarrollo personal."],
      ["c", "Valorar y respetar la diferencia de sexos y la igualdad de derechos y oportunidades entre ellos. Rechazar los estereotipos que supongan discriminación entre hombres y mujeres."],
      ["d", "Fortalecer sus capacidades afectivas en todos los ámbitos de la personalidad y en sus relaciones con las demás personas, así como rechazar la violencia, los prejuicios de cualquier tipo, los comportamientos sexistas y resolver pacíficamente los conflictos."],
      ["e", "Desarrollar destrezas básicas en la utilización de las fuentes de información para, con sentido crítico, adquirir nuevos conocimientos. Desarrollar las competencias tecnológicas básicas y avanzar en una reflexión ética sobre su funcionamiento y utilización."],
      ["f", "Concebir el conocimiento científico como un saber integrado, que se estructura en distintas disciplinas, así como conocer y aplicar los métodos para identificar los problemas en los diversos campos del conocimiento y de la experiencia."],
      ["g", "Desarrollar el espíritu emprendedor y la confianza en sí mismo, la participación, el sentido crítico, la iniciativa personal y la capacidad para aprender a aprender, planificar, tomar decisiones y asumir responsabilidades."],
      ["h", "Comprender y expresar con corrección, oralmente y por escrito, en la lengua castellana, textos y mensajes complejos, e iniciarse en el conocimiento, la lectura y el estudio de la literatura."],
      ["i", "Comprender y expresarse en una o más lenguas extranjeras de manera apropiada."],
      ["j", "Conocer, valorar y respetar los aspectos básicos de la cultura y la historia propias y de las demás personas, así como el patrimonio artístico y cultural."],
      ["k", "Conocer y aceptar el funcionamiento del propio cuerpo y el de los otros, respetar las diferencias, afianzar los hábitos de cuidado y salud corporales e incorporar la educación física y la práctica del deporte para favorecer el desarrollo personal y social. Conocer y valorar la dimensión humana de la sexualidad en toda su diversidad. Valorar críticamente los hábitos sociales relacionados con la salud, el consumo, el cuidado, la empatía y el respeto hacia los seres vivos, especialmente los animales, y el medio ambiente, contribuyendo a su conservación y mejora."],
      ["l", "Apreciar la creación artística y comprender el lenguaje de las distintas manifestaciones artísticas, utilizando diversos medios de expresión y representación."],
    ],
  },
  "cataluna": {
    cita: {"es": "Decreto 175/2022, de 27 de septiembre, artículo 4", "ca": "Decret 175/2022, de 27 de setembre, article 4"},
    numerado: false,
    ca: [
      ["a", "Assumir responsablement els seus deures; conèixer i exercir els seus drets en el respecte als altres; practicar l'empatia, la tolerància, la cooperació i la solidaritat entre les persones i grups; exercitar-se en el diàleg garantint els drets humans com a valors comuns d'una societat plural, i preparar-se per a l'exercici de la ciutadania democràtica."],
      ["b", "Desenvolupar i consolidar hàbits d'autoregulació, estudi i treball individual i en equip com a condició necessària per portar a terme de manera satisfactòria les tasques de l'aprenentatge i com a mitjà de desenvolupament personal i relacional."],
      ["c", "Valorar la igualtat de gènere i respectar la diversitat sexual, de gènere, ètnica o de capacitats. Rebutjar els estereotips que suposin qualsevol forma de discriminació entre persones. Conèixer els drets sexuals i reproductius, i exercir-los des del respecte a qualsevol persona i des de l'autocura."],
      ["d", "Enfortir les capacitats afectives en tots els àmbits de la personalitat i en les relacions amb els altres, així com rebutjar tot tipus de violència i discriminació, especialment la violència masclista i la violència LGTBIfòbica, els prejudicis de qualsevol tipus, els comportaments sexistes, i resoldre pacíficament els conflictes."],
      ["e", "Adquirir destreses bàsiques en la utilització de les fonts d'informació per adquirir, amb sentit crític, nous coneixements. Desenvolupar les competències tecnològiques bàsiques i avançar en una reflexió ètica sobre el funcionament i l'ús de la tecnologia."],
      ["f", "Concebre el coneixement científic com un saber integrat, que s'estructura en diferents disciplines, així com conèixer i aplicar els mètodes per identificar i resoldre els problemes en els diversos camps del coneixement i de l'experiència."],
      ["g", "Conèixer, comprendre i aplicar les diferents formes de raonament pròpies de les matemàtiques i usar-les en la resolució de problemes propis en els diversos camps del coneixement i de l'experiència."],
      ["h", "Desenvolupar la iniciativa emprenedora i la confiança en si mateix, la participació, el sentit crític, la iniciativa personal i la capacitat per aprendre a aprendre, planificar, prendre decisions i assumir responsabilitats."],
      ["i", "Utilitzar la llengua catalana en tots els contextos relacionats amb els aprenentatges tant formals com informals."],
      ["j", "Comprendre i expressar amb correcció, oralment i per escrit, en llengua catalana i en llengua castellana, textos i missatges complexos, i iniciar-se en el coneixement, la lectura i l'estudi de la literatura."],
      ["k", "Comprendre i expressar-se en una o més llengües estrangeres de manera apropiada."],
      ["l", "Conèixer, valorar i respectar els aspectes bàsics de la cultura i la història pròpies i dels altres, així com el patrimoni artístic, cultural i gastronòmic."],
      ["m", "Conèixer i acceptar el funcionament del propi cos i el dels altres, respectar les diferències, afermar els hàbits de cura i salut corporals, adquirir estratègies per poder prendre decisions conscients sobre el consum alimentari, i incorporar l'educació física i la pràctica de l'esport per afavorir el desenvolupament personal i social. Conèixer i valorar la dimensió humana de la sexualitat en tota la seva diversitat."],
      ["n", "Valorar críticament els hàbits socials relacionats amb la salut, l'alimentació, el consum, la cura, la consideració i el respecte cap als éssers vius, i contribuir a la conservació i millora del medi ambient."],
      ["o", "Apreciar la creació artística i comprendre el llenguatge de les diferents manifestacions artístiques, utilitzant diversos mitjans d'expressió i representació."],
      ["p", "Desenvolupar hàbits quotidians de mobilitat activa, autònoma i saludable, per fomentar l'educació vial i actituds de respecte per prevenir els accidents de trànsit."],
      ["q", "Prendre consciència de les problemàtiques que té plantejades la humanitat i que es concreten en els objectius de desenvolupament sostenible."],
    ],
  },
  "andalucia-primaria": {
    cita: {"es": "Decreto 101/2023, de 9 de mayo, artículo 5", "ca": "Decret 101/2023, de 9 de maig, article 5"},
    numerado: false,
    es: [
      ["a", "Conocer y apreciar los valores y las normas de convivencia, aprender a obrar de acuerdo con ellas de forma empática, prepararse para el ejercicio activo de la ciudadanía y respetar los derechos humanos, así como el pluralismo propio de una sociedad democrática."],
      ["b", "Desarrollar hábitos de trabajo individual y de equipo, de esfuerzo y de responsabilidad en el estudio, así como actitudes de confianza en sí mismo, iniciativa personal, sentido crítico, curiosidad, interés y creatividad en el aprendizaje y espíritu emprendedor."],
      ["c", "Adquirir habilidades para la resolución pacífica de conflictos y la prevención de la violencia, que le permitan desenvolverse con autonomía en el ámbito escolar y familiar, así como en los grupos sociales con los que se relaciona."],
      ["d", "Conocer, comprender y respetar las diferentes culturas, así como las diferencias entre las personas, la igualdad de derechos y oportunidades de hombres y mujeres y la no discriminación de personas por motivos de etnia, orientación o identidad sexual, religión o creencias, discapacidad u otras condiciones, así como reconocer la interculturalidad existente en Andalucía."],
      ["e", "Conocer y utilizar de manera apropiada la lengua castellana y desarrollar hábitos de lectura."],
      ["f", "Adquirir en, al menos, una lengua extranjera la competencia comunicativa básica que le permita expresar y comprender mensajes sencillos y desenvolverse en situaciones cotidianas."],
      ["g", "Desarrollar las competencias matemáticas básicas e iniciarse en la resolución de problemas que requieran la realización de operaciones elementales de cálculo, conocimientos geométricos y estimaciones, así como ser capaces de aplicarlos a las situaciones de su vida cotidiana."],
      ["h", "Conocer los aspectos fundamentales de las Ciencias de la Naturaleza, las Ciencias Sociales, la Geografía, la Historia y la Cultura, así como reconocer, valorar y proteger la riqueza patrimonial, paisajística, social, medioambiental, histórica y cultural de su Comunidad."],
      ["i", "Desarrollar las competencias tecnológicas básicas e iniciarse en su utilización, desarrollando un espíritu crítico ante su funcionamiento y los mensajes que recibe y elabora."],
      ["j", "Utilizar diferentes representaciones y expresiones artísticas, e iniciarse en la construcción de propuestas visuales y audiovisuales."],
      ["k", "Valorar la higiene y la salud, aceptar el propio cuerpo y el de las demás personas, respetar las diferencias propias y ajenas y utilizar la educación física, el deporte y la alimentación como medios para favorecer el desarrollo personal y social."],
      ["l", "Conocer y valorar los animales más próximos al ser humano y adoptar modos de comportamiento que favorezcan la empatía y su cuidado."],
      ["m", "Desarrollar capacidades afectivas en todos los ámbitos de su personalidad y en sus relaciones con las demás personas, así como una actitud contraria a la violencia, a los prejuicios de cualquier tipo y a los estereotipos sexistas."],
      ["n", "Desarrollar hábitos cotidianos de movilidad activa, autónoma y saludable, fomentando la educación vial y actitudes de respeto que incidan en la prevención de los accidentes de tráfico."],
      ["ñ", "Conocer y apreciar la peculiaridad lingüística andaluza en todas sus variedades."],
      ["o", "Conocer y respetar el patrimonio cultural de Andalucía, partiendo del conocimiento y de la comprensión de nuestra cultura, reconociendo a Andalucía como comunidad de encuentro de culturas."],
    ],
  },
  "andalucia-eso": {
    cita: {"es": "Decreto 102/2023, de 9 de mayo, artículo 5", "ca": "Decret 102/2023, de 9 de maig, article 5"},
    numerado: false,
    es: [
      ["a", "Asumir responsablemente sus deberes, conocer y ejercer sus derechos en el respeto a las demás personas, practicar la tolerancia, la cooperación y la solidaridad entre las personas y grupos, ejercitarse en el diálogo afianzando los derechos humanos como valores comunes de una sociedad plural y prepararse para el ejercicio de la ciudadanía democrática."],
      ["b", "Desarrollar y consolidar hábitos de disciplina, estudio y trabajo individual y en equipo como condición necesaria para una realización eficaz de las tareas del aprendizaje y como medio de desarrollo personal."],
      ["c", "Valorar y respetar la diferencia de sexos y la igualdad de derechos y oportunidades entre ellos. Rechazar los estereotipos que supongan discriminación entre hombres y mujeres."],
      ["d", "Fortalecer sus capacidades afectivas en todos los ámbitos de la personalidad y en sus relaciones con los demás, así como rechazar la violencia, los prejuicios de cualquier tipo, los comportamientos sexistas y resolver pacíficamente los conflictos."],
      ["e", "Desarrollar destrezas básicas en la utilización de las fuentes de información para, con sentido crítico, adquirir nuevos conocimientos. Desarrollar las competencias tecnológicas básicas y avanzar en una reflexión ética sobre su funcionamiento y utilización."],
      ["f", "Concebir el conocimiento científico como un saber integrado, que se estructura en distintas disciplinas, así como conocer y aplicar los métodos para identificar los problemas en los diversos campos del conocimiento y de la experiencia."],
      ["g", "Desarrollar el espíritu emprendedor y la confianza en sí mismo, la participación, el sentido crítico, la iniciativa personal y la capacidad para aprender a aprender, planificar, tomar decisiones y asumir responsabilidades."],
      ["h", "Comprender y expresar con corrección, oralmente y por escrito, en la lengua castellana, textos y mensajes complejos, e iniciarse en el conocimiento, la lectura y el estudio de la literatura."],
      ["i", "Comprender y expresarse en una o más lenguas extranjeras de manera apropiada."],
      ["j", "Conocer, valorar y respetar los aspectos básicos de la cultura y la historia propia y de las demás personas, apreciando los elementos específicos de la historia y la cultura andaluza, así como otros hechos diferenciadores como el flamenco, para que sean conocidos, valorados y respetados como patrimonio propio."],
      ["k", "Conocer y aceptar el funcionamiento del propio cuerpo y el de las otras personas, respetar las diferencias, afianzar los hábitos de cuidado y salud corporales e incorporar la educación física y la práctica del deporte para favorecer el desarrollo personal y social. Conocer y valorar la dimensión humana de la sexualidad en toda su diversidad. Valorar críticamente los hábitos sociales relacionados con la salud, el consumo, el cuidado, la empatía y el respeto hacia los seres vivos, especialmente los animales y el medioambiente, contribuyendo a su conservación y mejora, reconociendo la riqueza paisajística y medioambiental andaluza."],
      ["l", "Apreciar la creación artística y comprender el lenguaje de las distintas manifestaciones artísticas, utilizando diversos medios de expresión y representación."],
      ["m", "Conocer y apreciar la peculiaridad lingüística andaluza en todas sus variedades."],
      ["n", "Conocer y respetar el patrimonio cultural de Andalucía, partiendo del conocimiento y de la comprensión de nuestra cultura, reconociendo a Andalucía como comunidad de encuentro de culturas."],
    ],
  },
};

export interface ObjetivoEtapa { id: string; texto: string }
export interface ObjetivosEtapa {
  /** La norma y el artículo, en el idioma en que se muestran: «Decreto 106/2022, de 5 de agosto, artículo 7». */
  cita: string;
  numerado: boolean;
  objetivos: ObjetivoEtapa[];
}

function claveDe(comunidad: ComunidadId, etapa: Etapa): string {
  if (comunidad === 'cataluna') return 'cataluna';
  if (comunidad === 'comunitat-valenciana' || comunidad === 'madrid' || comunidad === 'andalucia') return `${comunidad}-${etapa}`;
  return `estatal-${etapa}`;
}

/**
 * Los objetivos de etapa de la comunidad y la etapa, en el idioma de la app si la norma se publicó en él (valenciano o
 * catalán con la app en catalán; castellano si no). Como el resto del currículo, nunca se traducen: con la app en inglés,
 * en castellano (o en catalán, en Cataluña).
 */
export function objetivosDeEtapa(comunidad: ComunidadId, etapa: Etapa, idioma: 'es' | 'ca' | 'en'): ObjetivosEtapa {
  const f = FUENTES[claveDe(comunidad, etapa)];
  const preferido = idioma === 'ca' ? 'ca' : 'es';
  const lista = (f[preferido] ?? f.es ?? f.ca)!;
  const enCatalan = lista === f.ca;
  return { cita: enCatalan ? f.cita.ca : f.cita.es, numerado: f.numerado, objetivos: lista.map(([id, texto]) => ({ id, texto })) };
}

/** «1. Conocer…» o «a) Conocer…», como en la norma. */
export const lineaObjetivo = (o: ObjetivoEtapa, numerado: boolean) => `${o.id}${numerado ? '.' : ')'} ${o.texto}`;

/**
 * Los objetivos elegidos por la IA (por su número o letra), con el texto oficial y en el orden de la norma. Lo que no está
 * en la lista se descarta; acepta «7», «7.», «a», «a)» o «A».
 */
export function objetivosElegidos(elegidos: unknown, oficiales: ObjetivosEtapa): ObjetivoEtapa[] {
  const ids = new Set((Array.isArray(elegidos) ? elegidos : [])
    .map(x => String(x ?? '').trim().toLowerCase().replace(/[.)\s]+$/, '').replace(/^\(/, '')));
  return oficiales.objetivos.filter(o => ids.has(o.id.toLowerCase()));
}
