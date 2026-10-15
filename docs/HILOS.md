# Hilos conductores de las fichas

Generado por `src/lib/hilos.test.ts` a partir de `src/lib/hilos.ts`: no se edita a mano. Para regenerarlo tras cambiar los hilos: `ACTUALIZAR_DOCS=1 npx vitest run src/lib/hilos.test.ts`.

Un hilo es el «mundo» al que pertenece lo que se trabaja. La app lo reconoce por el tema, el área y el curso de la ficha (`detectarHilos`) y con él ilustra la hoja: la cabecera y los dibujos de los ejercicios. Cómo funciona, en `docs/FICHAS.md`.

57 hilos, 281 dibujos (cada dibujo está en uno o más hilos).

## La granja (`granja`)

- Català: La granja. English: The farm.
- Áreas: cienciasNaturales.
- Palabras del tema que lo activan: granja, animales domesticos, domestico, ganaderia, ganado, establo, corral, rural, campo.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `ani-vaca` ×: Vaca: animal de granja que da leche, mamífero herbívoro
  - `ani-cerdo` ×: Cerdo: animal de granja, mamífero omnívoro
  - `ani-gallina` ×: Gallina con un huevo: ave de granja, animal ovíparo
  - `ani-oveja` ×: Oveja: animal de granja que da lana
  - `ani-caballo` ×: Caballo: animal de granja y de montar, mamífero herbívoro
  - `ani-pato` ×: Pato: ave acuática de granja y de estanque
  - `lug-granja`: Granja con establo, molino y valla: el campo, los animales de granja y el sector primario
  - `com-huevo` ×: Huevo frito: alimento de origen animal, proteínas
  - `pro-agricultor`: Agricultor con sombrero y cesta de verduras: sector primario y huerto

## Los animales (`animales`)

- Català: Els animals. English: Animals.
- Áreas: cienciasNaturales. Hilo general: pierde frente a uno más concreto.
- Palabras del tema que lo activan: animal, animales, vertebrados, invertebrados, clasificacion de animales, zoologia, alimentacion de los animales.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `ani-perro` ×: Perro sentado: animal doméstico, mamífero
  - `ani-vaca` ×: Vaca: animal de granja que da leche, mamífero herbívoro
  - `ani-leon` ×: León: felino salvaje de la sabana, mamífero carnívoro
  - `ani-pajaro` ×: Pájaro con las alas abiertas: ave que vuela, con pico y plumas
  - `ani-pez` ×: Pez: animal acuático, vertebrado que respira por branquias
  - `ani-mariposa` ×: Mariposa: insecto que pasa por la metamorfosis
  - `ani-rana` ×: Rana: anfibio que nace en el agua y vive en la tierra
  - `ani-serpiente` ×: Serpiente: reptil sin patas
  - `ani-elefante` ×: Elefante: el mayor animal terrestre, mamífero herbívoro
  - `ani-gato` ×: Gato sentado: animal doméstico, felino, mamífero

## Los seres vivos (`seres-vivos`)

- Català: Els éssers vius. English: Living things.
- Áreas: cienciasNaturales. Hilo general: pierde frente a uno más concreto.
- Palabras del tema que lo activan: ser vivo, seres vivos, biodiversidad, biologia, organismo, funciones vitales, reino, especie, clasificacion de los seres vivos.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `nat-flor` ×: Flor con pétalos, tallo y hojas: partes de la planta
  - `ani-mariposa` ×: Mariposa: insecto que pasa por la metamorfosis
  - `nat-arbol` ×: Árbol con tronco, ramas y hojas: planta leñosa
  - `ani-pez` ×: Pez: animal acuático, vertebrado que respira por branquias
  - `ani-ardilla` ×: Ardilla con una bellota: roedor del bosque
  - `nat-seta` ×: Seta roja con puntos: hongos y bosque
  - `ani-rana` ×: Rana: anfibio que nace en el agua y vive en la tierra
  - `ani-gato` ×: Gato sentado: animal doméstico, felino, mamífero
  - `nat-germinacion`: Plántula que brota de la tierra: germinación de una semilla

## La selva y la sabana (`selva-sabana`)

- Català: La selva i la sabana. English: The jungle and the savanna.
- Áreas: cienciasNaturales.
- Palabras del tema que lo activan: selva, sabana, africa, animales salvajes, salvaje, safari, jungla, mamifero, herbivoro, carnivoro, omnivoro, reptil, vertebrado.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `ani-leon` ×: León: felino salvaje de la sabana, mamífero carnívoro
  - `ani-elefante` ×: Elefante: el mayor animal terrestre, mamífero herbívoro
  - `ani-jirafa` ×: Jirafa: el animal más alto, herbívoro de la sabana
  - `ani-cebra` ×: Cebra: herbívoro rayado de la sabana
  - `ani-hipopotamo` ×: Hipopótamo: mamífero herbívoro de los ríos africanos
  - `ani-mono` ×: Mono con un plátano: mamífero de la selva
  - `ani-cocodrilo` ×: Cocodrilo: reptil carnívoro de los ríos
  - `ani-serpiente` ×: Serpiente: reptil sin patas

## Las mascotas (`mascotas`)

- Català: Les mascotes. English: Pets.
- Áreas: cienciasNaturales, valores.
- Palabras del tema que lo activan: mascota, animal de compania, veterinari, cuidar animales, cuidado de animales.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `ani-perro` ×: Perro sentado: animal doméstico, mamífero
  - `ani-gato` ×: Gato sentado: animal doméstico, felino, mamífero
  - `ani-conejo` ×: Conejo: mamífero herbívoro de orejas largas
  - `ani-pajaro` ×: Pájaro con las alas abiertas: ave que vuela, con pico y plumas
  - `ani-tortuga` ×: Tortuga: reptil con caparazón, vertebrado
  - `ani-pez` ×: Pez: animal acuático, vertebrado que respira por branquias
  - `pro-veterinario`: Veterinaria con un perrito: profesiones y animales

## El mar y los océanos (`oceano`)

- Català: El mar i els oceans. English: The sea and the oceans.
- Áreas: cienciasNaturales, cienciasSociales.
- Palabras del tema que lo activan: oceano, mar, marino, acuatico, peces, pez, ballena, delfin, tiburon, costa, ecosistema marino, navegar, faro, playa.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `ani-delfin` ×: Delfín saltando: mamífero marino
  - `ani-ballena` ×: Ballena: el mayor mamífero marino
  - `ani-tiburon` ×: Tiburón: pez carnívoro del océano
  - `ani-pulpo` ×: Pulpo: molusco marino de ocho tentáculos
  - `ani-pez` ×: Pez: animal acuático, vertebrado que respira por branquias
  - `tra-submarino`: Submarino amarillo: exploración del mar
  - `lug-faro`: Faro en la costa: navegación, mar y seguridad
  - `lug-playa`: Playa con palmera, arena y mar: el litoral, el mar y las vacaciones
  - `nat-isla`: Isla con una palmera: geografía y el mar

## Los insectos y los bichitos (`insectos`)

- Català: Els insectes i els bitxets. English: Insects and little creatures.
- Áreas: cienciasNaturales.
- Palabras del tema que lo activan: insecto, invertebrado, bicho, polinizacion, metamorfosis, colonia, abeja, mariposa, hormiga, arana, molusco, anfibio.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `ani-abeja` ×: Abeja: insecto que poliniza las flores y hace miel
  - `ani-mariposa` ×: Mariposa: insecto que pasa por la metamorfosis
  - `ani-hormiga` ×: Hormiga con una hoja: insecto que vive en colonias
  - `ani-caracol` ×: Caracol: molusco terrestre con concha en espiral
  - `ani-rana` ×: Rana: anfibio que nace en el agua y vive en la tierra
  - `nat-flor` ×: Flor con pétalos, tallo y hojas: partes de la planta

## Las aves (`aves`)

- Català: Els ocells. English: Birds.
- Áreas: cienciasNaturales.
- Palabras del tema que lo activan: ave, aves, pajaro, volar, plumas, nido, oviparo, pico, migracion.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `ani-pajaro` ×: Pájaro con las alas abiertas: ave que vuela, con pico y plumas
  - `ani-buho` ×: Búho: ave nocturna de presa
  - `ani-gallina` ×: Gallina con un huevo: ave de granja, animal ovíparo
  - `ani-pato` ×: Pato: ave acuática de granja y de estanque
  - `ani-pinguino` ×: Pingüino: ave que no vuela y vive en zonas polares
  - `com-huevo` ×: Huevo frito: alimento de origen animal, proteínas

## El bosque (`bosque`)

- Català: El bosc. English: The forest.
- Áreas: cienciasNaturales.
- Palabras del tema que lo activan: bosque, ecosistema, hibernar, hibernacion, hojas, arbol, habitat, bosque mediterraneo, cadena alimentaria, cadena trofica, fauna, flora.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `lug-bosque`: Tres árboles con flores: bosque, ecosistema y naturaleza
  - `ani-ardilla` ×: Ardilla con una bellota: roedor del bosque
  - `ani-oso` ×: Oso pardo: mamífero omnívoro del bosque que hiberna
  - `ani-zorro` ×: Zorro: mamífero carnívoro del bosque
  - `ani-buho` ×: Búho: ave nocturna de presa
  - `nat-arbol` ×: Árbol con tronco, ramas y hojas: planta leñosa
  - `nat-seta` ×: Seta roja con puntos: hongos y bosque
  - `nat-cueva`: Cueva con estalactitas: relieve y rocas

## Los polos y el frío (`polos`)

- Català: Els pols i el fred. English: The poles and the cold.
- Áreas: cienciasNaturales, cienciasSociales.
- Palabras del tema que lo activan: polo, polar, artico, antartida, hielo, glaciar, frio, nieve, iglu, congelar.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `ani-pinguino` ×: Pingüino: ave que no vuela y vive en zonas polares
  - `nat-copo` ×: Copo de nieve: invierno, agua y simetría
  - `est-invierno`: Muñeco de nieve con bufanda: el invierno, el frío y la nieve
  - `tie-bufanda` ×: Gorro, bufanda y guantes: invierno y ropa de abrigo
  - `rop-abrigo` ×: Abrigo rojo: ropa de invierno
  - `ani-ballena` ×: Ballena: el mayor mamífero marino

## Las plantas y su ciclo de vida (`plantas`)

- Català: Les plantes i el seu cicle de vida. English: Plants and their life cycle.
- Áreas: cienciasNaturales.
- Palabras del tema que lo activan: planta, vegetal, germinacion, semilla, fotosintesis, flor, raiz, tallo, ciclo de vida, crecimiento, reproduccion, polinizacion, botanica, cultivo.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `nat-germinacion`: Plántula que brota de la tierra: germinación de una semilla
  - `nat-flor` ×: Flor con pétalos, tallo y hojas: partes de la planta
  - `nat-arbol` ×: Árbol con tronco, ramas y hojas: planta leñosa
  - `nat-frutal` ×: Árbol frutal con manzanas: la huerta y la cosecha
  - `nat-tierra`: Planeta Tierra: continentes, océanos y medio ambiente
  - `ani-abeja` ×: Abeja: insecto que poliniza las flores y hace miel
  - `nat-sol`: Sol sonriente con rayos: estrella, luz y calor
  - `nat-lluvia`: Nube con lluvia: ciclo del agua y tiempo atmosférico

## El tiempo atmosférico (`tiempo-atmosferico`)

- Català: El temps atmosfèric. English: The weather.
- Áreas: cienciasNaturales, cienciasSociales.
- Palabras del tema que lo activan: tiempo atmosferico, meteorologia, clima, lluvia, viento, tormenta, nube, temperatura, precipitacion, arcoiris, atmosfera, meteorologico.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `nat-sol`: Sol sonriente con rayos: estrella, luz y calor
  - `nat-lluvia`: Nube con lluvia: ciclo del agua y tiempo atmosférico
  - `nat-tormenta`: Nube de tormenta con un rayo: el tiempo atmosférico
  - `nat-viento`: Viento con hojas: el aire en movimiento y el tiempo
  - `nat-arcoiris`: Arcoíris entre nubes: la luz, los colores y el tiempo atmosférico
  - `nat-copo` ×: Copo de nieve: invierno, agua y simetría
  - `mat-termometro`: Termómetro: temperatura, grados y medidas
  - `tie-paraguas` ×: Paraguas abierto con gotas: lluvia y tiempo atmosférico
  - `tie-botas` ×: Botas de agua amarillas: lluvia y ropa de abrigo

## Las estaciones del año (`estaciones`)

- Català: Les estacions de l’any. English: The seasons.
- Áreas: cienciasNaturales, cienciasSociales, general.
- Palabras del tema que lo activan: estacion, estaciones, primavera, verano, otono, invierno, ciclo anual, equinoccio, solsticio, ano.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `est-primavera`: Tulipán, narciso y mariposa: la primavera y el ciclo de las estaciones
  - `est-verano`: Sombrilla, sol y castillo de arena: el verano, la playa y el calor
  - `est-otono`: Árbol con hojas que caen y una seta: el otoño y los cambios de la naturaleza
  - `est-invierno`: Muñeco de nieve con bufanda: el invierno, el frío y la nieve
  - `com-helado` ×: Helado de dos bolas: postre, verano y fracciones
  - `fes-castanas` ×: Castañas asadas: otoño y tradiciones
  - `fes-calabaza` ×: Calabaza sonriente: otoño y Halloween

## Paisajes y relieve (`paisajes`)

- Català: Paisatges i relleu. English: Landscapes and relief.
- Áreas: cienciasSociales, cienciasNaturales.
- Palabras del tema que lo activan: paisaje, relieve, montana, rio, cordillera, llanura, isla, volcan, desierto, valle, geografia fisica, cascada, accidente geografico, cueva, costa.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `nat-montana`: Montaña nevada con bosque: relieve y paisaje
  - `nat-rio`: Río serpenteante entre campos verdes: curso del río y paisaje
  - `nat-volcan`: Volcán en erupción con lava y humo: relieve y fuerzas de la Tierra
  - `nat-cascada`: Cascada: el agua que cae, ríos y paisaje
  - `nat-desierto`: Camello y cactus: el desierto y su clima
  - `nat-cactus`: Cactus con flor: planta del desierto
  - `nat-isla`: Isla con una palmera: geografía y el mar
  - `nat-cueva`: Cueva con estalactitas: relieve y rocas
  - `lug-playa`: Playa con palmera, arena y mar: el litoral, el mar y las vacaciones

## El agua (`agua`)

- Català: L’aigua. English: Water.
- Áreas: cienciasNaturales.
- Palabras del tema que lo activan: agua, ciclo del agua, hidrosfera, estados del agua, liquido, evaporacion, condensacion, potable, ahorro de agua, rio, lluvia.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `com-agua`: Vaso de agua: hidratación y el agua como recurso
  - `hog-grifo` ×: Grifo con una gota: el agua, la higiene y el ahorro
  - `nat-lluvia`: Nube con lluvia: ciclo del agua y tiempo atmosférico
  - `nat-rio`: Río serpenteante entre campos verdes: curso del río y paisaje
  - `nat-cascada`: Cascada: el agua que cae, ríos y paisaje
  - `mat-jarra`: Jarra medidora con agua: capacidad, litros y mililitros
  - `nat-copo` ×: Copo de nieve: invierno, agua y simetría
  - `cie-probeta` ×: Tubos de ensayo con líquidos de colores: experimentos

## El planeta Tierra (`planeta-tierra`)

- Català: El planeta Terra. English: Planet Earth.
- Áreas: cienciasNaturales, cienciasSociales.
- Palabras del tema que lo activan: tierra, planeta tierra, continente, globo terraqueo, hemisferio, latitud, rotacion, traslacion, capas de la tierra, geosfera, mundo, terremoto.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `nat-tierra`: Planeta Tierra: continentes, océanos y medio ambiente
  - `nat-volcan`: Volcán en erupción con lava y humo: relieve y fuerzas de la Tierra
  - `nat-montana`: Montaña nevada con bosque: relieve y paisaje
  - `nat-isla`: Isla con una palmera: geografía y el mar
  - `esp-luna` ×: Luna con estrellas: satélite de la Tierra, la noche y sus fases
  - `nat-sol`: Sol sonriente con rayos: estrella, luz y calor
  - `val-planeta`: Manos que cuidan el planeta: sostenibilidad y medio ambiente

## El Sistema Solar y el espacio (`espacio`)

- Català: El Sistema Solar i l’espai. English: The Solar System and space.
- Áreas: cienciasNaturales.
- Palabras del tema que lo activan: sistema solar, planeta, espacio, universo, astronomia, estrella, luna, satelite, cohete, astronauta, galaxia, gravedad, eclipse, sol.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `esp-cohete` ×: Cohete con estrellas: espacio y exploración
  - `esp-saturno`: Saturno con sus anillos: sistema solar
  - `esp-astronauta`: Astronauta flotando: espacio y exploración
  - `esp-luna` ×: Luna con estrellas: satélite de la Tierra, la noche y sus fases
  - `esp-estrella` ×: Estrella amarilla: astronomía, premios y puntuaciones
  - `esp-satelite`: Satélite artificial con paneles solares: tecnología y espacio
  - `esp-telescopio`: Telescopio: observar las estrellas y los planetas
  - `nat-tierra`: Planeta Tierra: continentes, océanos y medio ambiente
  - `nat-sol`: Sol sonriente con rayos: estrella, luz y calor

## El día y la noche (`dia-noche`)

- Català: El dia i la nit. English: Day and night.
- Áreas: cienciasNaturales, general.
- Palabras del tema que lo activan: dia y noche, noche, amanecer, anochecer, sombra, luz, horario, rutina, sueno, dormir, manana, tarde.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `tie-amanecer`: Sol naciente tras una colina: el día, la mañana y el sol
  - `tie-noche`: Luna con estrellas: la noche, la luna y las estrellas
  - `nat-sol`: Sol sonriente con rayos: estrella, luz y calor
  - `esp-luna` ×: Luna con estrellas: satélite de la Tierra, la noche y sus fases
  - `hog-cama`: Cama con almohada y manta: el dormitorio y el descanso
  - `mat-reloj`: Reloj de pared: la hora, el tiempo y su medida
  - `hog-lampara` ×: Lámpara encendida: luz y energía en casa

## El cuerpo humano (`cuerpo-humano`)

- Català: El cos humà. English: The human body.
- Áreas: cienciasNaturales, educacionFisica.
- Palabras del tema que lo activan: cuerpo humano, cuerpo, organo, aparato, esqueleto, hueso, musculo, digestivo, respiratorio, circulatorio, nervioso, anatomia, cerebro, corazon, pulmon, sistema locomotor, huella.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `cue-esqueleto`: Esqueleto humano: huesos y aparato locomotor
  - `cue-cerebro`: Cerebro: el sistema nervioso y pensar
  - `cue-corazon`: Corazón: aparato circulatorio y cuerpo humano
  - `cue-pulmones`: Pulmones: aparato respiratorio y cuerpo humano
  - `cue-estomago`: Estómago e intestinos: el aparato digestivo
  - `cue-musculo`: Brazo fuerte: músculos, fuerza y ejercicio
  - `cue-huella`: Huellas de pies: el cuerpo, el movimiento y el rastro
  - `cue-mano`: Mano abierta: el sentido del tacto y contar hasta cinco

## Los cinco sentidos (`sentidos`)

- Català: Els cinc sentits. English: The five senses.
- Áreas: cienciasNaturales.
- Palabras del tema que lo activan: sentido, sentidos, vista, oido, olfato, gusto, tacto, percepcion, sensorial, ojo, oreja, nariz, lengua.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `cue-ojo`: Ojo: el sentido de la vista
  - `cue-oreja`: Oreja: el sentido del oído
  - `cue-nariz`: Nariz oliendo una flor: el sentido del olfato
  - `cue-lengua`: Boca con lengua: el sentido del gusto
  - `cue-mano`: Mano abierta: el sentido del tacto y contar hasta cinco

## La salud y la higiene (`salud-higiene`)

- Català: La salut i la higiene. English: Health and hygiene.
- Áreas: cienciasNaturales, educacionFisica, valores.
- Palabras del tema que lo activan: salud, higiene, enfermedad, prevencion, habito saludable, lavarse, dientes, descanso, virus, primeros auxilios, accidente, bienestar, vacuna.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `cue-dientes`: Cepillo de dientes y diente sonriente: higiene y salud
  - `hog-jabon` ×: Jabón y manos limpias: higiene y salud
  - `hog-grifo` ×: Grifo con una gota: el agua, la higiene y el ahorro
  - `cue-botiquin`: Botiquín con cruz roja: primeros auxilios y salud
  - `hog-cama`: Cama con almohada y manta: el dormitorio y el descanso
  - `pro-medico`: Médico con bata y fonendoscopio: profesiones y salud

## Alimentación saludable (`alimentacion`)

- Català: Alimentació saludable. English: Healthy eating.
- Áreas: cienciasNaturales, educacionFisica.
- Palabras del tema que lo activan: alimentacion, alimento, nutriente, dieta, piramide alimentaria, desayuno, comida, saludable, vitamina, proteina, hidrato, nutricion, menu.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `com-manzana` ×: Manzana roja: fruta, alimentación saludable, objeto para contar
  - `com-pan` ×: Pan y leche: alimentos básicos, desayuno, dieta
  - `com-queso` ×: Cuña de queso: lácteo, alimentación
  - `com-pescado` ×: Pescado en un plato: alimento, proteínas y dieta
  - `com-agua`: Vaso de agua: hidratación y el agua como recurso
  - `com-brocoli` ×: Brócoli: verdura, alimentación saludable
  - `com-huevo` ×: Huevo frito: alimento de origen animal, proteínas
  - `com-zanahoria` ×: Zanahoria: verdura, hortaliza, alimentación saludable
  - `com-helado` ×: Helado de dos bolas: postre, verano y fracciones

## Las frutas y la huerta (`frutas-verduras`)

- Català: Les fruites i l’hort. English: Fruit and the vegetable garden.
- Áreas: cienciasNaturales, general.
- Palabras del tema que lo activan: fruta, verdura, hortaliza, huerta, huerto, cosecha, fresa, manzana, naranja, platano, uva, tomate, zanahoria, patata, legumbre.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `com-manzana` ×: Manzana roja: fruta, alimentación saludable, objeto para contar
  - `com-naranja` ×: Naranja entera y en gajos: fruta cítrica, vitamina C, fracciones
  - `com-platano` ×: Plátano: fruta, alimentación saludable, objeto para contar
  - `com-pera` ×: Pera: fruta, alimentación saludable
  - `com-fresa` ×: Fresa: fruta roja, alimentación saludable
  - `com-uvas` ×: Racimo de uvas: fruta, vendimia y vino
  - `com-sandia` ×: Rodaja de sandía: fruta de verano, fracciones
  - `com-limon` ×: Limón: cítrico, vitamina C
  - `com-tomate` ×: Tomate: hortaliza, alimentación saludable
  - `com-zanahoria` ×: Zanahoria: verdura, hortaliza, alimentación saludable
  - `com-patata` ×: Patata: tubérculo, alimento básico
  - `com-brocoli` ×: Brócoli: verdura, alimentación saludable

## Números y cálculo (`numeros-calculo`)

- Català: Nombres i càlcul. English: Numbers and calculation.
- Áreas: matematicas.
- Palabras del tema que lo activan: numero, cifra, suma, resta, multiplicacion, division, calculo, operacion, tabla de multiplicar, problema, cantidad, contar, sumar, restar, descomposicion, millar, decimal, potencia, ecuacion, entero, ordenar numeros, numeros romanos, numeracion romana.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `mat-abaco`: Ábaco de colores: contar, sumar y el valor posicional
  - `esc-calculadora` ×: Calculadora: cálculo, operaciones y números
  - `mat-dados` ×: Dos dados: azar, probabilidad y juegos de mesa
  - `mat-domino` ×: Fichas de dominó: contar puntos, sumas y juegos
  - `mat-monedas` ×: Monedas y billete de euro: dinero, compras y problemas de precios
  - `mat-cartas` ×: Baraja de cartas: probabilidad, azar y juegos
  - `jue-bloques` ×: Torre de bloques de colores: construir, contar y apilar

## Repartir en partes iguales (`fracciones-reparto`)

- Català: Repartir en parts iguals. English: Sharing in equal parts.
- Áreas: matematicas.
- Palabras del tema que lo activan: fraccion, mitad, tercio, cuarto, partes iguales, reparto, repartir, porcion, numerador, denominador, porcentaje, proporcion, razon.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `mat-pizza` ×: Pizza en trozos iguales: fracciones y repartos
  - `com-tarta` ×: Tarta de cumpleaños con velas: fiestas y fracciones
  - `com-naranja` ×: Naranja entera y en gajos: fruta cítrica, vitamina C, fracciones
  - `com-sandia` ×: Rodaja de sandía: fruta de verano, fracciones
  - `mat-grafico-tarta`: Gráfico circular: estadística, porcentajes y fracciones
  - `mat-jarra`: Jarra medidora con agua: capacidad, litros y mililitros
  - `com-queso` ×: Cuña de queso: lácteo, alimentación
  - `com-pan` ×: Pan y leche: alimentos básicos, desayuno, dieta

## Formas y geometría (`geometria`)

- Català: Formes i geometria. English: Shapes and geometry.
- Áreas: matematicas, plastica.
- Palabras del tema que lo activan: geometria, figura, forma, poligono, triangulo, cuadrado, circulo, circunferencia, cuerpo geometrico, cubo, esfera, cono, cilindro, area, perimetro, volumen, angulo, simetria, rectangulo, prisma.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `mat-figuras` ×: Círculo, cuadrado, triángulo y rectángulo: figuras geométricas planas
  - `mat-cubo`: Cubo azul: cuerpo geométrico de seis caras
  - `mat-esfera`: Esfera roja: cuerpo geométrico redondo
  - `mat-cono`: Cono naranja: cuerpo geométrico con un vértice
  - `mat-cilindro`: Cilindro verde: cuerpo geométrico con dos bases
  - `mat-compas`: Compás: dibujar circunferencias y círculos

## Medir: tiempo, peso y capacidad (`medida`)

- Català: Mesurar: temps, pes i capacitat. English: Measuring: time, weight and capacity.
- Áreas: matematicas, cienciasNaturales.
- Palabras del tema que lo activan: medida, medir, longitud, peso, masa, capacidad, litro, kilo, gramo, tiempo, hora, reloj, minuto, temperatura, unidad de medida, magnitud, metro.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `mat-reloj`: Reloj de pared: la hora, el tiempo y su medida
  - `mat-balanza`: Balanza de dos platos: masa, peso y equilibrio
  - `mat-jarra`: Jarra medidora con agua: capacidad, litros y mililitros
  - `mat-termometro`: Termómetro: temperatura, grados y medidas
  - `cie-probeta` ×: Tubos de ensayo con líquidos de colores: experimentos

## Datos, gráficos y azar (`estadistica-azar`)

- Català: Dades, gràfics i atzar. English: Data, charts and chance.
- Áreas: matematicas.
- Palabras del tema que lo activan: estadistica, grafico, datos, tabla de datos, encuesta, probabilidad, azar, media, moda, frecuencia, diagrama, barras, suceso.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `mat-grafico-barras`: Gráfico de barras: estadística y comparar datos
  - `mat-grafico-tarta`: Gráfico circular: estadística, porcentajes y fracciones
  - `mat-dados` ×: Dos dados: azar, probabilidad y juegos de mesa
  - `mat-cartas` ×: Baraja de cartas: probabilidad, azar y juegos
  - `mat-domino` ×: Fichas de dominó: contar puntos, sumas y juegos

## El mercado y el dinero (`mercado-dinero`)

- Català: El mercat i els diners. English: The market and money.
- Áreas: matematicas, cienciasSociales.
- Palabras del tema que lo activan: dinero, euro, moneda, comprar, vender, precio, tienda, mercado, cambio, presupuesto, ahorro, economia, compra, comercio, consumo.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `mat-monedas` ×: Monedas y billete de euro: dinero, compras y problemas de precios
  - `lug-mercado`: Puesto de mercado con frutas y verduras: comercio y alimentación
  - `lug-tienda`: Tienda con toldo: comercio, compras y dinero
  - `esc-calculadora` ×: Calculadora: cálculo, operaciones y números
  - `mat-balanza`: Balanza de dos platos: masa, peso y equilibrio
  - `com-naranja` ×: Naranja entera y en gajos: fruta cítrica, vitamina C, fracciones
  - `com-platano` ×: Plátano: fruta, alimentación saludable, objeto para contar

## Juegos de mesa y de ingenio (`juegos-ingenio`)

- Català: Jocs de taula i d’enginy. English: Board games and brain games.
- Áreas: matematicas, general.
- Palabras del tema que lo activan: juego, ajedrez, estrategia, logica, puzle, rompecabezas, ingenio, acertijo, domino, cartas, pensamiento, razonamiento.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `mat-ajedrez`: Tablero de ajedrez con rey y peón: estrategia y lógica
  - `mat-dados` ×: Dos dados: azar, probabilidad y juegos de mesa
  - `mat-domino` ×: Fichas de dominó: contar puntos, sumas y juegos
  - `mat-cartas` ×: Baraja de cartas: probabilidad, azar y juegos
  - `jue-puzzle` ×: Puzle con una pieza que falta: juegos de lógica, patrones y resolución de problemas
  - `jue-bloques` ×: Torre de bloques de colores: construir, contar y apilar

## Leer y escribir (`lectura-escritura`)

- Català: Llegir i escriure. English: Reading and writing.
- Áreas: lengua.
- Palabras del tema que lo activan: lectura, leer, escritura, escribir, redaccion, cuento, texto, biblioteca, libro, narracion, gramatica, ortografia, vocabulario, palabra, oracion, poesia, literatura, sustantivo, verbo, adjetivo, sinonimo, resumen.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `esc-libro` ×: Pila de libros con uno abierto: lectura y biblioteca
  - `esc-cuaderno` ×: Cuaderno abierto con un lápiz: escribir y tomar apuntes
  - `his-tintero`: Tintero con pluma: la escritura de antes
  - `his-pergamino`: Pergamino en blanco: escritura antigua y documentos
  - `lug-biblioteca`: Biblioteca: libros, lectura y cultura
  - `idi-carta`: Sobre abierto con una carta y un corazón: escribir cartas y el correo
  - `idi-bocadillo`: Dos bocadillos de diálogo vacíos: conversación y comunicación
  - `esc-lapices` ×: Lápices de colores en un vaso: dibujo y material escolar
  - `his-imprenta`: Imprenta antigua: la historia de la escritura y los libros

## Comunicar y conversar (`comunicacion`)

- Català: Comunicar i conversar. English: Communicating and chatting.
- Áreas: ingles, lengua.
- Palabras del tema que lo activan: comunicacion, conversacion, dialogo, hablar, carta, mensaje, telefono, idioma, saludo, presentarse, greetings, hello, expresion oral, debate, entrevista.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `idi-bocadillo`: Dos bocadillos de diálogo vacíos: conversación y comunicación
  - `idi-carta`: Sobre abierto con una carta y un corazón: escribir cartas y el correo
  - `idi-telefono`: Teléfono antiguo: comunicación y conversación
  - `tec-movil` ×: Teléfono móvil: comunicación y tecnología
  - `val-amigos`: Grupo de niños y niñas: amistad, diversidad y equipo
  - `tec-auriculares` ×: Auriculares: escuchar música y sonido

## El cole y la clase (`escuela`)

- Català: L’escola i la classe. English: School and the classroom.
- Áreas: general, lengua, ingles. Hilo general: pierde frente a uno más concreto.
- Palabras del tema que lo activan: cole, colegio, clase, aula, escuela, material escolar, estudiar, curso, profesor, alumno, normas de clase, repaso, estudio, examen.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `esc-mochila` ×: Mochila con cuaderno y lápiz: el colegio y el material escolar
  - `esc-estuche` ×: Estuche con un lápiz: material escolar
  - `esc-lapices` ×: Lápices de colores en un vaso: dibujo y material escolar
  - `esc-pizarra`: Pizarra verde con tiza: la clase y las explicaciones
  - `esc-cuaderno` ×: Cuaderno abierto con un lápiz: escribir y tomar apuntes
  - `esc-libro` ×: Pila de libros con uno abierto: lectura y biblioteca
  - `esc-autobus`: Autobús escolar amarillo: el colegio y el transporte
  - `pro-docente`: Docente junto a una pizarra: la escuela y las profesiones
  - `esc-tijeras` ×: Tijeras: recortar y manualidades
  - `esc-pegamento` ×: Pegamento: pegar y manualidades
  - `esc-diploma`: Diploma enrollado con lazo: reconocimientos y logros
  - `esc-medalla` ×: Medalla de oro: premios, logros y deporte

## El laboratorio y el método científico (`laboratorio`)

- Català: El laboratori i el mètode científic. English: The laboratory and the scientific method.
- Áreas: cienciasNaturales. Hilo general: pierde frente a uno más concreto.
- Palabras del tema que lo activan: laboratorio, experimento, metodo cientifico, investigar, hipotesis, observacion, materia, mezcla, atomo, molecula, microscopio, celula, adn, quimica, cientifico, luz.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `pro-cientifico`: Científica con bata y matraz: profesiones y ciencia
  - `esc-microscopio` ×: Microscopio: observar lo muy pequeño, células y seres vivos
  - `cie-probeta` ×: Tubos de ensayo con líquidos de colores: experimentos
  - `cie-prisma`: Prisma que descompone la luz: colores y óptica
  - `cie-atomo`: Átomo con electrones: materia y química
  - `cie-adn`: ADN: la herencia y la genética

## Energía y electricidad (`energia`)

- Català: Energia i electricitat. English: Energy and electricity.
- Áreas: cienciasNaturales.
- Palabras del tema que lo activan: energia, electricidad, circuito, pila, bateria, corriente, renovable, energias renovables, solar, eolica, iman, magnetismo, bombilla, electrico.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `cie-circuito`: Circuito eléctrico sencillo con pila y bombilla: electricidad y energía
  - `cie-bateria` ×: Pila con un rayo: electricidad y energía
  - `cie-renovables`: Aerogenerador y panel solar: energías renovables
  - `cie-iman` ×: Imán que atrae clips: magnetismo y fuerzas
  - `hog-lampara` ×: Lámpara encendida: luz y energía en casa
  - `nat-sol`: Sol sonriente con rayos: estrella, luz y calor
  - `nat-viento`: Viento con hojas: el aire en movimiento y el tiempo

## Máquinas y fuerzas (`maquinas`)

- Català: Màquines i forces. English: Machines and forces.
- Áreas: cienciasNaturales.
- Palabras del tema que lo activan: maquina, fuerza, movimiento, palanca, polea, engranaje, mecanismo, robot, rozamiento, invento, mecanica, operador.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `cie-engranajes` ×: Engranajes: máquinas, movimiento y tecnología
  - `cie-polea`: Polea con cuerda y cubo: máquinas simples y fuerza
  - `cie-robot` ×: Robot simpático: robótica, programación y tecnología
  - `cie-iman` ×: Imán que atrae clips: magnetismo y fuerzas
  - `his-locomotora`: Locomotora de vapor: la Revolución Industrial
  - `tra-tren` ×: Tren: medio de transporte por ferrocarril

## Cuidar el planeta (`medio-ambiente`)

- Català: Cuidar el planeta. English: Caring for the planet.
- Áreas: cienciasNaturales, valores, cienciasSociales.
- Palabras del tema que lo activan: medio ambiente, reciclaje, reciclar, residuo, basura, sostenible, sostenibilidad, contaminacion, cambio climatico, ecologia, reutilizar, biodiversidad, ahorro de energia, ods.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `cie-reciclaje`: Contenedores de reciclaje azul, amarillo y verde: residuos y medio ambiente
  - `val-planeta`: Manos que cuidan el planeta: sostenibilidad y medio ambiente
  - `cie-renovables`: Aerogenerador y panel solar: energías renovables
  - `nat-arbol` ×: Árbol con tronco, ramas y hojas: planta leñosa
  - `hog-grifo` ×: Grifo con una gota: el agua, la higiene y el ahorro
  - `nat-tierra`: Planeta Tierra: continentes, océanos y medio ambiente

## La tecnología digital (`tecnologia-digital`)

- Català: La tecnologia digital. English: Digital technology.
- Áreas: general, cienciasNaturales.
- Palabras del tema que lo activan: tecnologia, digital, ordenador, informatica, internet, programacion, pantalla, robotica, app, tablet, movil, ciberseguridad, navegador, teclado, raton, camara, fotografia.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `tec-ordenador`: Ordenador portátil: tecnología, informática y recursos digitales
  - `tec-tablet` ×: Tableta: recursos digitales y aprendizaje
  - `tec-movil` ×: Teléfono móvil: comunicación y tecnología
  - `tec-teclado` ×: Ordenador portátil: escribir y usar el teclado
  - `tec-raton` ×: Ratón de ordenador: informática y manejo del ordenador
  - `tec-camara` ×: Cámara de fotos: fotografía, memoria y arte
  - `tec-auriculares` ×: Auriculares: escuchar música y sonido
  - `cie-robot` ×: Robot simpático: robótica, programación y tecnología

## Los transportes por tierra (`transporte-tierra`)

- Català: Els transports per terra. English: Land transport.
- Áreas: cienciasSociales, general.
- Palabras del tema que lo activan: transporte, vehiculo, coche, autobus, tren, camion, bicicleta, carretera, movilidad, moto, patinete, ferrocarril.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `tra-coche` ×: Coche: medio de transporte por carretera
  - `tra-autobus` ×: Autobús urbano: transporte público
  - `tra-camion` ×: Camión: transporte de mercancías por carretera
  - `tra-tren` ×: Tren: medio de transporte por ferrocarril
  - `tra-moto` ×: Moto de color rojo: transporte por carretera de dos ruedas
  - `tra-bicicleta` ×: Bicicleta: transporte sostenible, movilidad y deporte
  - `tra-patinete` ×: Patinete: movilidad personal y juego
  - `tra-ambulancia`: Ambulancia: emergencias y servicios sanitarios

## Transportes por aire y por agua (`transporte-aire-mar`)

- Català: Transports per aire i per aigua. English: Air and water transport.
- Áreas: cienciasSociales, general.
- Palabras del tema que lo activan: avion, helicoptero, barco, aire, submarino, globo aerostatico, aeropuerto, puerto, viaje, aviacion, navegacion.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `tra-avion` ×: Avión: medio de transporte aéreo
  - `tra-helicoptero` ×: Helicóptero: transporte aéreo y rescates
  - `tra-globo` ×: Globo aerostático: el aire y los primeros viajes
  - `tra-submarino`: Submarino amarillo: exploración del mar
  - `his-carabela`: Carabela de vela: descubrimientos, exploración y navegación
  - `pro-piloto`: Piloto con gorra: profesiones y aviación

## Seguridad y educación vial (`seguridad-vial`)

- Català: Seguretat i educació viària. English: Safety and road safety.
- Áreas: cienciasSociales, valores, educacionFisica.
- Palabras del tema que lo activan: seguridad vial, educacion vial, semaforo, senal, peaton, cruzar, casco, cinturon, trafico, prevencion, emergencia, incendio, accidente, seguridad, peligro, norma.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `seg-semaforo`: Semáforo en verde y señal de paso de peatones: seguridad vial y normas
  - `seg-stop`: Señal de stop: normas y seguridad vial
  - `seg-casco` ×: Casco sobre una bicicleta: protección y seguridad vial
  - `seg-extintor` ×: Extintor: incendios y seguridad
  - `tra-ambulancia`: Ambulancia: emergencias y servicios sanitarios
  - `pro-policia`: Policía con gorra: profesiones y seguridad ciudadana
  - `pro-bombero`: Bombero con casco y manguera: profesiones y servicios de emergencia
  - `tra-bicicleta` ×: Bicicleta: transporte sostenible, movilidad y deporte

## Los oficios y las profesiones (`oficios`)

- Català: Els oficis i les professions. English: Jobs and professions.
- Áreas: cienciasSociales, valores, general.
- Palabras del tema que lo activan: profesion, oficio, trabajo, trabajador, servicios, sector, futuro, vocacion, empleo, sector primario, sector secundario, sector terciario.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `pro-docente`: Docente junto a una pizarra: la escuela y las profesiones
  - `pro-medico`: Médico con bata y fonendoscopio: profesiones y salud
  - `pro-bombero`: Bombero con casco y manguera: profesiones y servicios de emergencia
  - `pro-policia`: Policía con gorra: profesiones y seguridad ciudadana
  - `pro-cocinero`: Cocinero con gorro y olla: profesiones y alimentación
  - `pro-panadero`: Panadero con pan recién hecho: profesiones y alimentación
  - `pro-agricultor`: Agricultor con sombrero y cesta de verduras: sector primario y huerto
  - `pro-pescador`: Pescador con caña: profesiones y sector primario
  - `pro-cartero`: Cartero con cartas: profesiones y correo
  - `pro-albanil`: Albañil con casco: profesiones y construcción
  - `pro-cientifico`: Científica con bata y matraz: profesiones y ciencia
  - `pro-pintor`: Pintor con boina y paleta: profesiones y arte
  - `pro-piloto`: Piloto con gorra: profesiones y aviación
  - `pro-veterinario`: Veterinaria con un perrito: profesiones y animales

## La ciudad y el pueblo (`ciudad-pueblo`)

- Català: La ciutat i el poble. English: The city and the town.
- Áreas: cienciasSociales.
- Palabras del tema que lo activan: ciudad, pueblo, barrio, localidad, urbanismo, servicios publicos, edificio, plano, entorno, comunidad, ayuntamiento, municipio, calle, poblacion, urbano, rural.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `lug-ciudad`: Ciudad con edificios y calles: el entorno urbano y el barrio
  - `lug-ayuntamiento`: Ayuntamiento con torre del reloj: el municipio y las instituciones
  - `lug-biblioteca`: Biblioteca: libros, lectura y cultura
  - `lug-hospital`: Hospital con cruz roja: servicios de salud
  - `lug-parque`: Parque con árbol, banco y columpio: espacios públicos y juego
  - `lug-mercado`: Puesto de mercado con frutas y verduras: comercio y alimentación
  - `lug-tienda`: Tienda con toldo: comercio, compras y dinero
  - `lug-estadio`: Estadio con gradas y campo: deporte y competiciones
  - `lug-puente`: Puente de piedra sobre un río: ingeniería y paisaje

## La casa y la familia (`casa-familia`)

- Català: La casa i la família. English: Home and family.
- Áreas: valores, cienciasSociales, general.
- Palabras del tema que lo activan: casa, hogar, familia, vivienda, habitacion, mueble, tareas del hogar, hermano, padres, abuelo, convivencia familiar.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `lug-casa`: Casa con jardín: el hogar y la vivienda
  - `val-familia`: Familia unida: convivencia y tipos de familia
  - `hog-cama`: Cama con almohada y manta: el dormitorio y el descanso
  - `hog-mesa`: Mesa y sillas: el comedor y los muebles
  - `hog-lampara` ×: Lámpara encendida: luz y energía en casa
  - `hog-escoba` ×: Escoba y recogedor: limpieza y tareas del hogar
  - `hog-olla` ×: Olla con vapor: cocinar y alimentación
  - `hog-cubiertos` ×: Plato con tenedor y cuchara: comer y la mesa

## La cocina y la receta (`cocina`)

- Català: La cuina i la recepta. English: The kitchen and recipes.
- Áreas: general, cienciasNaturales, lengua.
- Palabras del tema que lo activan: cocina, receta, cocinar, ingrediente, cocinero, hornear, plato, gastronomia, masa, pan.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `pro-cocinero`: Cocinero con gorro y olla: profesiones y alimentación
  - `hog-olla` ×: Olla con vapor: cocinar y alimentación
  - `hog-cubiertos` ×: Plato con tenedor y cuchara: comer y la mesa
  - `com-huevo` ×: Huevo frito: alimento de origen animal, proteínas
  - `com-pan` ×: Pan y leche: alimentos básicos, desayuno, dieta
  - `com-tomate` ×: Tomate: hortaliza, alimentación saludable
  - `pro-panadero`: Panadero con pan recién hecho: profesiones y alimentación
  - `com-pescado` ×: Pescado en un plato: alimento, proteínas y dieta

## La Prehistoria (`prehistoria`)

- Català: La Prehistòria. English: Prehistory.
- Áreas: cienciasSociales.
- Palabras del tema que lo activan: prehistoria, paleolitico, neolitico, cueva, cazador, mamut, dinosaurio, fosil, edad de piedra, homo sapiens, evolucion, primeros humanos.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `his-prehistoria`: Hombre prehistórico junto a una hoguera: prehistoria y el fuego
  - `his-mamut`: Mamut con colmillos: la Edad de Hielo y la prehistoria
  - `his-dinosaurio`: Dinosaurio verde: la prehistoria y los fósiles
  - `nat-cueva`: Cueva con estalactitas: relieve y rocas
  - `nat-volcan`: Volcán en erupción con lava y humo: relieve y fuerzas de la Tierra

## Egipto, Grecia y Roma (`antiguedad`)

- Català: Egipte, Grècia i Roma. English: Egypt, Greece and Rome.
- Áreas: cienciasSociales.
- Palabras del tema que lo activan: egipto, faraon, piramide, grecia, roma, romano, antiguedad, edad antigua, templo, anfora, civilizacion, imperio, mitologia, griego, mesopotamia.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `his-faraon`: Faraón con tocado dorado: el antiguo Egipto
  - `his-piramide`: Pirámide de Egipto en el desierto: civilizaciones antiguas
  - `his-romano`: Soldado romano con casco y escudo: la antigua Roma
  - `his-templo`: Templo griego con columnas: la antigua Grecia
  - `his-anfora` ×: Ánfora de barro: la vida en la antigüedad y la arqueología
  - `his-pergamino`: Pergamino en blanco: escritura antigua y documentos
  - `nat-desierto`: Camello y cactus: el desierto y su clima

## La Edad Media (`edad-media`)

- Català: L’Edat Mitjana. English: The Middle Ages.
- Áreas: cienciasSociales.
- Palabras del tema que lo activan: edad media, medieval, castillo, caballero, rey, feudal, vikingo, monarquia, reino, noble, corona, cruzada, al-andalus, musulman.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `his-castillo`: Castillo medieval con torres y bandera: Edad Media y feudalismo
  - `his-caballero`: Caballero con armadura: la Edad Media
  - `his-corona` ×: Corona de oro: monarquía, reyes y reinas
  - `his-vikingo`: Barco vikingo: navegación y pueblos del norte
  - `his-pergamino`: Pergamino en blanco: escritura antigua y documentos

## Descubrimientos y aventuras (`descubrimientos`)

- Català: Descobriments i aventures. English: Discoveries and adventures.
- Áreas: cienciasSociales, general.
- Palabras del tema que lo activan: descubrimiento, america, colon, exploracion, navegante, pirata, tesoro, mapa, aventura, edad moderna, conquista, expedicion, escape.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `his-carabela`: Carabela de vela: descubrimientos, exploración y navegación
  - `his-pirata`: Barco pirata: aventuras y navegación
  - `his-tesoro`: Mapa del tesoro con un camino de puntos: orientación y aventura
  - `his-pergamino`: Pergamino en blanco: escritura antigua y documentos
  - `nat-isla`: Isla con una palmera: geografía y el mar
  - `esp-telescopio`: Telescopio: observar las estrellas y los planetas

## La Revolución Industrial (`industria`)

- Català: La Revolució Industrial. English: The Industrial Revolution.
- Áreas: cienciasSociales.
- Palabras del tema que lo activan: revolucion industrial, industria, maquina de vapor, vapor, locomotora, imprenta, inventos, fabrica, edad contemporanea, siglo xix, industrial.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `his-locomotora`: Locomotora de vapor: la Revolución Industrial
  - `his-imprenta`: Imprenta antigua: la historia de la escritura y los libros
  - `cie-engranajes` ×: Engranajes: máquinas, movimiento y tecnología
  - `tra-tren` ×: Tren: medio de transporte por ferrocarril
  - `cie-polea`: Polea con cuerda y cubo: máquinas simples y fuerza

## Los instrumentos musicales (`musica`)

- Català: Els instruments musicals. English: Musical instruments.
- Áreas: musica.
- Palabras del tema que lo activan: musica, instrumento, ritmo, melodia, nota, pentagrama, orquesta, cantar, canto, sonido, compas, partitura, cancion, coro, percusion.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `mus-clave` ×: Clave de sol: lectura musical y pentagrama
  - `mus-guitarra` ×: Guitarra: instrumento de cuerda
  - `mus-piano` ×: Piano: instrumento de teclado
  - `mus-violin` ×: Violín con su arco: instrumento de cuerda frotada
  - `mus-tambor` ×: Tambor con baquetas: instrumento de percusión y ritmo
  - `mus-flauta` ×: Flauta dulce con notas musicales: instrumento de viento
  - `mus-trompeta` ×: Trompeta dorada: instrumento de viento metal
  - `mus-maracas` ×: Maracas: percusión y ritmo
  - `mus-xilofono` ×: Xilófono de colores: percusión y notas musicales
  - `tec-auriculares` ×: Auriculares: escuchar música y sonido

## El arte y la plástica (`arte`)

- Català: L’art i la plàstica. English: Art and crafts.
- Áreas: plastica.
- Palabras del tema que lo activan: arte, plastica, pintura, dibujo, color, colores, artista, escultura, manualidad, museo, creatividad, collage, modelar, acuarela, taller.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `art-caballete` ×: Caballete con un cuadro: pintura y arte
  - `art-pinceles` ×: Pinceles y un bote de pintura: pintar y colores
  - `art-acuarelas` ×: Caja de acuarelas con un pincel: pintura y mezcla de colores
  - `art-plastilina` ×: Plastilina de colores: modelar y esculpir
  - `art-marco` ×: Cuadro con marco dorado: museo, arte y exposiciones
  - `pro-pintor`: Pintor con boina y paleta: profesiones y arte
  - `esc-tijeras` ×: Tijeras: recortar y manualidades
  - `esc-pegamento` ×: Pegamento: pegar y manualidades
  - `esc-lapices` ×: Lápices de colores en un vaso: dibujo y material escolar

## El deporte y el movimiento (`deporte`)

- Català: L’esport i el moviment. English: Sport and movement.
- Áreas: educacionFisica.
- Palabras del tema que lo activan: deporte, ejercicio, educacion fisica, equipo, carrera, natacion, gimnasia, olimpiadas, motricidad, balon, futbol, baloncesto, tenis, voleibol, patines, condicion fisica, juego deportivo.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `dep-futbol` ×: Balón de fútbol: deporte de equipo
  - `dep-baloncesto` ×: Balón de baloncesto y canasta: deporte de equipo
  - `dep-tenis` ×: Raqueta y pelota de tenis: deporte de raqueta
  - `dep-voleibol` ×: Balón de voleibol y red: deporte de equipo
  - `dep-natacion`: Cara con gorro y gafas de natación en el agua: deporte acuático
  - `dep-gimnasia`: Niño haciendo el pino sobre una colchoneta: gimnasia
  - `dep-patines` ×: Patines: equilibrio, deporte y movilidad
  - `dep-cuerda` ×: Comba: saltar, coordinación y juegos de patio
  - `dep-zapatillas` ×: Zapatillas de deporte y botella de agua: ejercicio y hábitos saludables
  - `cue-musculo`: Brazo fuerte: músculos, fuerza y ejercicio
  - `com-agua`: Vaso de agua: hidratación y el agua como recurso

## Valores y emociones (`valores-emociones`)

- Català: Valors i emocions. English: Values and emotions.
- Áreas: valores.
- Palabras del tema que lo activan: valor, emocion, sentimiento, amistad, respeto, paz, convivencia, empatia, solidaridad, derechos, igualdad, justicia, tolerancia, diversidad, inclusion, autoestima, cooperacion, responsabilidad, etica, religion.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `val-emociones`: Cuatro caritas con gestos distintos: las emociones y los sentimientos
  - `val-amigos`: Grupo de niños y niñas: amistad, diversidad y equipo
  - `val-abrazo`: Dos niños abrazándose: amistad y cariño
  - `val-paloma`: Paloma con una rama de olivo: la paz
  - `val-corazon`: Corazón con una tirita: cuidar y empatía
  - `val-manos`: Manos de distintos colores unidas: amistad, convivencia y solidaridad
  - `val-justicia`: Balanza de la justicia: normas, derechos y ley
  - `val-regalo`: Regalo con lazo: generosidad y celebraciones
  - `val-planeta`: Manos que cuidan el planeta: sostenibilidad y medio ambiente

## La ropa y el vestir (`ropa`)

- Català: La roba i el vestir. English: Clothes.
- Áreas: general, cienciasNaturales.
- Palabras del tema que lo activan: ropa, vestir, prenda, vestido, calzado, abrigo, moda, zapato, uniforme, tela, textil, calcetin.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `rop-ropa`: Camiseta, pantalón corto y gorra: la ropa y la vestimenta
  - `rop-vestido` ×: Vestido de verano con flores: ropa y estaciones
  - `rop-zapatos` ×: Zapatos escolares: ropa y calzado
  - `rop-calcetines` ×: Calcetines de rayas: ropa y pares
  - `rop-abrigo` ×: Abrigo rojo: ropa de invierno
  - `tie-bufanda` ×: Gorro, bufanda y guantes: invierno y ropa de abrigo
  - `tie-gafas` ×: Gafas de sol y sombrero: verano y protección solar
  - `tie-botas` ×: Botas de agua amarillas: lluvia y ropa de abrigo

## Fiestas y tradiciones (`fiestas`)

- Català: Festes i tradicions. English: Festivals and traditions.
- Áreas: general, cienciasSociales, valores.
- Palabras del tema que lo activan: fiesta, tradicion, navidad, pascua, carnaval, cumpleanos, celebracion, halloween, fallas, festividad, regalo, castanada, reyes magos, cultura popular.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `fes-navidad`: Árbol de Navidad con regalos: fiestas y tradiciones
  - `fes-globos` ×: Globos de colores: fiestas y celebraciones
  - `fes-gorro` ×: Gorro de fiesta con confeti: celebraciones y alegría
  - `fes-fuegos`: Fuegos artificiales: fiestas y celebraciones
  - `fes-pascua` ×: Cesta con huevos de colores: Pascua y primavera
  - `fes-calabaza` ×: Calabaza sonriente: otoño y Halloween
  - `fes-castanas` ×: Castañas asadas: otoño y tradiciones
  - `val-regalo`: Regalo con lazo: generosidad y celebraciones
  - `com-tarta` ×: Tarta de cumpleaños con velas: fiestas y fracciones

## Los juguetes y el recreo (`juguetes-recreo`)

- Català: Les joguines i el pati. English: Toys and playtime.
- Áreas: educacionFisica, valores, general.
- Palabras del tema que lo activan: juguete, recreo, patio, jugar, infancia, juegos tradicionales, parque, columpio, cometa, peluche, trompo.
- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):
  - `jue-pelota` ×: Pelota de playa de colores: juego, verano y esferas
  - `jue-peonza` ×: Peonza de colores: juegos tradicionales y movimiento
  - `jue-cometa` ×: Cometa volando: viento, juego y geometría
  - `jue-peluche` ×: Osito de peluche: juguetes e infancia
  - `jue-bloques` ×: Torre de bloques de colores: construir, contar y apilar
  - `jue-columpio` ×: Columpios: el parque, el juego y el movimiento
  - `jue-puzzle` ×: Puzle con una pieza que falta: juegos de lógica, patrones y resolución de problemas
  - `lug-parque`: Parque con árbol, banco y columpio: espacios públicos y juego
