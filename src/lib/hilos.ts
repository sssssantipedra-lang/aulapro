/**
 * Hilos conductores de las fichas (decisión del dueño, 14-10-2026): los 319
 * dibujos del catálogo (`ilustraciones.ts`) clasificados por tópicos. Un hilo
 * es el «mundo» al que pertenece lo que se trabaja (la granja, el sistema
 * solar, el cuerpo humano, el reparto en partes iguales…) y reúne los dibujos
 * con los que se puede ilustrar una actividad sobre ese tema.
 *
 * Para qué sirve:
 * - La app reconoce de qué trata una ficha (`detectarHilos`: tema, área y curso
 *   contra las palabras de cada hilo) y le pone el hilo que mejor encaja, que
 *   el docente puede cambiar o quitar.
 * - El hilo decide la cabecera de la hoja, los dibujos de los ejercicios (la
 *   IA elige de la lista cerrada de ese hilo, nunca dibuja) y el ambiente de
 *   los enunciados («En la granja hay…»).
 * - Un dibujo puede estar en varios hilos (la pizza es del reparto y de la
 *   cocina); cada uno está al menos en uno (lo comprueba una prueba).
 *
 * Las palabras de cada hilo van en castellano, sin tildes y en minúscula, y se
 * buscan como en los temas de cada dibujo: por comienzo de palabra (los de tres
 * letras o menos, solo como palabra entera o en plural).
 */
import type { Lang } from '../i18n';
import { pickMotifKey, type FichaMotifKey } from '../services/fichaMotifs';
import { ILUSTRACIONES, coincideTema, ilustracionPorId, puntuarIlustracion, type ContextoIlustracion, type Ilustracion } from './ilustraciones';

export interface Hilo {
  id: string;
  nombre: Record<Lang, string>;
  /** Palabras del tema que activan el hilo: castellano, sin tildes, en minúscula. */
  temas: string[];
  /** Áreas donde es natural. */
  areas: FichaMotifKey[];
  /** Los dibujos del hilo, del más al menos protagonista: el primero es el de la cabecera. */
  dibujos: string[];
  /** Un hilo muy general (los animales, el cole): pierde frente a otro más concreto que también encaje. */
  amplio?: boolean;
}

const n = (es: string, ca: string, en: string): Record<Lang, string> => ({ es, ca, en });

export const HILOS: readonly Hilo[] = [
  /* ── Seres vivos ── */
  {
    id: 'granja', nombre: n('La granja', 'La granja', 'The farm'),
    temas: ['granja', 'animales domesticos', 'domestico', 'ganaderia', 'ganado', 'establo', 'corral', 'rural', 'campo'],
    areas: ['cienciasNaturales'],
    dibujos: ['ani-vaca', 'ani-cerdo', 'ani-gallina', 'ani-oveja', 'ani-caballo', 'ani-pato', 'lug-granja', 'com-huevo', 'pro-agricultor'],
  },
  {
    id: 'animales', nombre: n('Los animales', 'Els animals', 'Animals'),
    amplio: true,
    temas: ['animal', 'animales', 'vertebrados', 'invertebrados', 'clasificacion de animales', 'zoologia', 'alimentacion de los animales'],
    areas: ['cienciasNaturales'],
    dibujos: ['ani-perro', 'ani-vaca', 'ani-leon', 'ani-pajaro', 'ani-pez', 'ani-mariposa', 'ani-rana', 'ani-serpiente', 'ani-elefante', 'ani-gato'],
  },
  {
    id: 'seres-vivos', nombre: n('Los seres vivos', 'Els éssers vius', 'Living things'),
    amplio: true,
    temas: ['ser vivo', 'seres vivos', 'biodiversidad', 'biologia', 'organismo', 'funciones vitales', 'reino', 'especie', 'clasificacion de los seres vivos'],
    areas: ['cienciasNaturales'],
    dibujos: ['nat-flor', 'ani-mariposa', 'nat-arbol', 'ani-pez', 'ani-ardilla', 'nat-seta', 'ani-rana', 'ani-gato', 'nat-germinacion'],
  },
  {
    id: 'selva-sabana', nombre: n('La selva y la sabana', 'La selva i la sabana', 'The jungle and the savanna'),
    temas: ['selva', 'sabana', 'africa', 'animales salvajes', 'salvaje', 'safari', 'jungla', 'mamifero', 'herbivoro', 'carnivoro', 'omnivoro', 'reptil', 'vertebrado'],
    areas: ['cienciasNaturales'],
    dibujos: ['ani-leon', 'ani-elefante', 'ani-jirafa', 'ani-cebra', 'ani-hipopotamo', 'ani-mono', 'ani-cocodrilo', 'ani-serpiente'],
  },
  {
    id: 'mascotas', nombre: n('Las mascotas', 'Les mascotes', 'Pets'),
    temas: ['mascota', 'animal de compania', 'veterinari', 'cuidar animales', 'cuidado de animales'],
    areas: ['cienciasNaturales', 'valores'],
    dibujos: ['ani-perro', 'ani-gato', 'ani-conejo', 'ani-pajaro', 'ani-tortuga', 'ani-pez', 'pro-veterinario'],
  },
  {
    id: 'oceano', nombre: n('El mar y los océanos', 'El mar i els oceans', 'The sea and the oceans'),
    temas: ['oceano', 'mar', 'marino', 'acuatico', 'peces', 'pez', 'ballena', 'delfin', 'tiburon', 'costa', 'ecosistema marino', 'navegar', 'faro', 'playa'],
    areas: ['cienciasNaturales', 'cienciasSociales'],
    dibujos: ['ani-delfin', 'ani-ballena', 'ani-tiburon', 'ani-pulpo', 'ani-pez', 'tra-submarino', 'lug-faro', 'lug-playa', 'nat-isla'],
  },
  {
    id: 'insectos', nombre: n('Los insectos y los bichitos', 'Els insectes i els bitxets', 'Insects and little creatures'),
    temas: ['insecto', 'invertebrado', 'bicho', 'polinizacion', 'metamorfosis', 'colonia', 'abeja', 'mariposa', 'hormiga', 'arana', 'molusco', 'anfibio'],
    areas: ['cienciasNaturales'],
    dibujos: ['ani-abeja', 'ani-mariposa', 'ani-hormiga', 'ani-caracol', 'ani-rana', 'nat-flor'],
  },
  {
    id: 'aves', nombre: n('Las aves', 'Els ocells', 'Birds'),
    temas: ['ave', 'aves', 'pajaro', 'volar', 'plumas', 'nido', 'oviparo', 'pico', 'migracion'],
    areas: ['cienciasNaturales'],
    dibujos: ['ani-pajaro', 'ani-buho', 'ani-gallina', 'ani-pato', 'ani-pinguino', 'com-huevo'],
  },
  {
    id: 'bosque', nombre: n('El bosque', 'El bosc', 'The forest'),
    temas: ['bosque', 'ecosistema', 'hibernar', 'hibernacion', 'hojas', 'arbol', 'habitat', 'bosque mediterraneo', 'cadena alimentaria', 'cadena trofica', 'fauna', 'flora'],
    areas: ['cienciasNaturales'],
    dibujos: ['lug-bosque', 'ani-ardilla', 'ani-oso', 'ani-zorro', 'ani-buho', 'nat-arbol', 'nat-seta', 'nat-cueva'],
  },
  {
    id: 'polos', nombre: n('Los polos y el frío', 'Els pols i el fred', 'The poles and the cold'),
    temas: ['polo', 'polar', 'artico', 'antartida', 'hielo', 'glaciar', 'frio', 'nieve', 'iglu', 'congelar'],
    areas: ['cienciasNaturales', 'cienciasSociales'],
    dibujos: ['ani-pinguino', 'nat-copo', 'est-invierno', 'tie-bufanda', 'rop-abrigo', 'ani-ballena'],
  },
  {
    id: 'plantas', nombre: n('Las plantas y su ciclo de vida', 'Les plantes i el seu cicle de vida', 'Plants and their life cycle'),
    temas: ['planta', 'vegetal', 'germinacion', 'semilla', 'fotosintesis', 'flor', 'raiz', 'tallo', 'ciclo de vida', 'crecimiento', 'reproduccion', 'polinizacion', 'botanica', 'cultivo'],
    areas: ['cienciasNaturales'],
    dibujos: ['nat-germinacion', 'nat-flor', 'nat-arbol', 'nat-frutal', 'nat-tierra', 'ani-abeja', 'nat-sol', 'nat-lluvia'],
  },

  /* ── Naturaleza y planeta ── */
  {
    id: 'tiempo-atmosferico', nombre: n('El tiempo atmosférico', 'El temps atmosfèric', 'The weather'),
    temas: ['tiempo atmosferico', 'meteorologia', 'clima', 'lluvia', 'viento', 'tormenta', 'nube', 'temperatura', 'precipitacion', 'arcoiris', 'atmosfera', 'meteorologico'],
    areas: ['cienciasNaturales', 'cienciasSociales'],
    dibujos: ['nat-sol', 'nat-lluvia', 'nat-tormenta', 'nat-viento', 'nat-arcoiris', 'nat-copo', 'mat-termometro', 'tie-paraguas', 'tie-botas'],
  },
  {
    id: 'estaciones', nombre: n('Las estaciones del año', 'Les estacions de l’any', 'The seasons'),
    temas: ['estacion', 'estaciones', 'primavera', 'verano', 'otono', 'invierno', 'ciclo anual', 'equinoccio', 'solsticio', 'ano'],
    areas: ['cienciasNaturales', 'cienciasSociales', 'general'],
    dibujos: ['est-primavera', 'est-verano', 'est-otono', 'est-invierno', 'com-helado', 'fes-castanas', 'fes-calabaza'],
  },
  {
    id: 'paisajes', nombre: n('Paisajes y relieve', 'Paisatges i relleu', 'Landscapes and relief'),
    temas: ['paisaje', 'relieve', 'montana', 'rio', 'cordillera', 'llanura', 'isla', 'volcan', 'desierto', 'valle', 'geografia fisica', 'cascada', 'accidente geografico', 'cueva', 'costa'],
    areas: ['cienciasSociales', 'cienciasNaturales'],
    dibujos: ['nat-montana', 'nat-rio', 'nat-volcan', 'nat-cascada', 'nat-desierto', 'nat-cactus', 'nat-isla', 'nat-cueva', 'lug-playa'],
  },
  {
    id: 'agua', nombre: n('El agua', 'L’aigua', 'Water'),
    temas: ['agua', 'ciclo del agua', 'hidrosfera', 'estados del agua', 'liquido', 'evaporacion', 'condensacion', 'potable', 'ahorro de agua', 'rio', 'lluvia'],
    areas: ['cienciasNaturales'],
    dibujos: ['com-agua', 'hog-grifo', 'nat-lluvia', 'nat-rio', 'nat-cascada', 'mat-jarra', 'nat-copo', 'cie-probeta'],
  },
  {
    id: 'planeta-tierra', nombre: n('El planeta Tierra', 'El planeta Terra', 'Planet Earth'),
    temas: ['tierra', 'planeta tierra', 'continente', 'globo terraqueo', 'hemisferio', 'latitud', 'rotacion', 'traslacion', 'capas de la tierra', 'geosfera', 'mundo', 'terremoto'],
    areas: ['cienciasNaturales', 'cienciasSociales'],
    dibujos: ['nat-tierra', 'nat-volcan', 'nat-montana', 'nat-isla', 'esp-luna', 'nat-sol', 'val-planeta'],
  },
  {
    id: 'espacio', nombre: n('El Sistema Solar y el espacio', 'El Sistema Solar i l’espai', 'The Solar System and space'),
    temas: ['sistema solar', 'planeta', 'espacio', 'universo', 'astronomia', 'estrella', 'luna', 'satelite', 'cohete', 'astronauta', 'galaxia', 'gravedad', 'eclipse', 'sol'],
    areas: ['cienciasNaturales'],
    dibujos: ['esp-cohete', 'esp-saturno', 'esp-astronauta', 'esp-luna', 'esp-estrella', 'esp-satelite', 'esp-telescopio', 'nat-tierra', 'nat-sol'],
  },
  {
    id: 'dia-noche', nombre: n('El día y la noche', 'El dia i la nit', 'Day and night'),
    temas: ['dia y noche', 'noche', 'amanecer', 'anochecer', 'sombra', 'luz', 'horario', 'rutina', 'sueno', 'dormir', 'manana', 'tarde'],
    areas: ['cienciasNaturales', 'general'],
    dibujos: ['tie-amanecer', 'tie-noche', 'nat-sol', 'esp-luna', 'hog-cama', 'mat-reloj', 'hog-lampara', 'per-nino-durmiendo', 'cue-casa-luna'],
  },

  /* ── Cuerpo y salud ── */
  {
    id: 'cuerpo-humano', nombre: n('El cuerpo humano', 'El cos humà', 'The human body'),
    temas: ['cuerpo humano', 'cuerpo', 'organo', 'aparato', 'esqueleto', 'hueso', 'musculo', 'digestivo', 'respiratorio', 'circulatorio', 'nervioso', 'anatomia', 'cerebro', 'corazon', 'pulmon', 'sistema locomotor', 'huella'],
    areas: ['cienciasNaturales', 'educacionFisica'],
    dibujos: ['cue-esqueleto', 'cue-cerebro', 'cue-corazon', 'cue-pulmones', 'cue-estomago', 'cue-musculo', 'cue-huella', 'cue-mano'],
  },
  {
    id: 'sentidos', nombre: n('Los cinco sentidos', 'Els cinc sentits', 'The five senses'),
    temas: ['sentido', 'sentidos', 'vista', 'oido', 'olfato', 'gusto', 'tacto', 'percepcion', 'sensorial', 'ojo', 'oreja', 'nariz', 'lengua'],
    areas: ['cienciasNaturales'],
    dibujos: ['cue-ojo', 'cue-oreja', 'cue-nariz', 'cue-lengua', 'cue-mano'],
  },
  {
    id: 'salud-higiene', nombre: n('La salud y la higiene', 'La salut i la higiene', 'Health and hygiene'),
    temas: ['salud', 'higiene', 'enfermedad', 'prevencion', 'habito saludable', 'lavarse', 'dientes', 'descanso', 'virus', 'primeros auxilios', 'accidente', 'bienestar', 'vacuna'],
    areas: ['cienciasNaturales', 'educacionFisica', 'valores'],
    dibujos: ['cue-dientes', 'hog-jabon', 'hog-grifo', 'cue-botiquin', 'hog-cama', 'pro-medico'],
  },
  {
    id: 'alimentacion', nombre: n('Alimentación saludable', 'Alimentació saludable', 'Healthy eating'),
    temas: ['alimentacion', 'alimento', 'nutriente', 'dieta', 'piramide alimentaria', 'desayuno', 'comida', 'saludable', 'vitamina', 'proteina', 'hidrato', 'nutricion', 'menu'],
    areas: ['cienciasNaturales', 'educacionFisica'],
    dibujos: ['com-manzana', 'com-pan', 'com-queso', 'com-pescado', 'com-agua', 'com-brocoli', 'com-huevo', 'com-zanahoria', 'com-helado'],
  },
  {
    id: 'frutas-verduras', nombre: n('Las frutas y la huerta', 'Les fruites i l’hort', 'Fruit and the vegetable garden'),
    temas: ['fruta', 'verdura', 'hortaliza', 'huerta', 'huerto', 'cosecha', 'fresa', 'manzana', 'naranja', 'platano', 'uva', 'tomate', 'zanahoria', 'patata', 'legumbre'],
    areas: ['cienciasNaturales', 'general'],
    dibujos: ['com-manzana', 'com-naranja', 'com-platano', 'com-pera', 'com-fresa', 'com-uvas', 'com-sandia', 'com-limon', 'com-tomate', 'com-zanahoria', 'com-patata', 'com-brocoli'],
  },

  /* ── Matemáticas ── */
  {
    id: 'numeros-calculo', nombre: n('Números y cálculo', 'Nombres i càlcul', 'Numbers and calculation'),
    temas: ['numero', 'cifra', 'suma', 'resta', 'multiplicacion', 'division', 'calculo', 'operacion', 'tabla de multiplicar', 'problema', 'cantidad', 'contar', 'sumar', 'restar', 'descomposicion', 'millar', 'decimal', 'potencia', 'ecuacion', 'entero', 'ordenar numeros', 'numeros romanos', 'numeracion romana'],
    areas: ['matematicas'],
    dibujos: ['mat-abaco', 'esc-calculadora', 'mat-dados', 'mat-domino', 'mat-monedas', 'mat-cartas', 'jue-bloques'],
  },
  {
    id: 'fracciones-reparto', nombre: n('Repartir en partes iguales', 'Repartir en parts iguals', 'Sharing in equal parts'),
    temas: ['fraccion', 'mitad', 'tercio', 'cuarto', 'partes iguales', 'reparto', 'repartir', 'porcion', 'numerador', 'denominador', 'porcentaje', 'proporcion', 'razon'],
    areas: ['matematicas'],
    dibujos: ['mat-pizza', 'com-tarta', 'com-naranja', 'com-sandia', 'mat-grafico-tarta', 'mat-jarra', 'com-queso', 'com-pan'],
  },
  {
    id: 'geometria', nombre: n('Formas y geometría', 'Formes i geometria', 'Shapes and geometry'),
    temas: ['geometria', 'figura', 'forma', 'poligono', 'triangulo', 'cuadrado', 'circulo', 'circunferencia', 'cuerpo geometrico', 'cubo', 'esfera', 'cono', 'cilindro', 'area', 'perimetro', 'volumen', 'angulo', 'simetria', 'rectangulo', 'prisma'],
    areas: ['matematicas', 'plastica'],
    dibujos: ['mat-figuras', 'mat-cubo', 'mat-esfera', 'mat-cono', 'mat-cilindro', 'mat-compas'],
  },
  {
    id: 'medida', nombre: n('Medir: tiempo, peso y capacidad', 'Mesurar: temps, pes i capacitat', 'Measuring: time, weight and capacity'),
    temas: ['medida', 'medir', 'longitud', 'peso', 'masa', 'capacidad', 'litro', 'kilo', 'gramo', 'tiempo', 'hora', 'reloj', 'minuto', 'temperatura', 'unidad de medida', 'magnitud', 'metro'],
    areas: ['matematicas', 'cienciasNaturales'],
    dibujos: ['mat-reloj', 'mat-balanza', 'mat-jarra', 'mat-termometro', 'cie-probeta'],
  },
  {
    id: 'estadistica-azar', nombre: n('Datos, gráficos y azar', 'Dades, gràfics i atzar', 'Data, charts and chance'),
    temas: ['estadistica', 'grafico', 'datos', 'tabla de datos', 'encuesta', 'probabilidad', 'azar', 'media', 'moda', 'frecuencia', 'diagrama', 'barras', 'suceso'],
    areas: ['matematicas'],
    dibujos: ['mat-grafico-barras', 'mat-grafico-tarta', 'mat-dados', 'mat-cartas', 'mat-domino'],
  },
  {
    id: 'mercado-dinero', nombre: n('El mercado y el dinero', 'El mercat i els diners', 'The market and money'),
    temas: ['dinero', 'euro', 'moneda', 'comprar', 'vender', 'precio', 'tienda', 'mercado', 'cambio', 'presupuesto', 'ahorro', 'economia', 'compra', 'comercio', 'consumo'],
    areas: ['matematicas', 'cienciasSociales'],
    dibujos: ['mat-monedas', 'lug-mercado', 'lug-tienda', 'esc-calculadora', 'mat-balanza', 'com-naranja', 'com-platano'],
  },
  {
    id: 'juegos-ingenio', nombre: n('Juegos de mesa y de ingenio', 'Jocs de taula i d’enginy', 'Board games and brain games'),
    temas: ['juego', 'ajedrez', 'estrategia', 'logica', 'puzle', 'rompecabezas', 'ingenio', 'acertijo', 'domino', 'cartas', 'pensamiento', 'razonamiento'],
    areas: ['matematicas', 'general'],
    dibujos: ['mat-ajedrez', 'mat-dados', 'mat-domino', 'mat-cartas', 'jue-puzzle', 'jue-bloques'],
  },

  /* ── Lengua, idiomas y comunicación ── */
  {
    id: 'lectura-escritura', nombre: n('Leer y escribir', 'Llegir i escriure', 'Reading and writing'),
    temas: ['lectura', 'leer', 'escritura', 'escribir', 'redaccion', 'cuento', 'texto', 'biblioteca', 'libro', 'narracion', 'gramatica', 'ortografia', 'vocabulario', 'palabra', 'oracion', 'poesia', 'literatura', 'sustantivo', 'verbo', 'adjetivo', 'sinonimo', 'resumen'],
    areas: ['lengua'],
    dibujos: ['esc-libro', 'esc-cuaderno', 'his-tintero', 'his-pergamino', 'lug-biblioteca', 'idi-carta', 'idi-bocadillo', 'esc-lapices', 'his-imprenta', 'cue-libro-magico', 'per-nino-leyendo', 'per-nina-leyendo'],
  },
  {
    id: 'comunicacion', nombre: n('Comunicar y conversar', 'Comunicar i conversar', 'Communicating and chatting'),
    temas: ['comunicacion', 'conversacion', 'dialogo', 'hablar', 'carta', 'mensaje', 'telefono', 'idioma', 'saludo', 'presentarse', 'greetings', 'hello', 'expresion oral', 'debate', 'entrevista'],
    areas: ['ingles', 'lengua'],
    dibujos: ['idi-bocadillo', 'idi-carta', 'idi-telefono', 'tec-movil', 'val-amigos', 'tec-auriculares', 'obj-microfono', 'obj-radio', 'obj-periodico'],
  },

  /* ── Cuentos, aventuras y niños: para ilustrar textos narrativos (17-10-2026) ── */
  {
    id: 'cuentos-fantasia', nombre: n('Cuentos y fantasía', 'Contes i fantasia', 'Tales and fantasy'),
    // «cuento» también es de «Leer y escribir»: con un cuento, ganan los dibujos de cuento
    temas: ['cuento', 'leyenda', 'fabula', 'fantasia', 'fantastico', 'hada', 'dragon', 'princesa', 'mago', 'magia', 'bruja', 'duende', 'hechizo', 'encantado', 'caperucita', 'sirena', 'unicornio', 'fantasma', 'cuento de hadas', 'cuento popular', 'cuento clasico'],
    areas: ['lengua', 'ingles'],
    dibujos: ['cue-dragon', 'cue-princesa', 'cue-hada', 'cue-mago', 'cue-bruja', 'cue-unicornio', 'cue-rey', 'cue-fantasma', 'cue-sirena', 'cue-duende', 'cue-caperucita', 'cue-lobo', 'cue-varita', 'cue-pocion', 'cue-libro-magico', 'cue-lampara', 'his-castillo', 'his-corona', 'cue-molino', 'cue-cabana', 'obj-vela'],
  },
  {
    id: 'aventura-misterio', nombre: n('Aventuras y misterio', 'Aventures i misteri', 'Adventure and mystery'),
    // Sin «tesoro» ni «pirata» (son de «Descubrimientos y aventuras», en Sociales) ni «investigar» (del laboratorio)
    temas: ['aventura', 'misterio', 'detective', 'explorador', 'cofre', 'enigma', 'secreto', 'suspense', 'policiaco', 'policiaca', 'busqueda del tesoro'],
    areas: ['lengua', 'ingles'],
    dibujos: ['per-detective', 'per-explorador', 'obj-cofre', 'obj-llave', 'his-tesoro', 'his-pirata', 'obj-linterna', 'nat-cueva', 'cue-cabana', 'cue-casa-luna', 'cue-camino', 'cue-fantasma', 'obj-periodico', 'obj-radio', 'obj-vela'],
  },
  {
    id: 'ninos-cotidiano', nombre: n('Niños y niñas', 'Nens i nenes', 'Boys and girls'),
    amplio: true,
    temas: ['nino', 'nina', 'vida cotidiana', 'cotidiano', 'personaje', 'dia a dia'],
    areas: ['lengua', 'valores'],
    dibujos: ['per-nino', 'per-nina', 'per-nino-leyendo', 'per-nina-leyendo', 'per-nino-durmiendo', 'per-abuela', 'per-abuelo', 'esc-mochila', 'tra-bicicleta', 'jue-cometa', 'val-regalo', 'idi-carta', 'cue-casa-arbol', 'cue-camino', 'obj-campana', 'val-amigos'],
  },
  {
    id: 'escuela', nombre: n('El cole y la clase', 'L’escola i la classe', 'School and the classroom'),
    amplio: true,
    temas: ['cole', 'colegio', 'clase', 'aula', 'escuela', 'material escolar', 'estudiar', 'curso', 'profesor', 'alumno', 'normas de clase', 'repaso', 'estudio', 'examen'],
    areas: ['general', 'lengua', 'ingles'],
    dibujos: ['esc-mochila', 'esc-estuche', 'esc-lapices', 'esc-pizarra', 'esc-cuaderno', 'esc-libro', 'esc-autobus', 'pro-docente', 'esc-tijeras', 'esc-pegamento', 'esc-diploma', 'esc-medalla', 'obj-campana'],
  },

  /* ── Ciencia y tecnología ── */
  {
    id: 'laboratorio', nombre: n('El laboratorio y el método científico', 'El laboratori i el mètode científic', 'The laboratory and the scientific method'),
    amplio: true,
    temas: ['laboratorio', 'experimento', 'metodo cientifico', 'investigar', 'hipotesis', 'observacion', 'materia', 'mezcla', 'atomo', 'molecula', 'microscopio', 'celula', 'adn', 'quimica', 'cientifico', 'luz'],
    areas: ['cienciasNaturales'],
    dibujos: ['pro-cientifico', 'esc-microscopio', 'cie-probeta', 'cie-prisma', 'cie-atomo', 'cie-adn'],
  },
  {
    id: 'energia', nombre: n('Energía y electricidad', 'Energia i electricitat', 'Energy and electricity'),
    temas: ['energia', 'electricidad', 'circuito', 'pila', 'bateria', 'corriente', 'renovable', 'energias renovables', 'solar', 'eolica', 'iman', 'magnetismo', 'bombilla', 'electrico'],
    areas: ['cienciasNaturales'],
    dibujos: ['cie-circuito', 'cie-bateria', 'cie-renovables', 'cie-iman', 'hog-lampara', 'nat-sol', 'nat-viento'],
  },
  {
    id: 'maquinas', nombre: n('Máquinas y fuerzas', 'Màquines i forces', 'Machines and forces'),
    temas: ['maquina', 'fuerza', 'movimiento', 'palanca', 'polea', 'engranaje', 'mecanismo', 'robot', 'rozamiento', 'invento', 'mecanica', 'operador'],
    areas: ['cienciasNaturales'],
    dibujos: ['cie-engranajes', 'cie-polea', 'cie-robot', 'cie-iman', 'his-locomotora', 'tra-tren'],
  },
  {
    id: 'medio-ambiente', nombre: n('Cuidar el planeta', 'Cuidar el planeta', 'Caring for the planet'),
    temas: ['medio ambiente', 'reciclaje', 'reciclar', 'residuo', 'basura', 'sostenible', 'sostenibilidad', 'contaminacion', 'cambio climatico', 'ecologia', 'reutilizar', 'biodiversidad', 'ahorro de energia', 'ods'],
    areas: ['cienciasNaturales', 'valores', 'cienciasSociales'],
    dibujos: ['cie-reciclaje', 'val-planeta', 'cie-renovables', 'nat-arbol', 'hog-grifo', 'nat-tierra'],
  },
  {
    id: 'tecnologia-digital', nombre: n('La tecnología digital', 'La tecnologia digital', 'Digital technology'),
    temas: ['tecnologia', 'digital', 'ordenador', 'informatica', 'internet', 'programacion', 'pantalla', 'robotica', 'app', 'tablet', 'movil', 'ciberseguridad', 'navegador', 'teclado', 'raton', 'camara', 'fotografia'],
    areas: ['general', 'cienciasNaturales'],
    dibujos: ['tec-ordenador', 'tec-tablet', 'tec-movil', 'tec-teclado', 'tec-raton', 'tec-camara', 'tec-auriculares', 'cie-robot'],
  },

  /* ── Transporte, ciudad y sociedad ── */
  {
    id: 'transporte-tierra', nombre: n('Los transportes por tierra', 'Els transports per terra', 'Land transport'),
    temas: ['transporte', 'vehiculo', 'coche', 'autobus', 'tren', 'camion', 'bicicleta', 'carretera', 'movilidad', 'moto', 'patinete', 'ferrocarril'],
    areas: ['cienciasSociales', 'general'],
    dibujos: ['tra-coche', 'tra-autobus', 'tra-camion', 'tra-tren', 'tra-moto', 'tra-bicicleta', 'tra-patinete', 'tra-ambulancia'],
  },
  {
    id: 'transporte-aire-mar', nombre: n('Transportes por aire y por agua', 'Transports per aire i per aigua', 'Air and water transport'),
    temas: ['avion', 'helicoptero', 'barco', 'aire', 'submarino', 'globo aerostatico', 'aeropuerto', 'puerto', 'viaje', 'aviacion', 'navegacion'],
    areas: ['cienciasSociales', 'general'],
    dibujos: ['tra-avion', 'tra-helicoptero', 'tra-globo', 'tra-submarino', 'his-carabela', 'pro-piloto'],
  },
  {
    id: 'seguridad-vial', nombre: n('Seguridad y educación vial', 'Seguretat i educació viària', 'Safety and road safety'),
    temas: ['seguridad vial', 'educacion vial', 'semaforo', 'senal', 'peaton', 'cruzar', 'casco', 'cinturon', 'trafico', 'prevencion', 'emergencia', 'incendio', 'accidente', 'seguridad', 'peligro', 'norma'],
    areas: ['cienciasSociales', 'valores', 'educacionFisica'],
    dibujos: ['seg-semaforo', 'seg-stop', 'seg-casco', 'seg-extintor', 'tra-ambulancia', 'pro-policia', 'pro-bombero', 'tra-bicicleta'],
  },
  {
    id: 'oficios', nombre: n('Los oficios y las profesiones', 'Els oficis i les professions', 'Jobs and professions'),
    temas: ['profesion', 'oficio', 'trabajo', 'trabajador', 'servicios', 'sector', 'futuro', 'vocacion', 'empleo', 'sector primario', 'sector secundario', 'sector terciario'],
    areas: ['cienciasSociales', 'valores', 'general'],
    dibujos: ['pro-docente', 'pro-medico', 'pro-bombero', 'pro-policia', 'pro-cocinero', 'pro-panadero', 'pro-agricultor', 'pro-pescador', 'pro-cartero', 'pro-albanil', 'pro-cientifico', 'pro-pintor', 'pro-piloto', 'pro-veterinario'],
  },
  {
    id: 'ciudad-pueblo', nombre: n('La ciudad y el pueblo', 'La ciutat i el poble', 'The city and the town'),
    temas: ['ciudad', 'pueblo', 'barrio', 'localidad', 'urbanismo', 'servicios publicos', 'edificio', 'plano', 'entorno', 'comunidad', 'ayuntamiento', 'municipio', 'calle', 'poblacion', 'urbano', 'rural'],
    areas: ['cienciasSociales'],
    dibujos: ['lug-ciudad', 'lug-ayuntamiento', 'lug-biblioteca', 'lug-hospital', 'lug-parque', 'lug-mercado', 'lug-tienda', 'lug-estadio', 'lug-puente'],
  },
  {
    id: 'casa-familia', nombre: n('La casa y la familia', 'La casa i la família', 'Home and family'),
    temas: ['casa', 'hogar', 'familia', 'vivienda', 'habitacion', 'mueble', 'tareas del hogar', 'hermano', 'padres', 'abuelo', 'convivencia familiar'],
    areas: ['valores', 'cienciasSociales', 'general'],
    dibujos: ['lug-casa', 'val-familia', 'hog-cama', 'hog-mesa', 'hog-lampara', 'hog-escoba', 'hog-olla', 'hog-cubiertos', 'per-abuela', 'per-abuelo'],
  },
  {
    id: 'cocina', nombre: n('La cocina y la receta', 'La cuina i la recepta', 'The kitchen and recipes'),
    temas: ['cocina', 'receta', 'cocinar', 'ingrediente', 'cocinero', 'hornear', 'plato', 'gastronomia', 'masa', 'pan'],
    areas: ['general', 'cienciasNaturales', 'lengua'],
    dibujos: ['pro-cocinero', 'hog-olla', 'hog-cubiertos', 'com-huevo', 'com-pan', 'com-tomate', 'pro-panadero', 'com-pescado'],
  },

  /* ── Historia ── */
  {
    id: 'prehistoria', nombre: n('La Prehistoria', 'La Prehistòria', 'Prehistory'),
    temas: ['prehistoria', 'paleolitico', 'neolitico', 'cueva', 'cazador', 'mamut', 'dinosaurio', 'fosil', 'edad de piedra', 'homo sapiens', 'evolucion', 'primeros humanos'],
    areas: ['cienciasSociales'],
    dibujos: ['his-prehistoria', 'his-mamut', 'his-dinosaurio', 'nat-cueva', 'nat-volcan'],
  },
  {
    id: 'antiguedad', nombre: n('Egipto, Grecia y Roma', 'Egipte, Grècia i Roma', 'Egypt, Greece and Rome'),
    temas: ['egipto', 'faraon', 'piramide', 'grecia', 'roma', 'romano', 'antiguedad', 'edad antigua', 'templo', 'anfora', 'civilizacion', 'imperio', 'mitologia', 'griego', 'mesopotamia'],
    areas: ['cienciasSociales'],
    dibujos: ['his-faraon', 'his-piramide', 'his-romano', 'his-templo', 'his-anfora', 'his-pergamino', 'nat-desierto'],
  },
  {
    id: 'edad-media', nombre: n('La Edad Media', 'L’Edat Mitjana', 'The Middle Ages'),
    temas: ['edad media', 'medieval', 'castillo', 'caballero', 'rey', 'feudal', 'vikingo', 'monarquia', 'reino', 'noble', 'corona', 'cruzada', 'al-andalus', 'musulman'],
    areas: ['cienciasSociales'],
    dibujos: ['his-castillo', 'his-caballero', 'his-corona', 'his-vikingo', 'his-pergamino'],
  },
  {
    id: 'descubrimientos', nombre: n('Descubrimientos y aventuras', 'Descobriments i aventures', 'Discoveries and adventures'),
    temas: ['descubrimiento', 'america', 'colon', 'exploracion', 'navegante', 'pirata', 'tesoro', 'mapa', 'aventura', 'edad moderna', 'conquista', 'expedicion', 'escape'],
    areas: ['cienciasSociales', 'general'],
    dibujos: ['his-carabela', 'his-pirata', 'his-tesoro', 'his-pergamino', 'nat-isla', 'esp-telescopio'],
  },
  {
    id: 'industria', nombre: n('La Revolución Industrial', 'La Revolució Industrial', 'The Industrial Revolution'),
    temas: ['revolucion industrial', 'industria', 'maquina de vapor', 'vapor', 'locomotora', 'imprenta', 'inventos', 'fabrica', 'edad contemporanea', 'siglo xix', 'industrial'],
    areas: ['cienciasSociales'],
    dibujos: ['his-locomotora', 'his-imprenta', 'cie-engranajes', 'tra-tren', 'cie-polea'],
  },

  /* ── Artes, deporte y valores ── */
  {
    id: 'musica', nombre: n('Los instrumentos musicales', 'Els instruments musicals', 'Musical instruments'),
    temas: ['musica', 'instrumento', 'ritmo', 'melodia', 'nota', 'pentagrama', 'orquesta', 'cantar', 'canto', 'sonido', 'compas', 'partitura', 'cancion', 'coro', 'percusion'],
    areas: ['musica'],
    dibujos: ['mus-clave', 'mus-guitarra', 'mus-piano', 'mus-violin', 'mus-tambor', 'mus-flauta', 'mus-trompeta', 'mus-maracas', 'mus-xilofono', 'tec-auriculares'],
  },
  {
    id: 'arte', nombre: n('El arte y la plástica', 'L’art i la plàstica', 'Art and crafts'),
    temas: ['arte', 'plastica', 'pintura', 'dibujo', 'color', 'colores', 'artista', 'escultura', 'manualidad', 'museo', 'creatividad', 'collage', 'modelar', 'acuarela', 'taller'],
    areas: ['plastica'],
    dibujos: ['art-caballete', 'art-pinceles', 'art-acuarelas', 'art-plastilina', 'art-marco', 'pro-pintor', 'esc-tijeras', 'esc-pegamento', 'esc-lapices'],
  },
  {
    id: 'deporte', nombre: n('El deporte y el movimiento', 'L’esport i el moviment', 'Sport and movement'),
    temas: ['deporte', 'ejercicio', 'educacion fisica', 'equipo', 'carrera', 'natacion', 'gimnasia', 'olimpiadas', 'motricidad', 'balon', 'futbol', 'baloncesto', 'tenis', 'voleibol', 'patines', 'condicion fisica', 'juego deportivo'],
    areas: ['educacionFisica'],
    dibujos: ['dep-futbol', 'dep-baloncesto', 'dep-tenis', 'dep-voleibol', 'dep-natacion', 'dep-gimnasia', 'dep-patines', 'dep-cuerda', 'dep-zapatillas', 'cue-musculo', 'com-agua'],
  },
  {
    id: 'valores-emociones', nombre: n('Valores y emociones', 'Valors i emocions', 'Values and emotions'),
    temas: ['valor', 'emocion', 'sentimiento', 'amistad', 'respeto', 'paz', 'convivencia', 'empatia', 'solidaridad', 'derechos', 'igualdad', 'justicia', 'tolerancia', 'diversidad', 'inclusion', 'autoestima', 'cooperacion', 'responsabilidad', 'etica', 'religion'],
    areas: ['valores'],
    dibujos: ['val-emociones', 'val-amigos', 'val-abrazo', 'val-paloma', 'val-corazon', 'val-manos', 'val-justicia', 'val-regalo', 'val-planeta'],
  },
  {
    id: 'ropa', nombre: n('La ropa y el vestir', 'La roba i el vestir', 'Clothes'),
    temas: ['ropa', 'vestir', 'prenda', 'vestido', 'calzado', 'abrigo', 'moda', 'zapato', 'uniforme', 'tela', 'textil', 'calcetin'],
    areas: ['general', 'cienciasNaturales'],
    dibujos: ['rop-ropa', 'rop-vestido', 'rop-zapatos', 'rop-calcetines', 'rop-abrigo', 'tie-bufanda', 'tie-gafas', 'tie-botas'],
  },
  {
    id: 'fiestas', nombre: n('Fiestas y tradiciones', 'Festes i tradicions', 'Festivals and traditions'),
    temas: ['fiesta', 'tradicion', 'navidad', 'pascua', 'carnaval', 'cumpleanos', 'celebracion', 'halloween', 'fallas', 'festividad', 'regalo', 'castanada', 'reyes magos', 'cultura popular'],
    areas: ['general', 'cienciasSociales', 'valores'],
    dibujos: ['fes-navidad', 'fes-globos', 'fes-gorro', 'fes-fuegos', 'fes-pascua', 'fes-calabaza', 'fes-castanas', 'val-regalo', 'com-tarta'],
  },
  {
    id: 'juguetes-recreo', nombre: n('Los juguetes y el recreo', 'Les joguines i el pati', 'Toys and playtime'),
    temas: ['juguete', 'recreo', 'patio', 'jugar', 'infancia', 'juegos tradicionales', 'parque', 'columpio', 'cometa', 'peluche', 'trompo'],
    areas: ['educacionFisica', 'valores', 'general'],
    dibujos: ['jue-pelota', 'jue-peonza', 'jue-cometa', 'jue-peluche', 'jue-bloques', 'jue-columpio', 'jue-puzzle', 'lug-parque'],
  },
];

/* ── Consultas ── */

const POR_ID = new Map(HILOS.map(h => [h.id, h]));

export const hiloPorId = (id: string | undefined | null): Hilo | undefined => (id ? POR_ID.get(id) : undefined);

/** Los hilos a los que pertenece un dibujo. */
export const hilosDeDibujo = (ilustracionId: string): Hilo[] => HILOS.filter(h => h.dibujos.includes(ilustracionId));

/** Cuántos dibujos del hilo forman la cabecera de la hoja: los primeros. */
export const DIBUJOS_CABECERA = 3;

/** Los dibujos de un hilo, como entradas del catálogo (los que no existan se saltan). */
export const dibujosDeHilo = (hilo: Hilo): Ilustracion[] =>
  hilo.dibujos.map(id => ilustracionPorId(id)).filter((i): i is Ilustracion => !!i);

/**
 * Dibujos que tiene sentido repetir para contarlos («¿cuántas manzanas hay?»):
 * objetos sueltos, no partes del cuerpo, lugares, personas, escenas ni
 * gráficos. La cantidad la pone el código al maquetar, así que el recuento
 * siempre es exacto.
 */
const CONTABLES_PREFIJO = new Set(['ani', 'com', 'jue', 'esc', 'art', 'mus', 'dep', 'rop', 'fes', 'hog', 'tec', 'tra', 'tie', 'obj']);
const NO_CONTABLES = new Set([
  'com-agua', 'esc-pizarra', 'esc-diploma', 'esc-autobus', 'tra-ambulancia', 'tra-submarino', 'hog-mesa', 'hog-cama',
  'fes-fuegos', 'fes-navidad', 'tie-amanecer', 'tie-noche', 'dep-natacion', 'dep-gimnasia', 'rop-ropa', 'tec-ordenador',
]);
const CONTABLES_EXTRA = new Set(['nat-flor', 'nat-seta', 'nat-arbol', 'nat-frutal', 'nat-copo', 'mat-dados', 'mat-monedas', 'mat-cartas', 'mat-domino', 'mat-pizza', 'mat-figuras', 'cie-bateria', 'cie-iman', 'cie-engranajes', 'cie-robot', 'cie-probeta', 'his-corona', 'his-anfora', 'esp-estrella', 'esp-luna', 'esp-cohete', 'seg-casco', 'seg-extintor',
  // Cuentos: criaturas y objetos sueltos que se cuentan; los personajes, la realeza y las escenas, no
  'cue-dragon', 'cue-fantasma', 'cue-unicornio', 'cue-lobo', 'cue-varita', 'cue-pocion', 'cue-libro-magico', 'cue-lampara']);

export function esContable(ilustracionId: string): boolean {
  if (NO_CONTABLES.has(ilustracionId)) return false;
  return CONTABLES_EXTRA.has(ilustracionId) || CONTABLES_PREFIJO.has(ilustracionId.split('-')[0]);
}

/** Qué hilo por defecto tiene cada área cuando el tema no dice nada más. */
const HILO_DEL_AREA: Record<FichaMotifKey, string> = {
  matematicas: 'numeros-calculo',
  lengua: 'lectura-escritura',
  ingles: 'comunicacion',
  cienciasNaturales: 'seres-vivos',
  cienciasSociales: 'ciudad-pueblo',
  musica: 'musica',
  educacionFisica: 'deporte',
  plastica: 'arte',
  valores: 'valores-emociones',
  general: 'escuela',
};

export interface HiloDetectado { hilo: Hilo; puntos: number }

/**
 * De qué trata una ficha, de más a menos: cada palabra del hilo que sale en el
 * tema o el área vale 3 (más si es larga, más específica); que el hilo sea del
 * área que se deduce, 1,5; y cada dibujo suyo que encaja con el tema, 0,5 (hasta
 * 2). A un hilo `amplio` se le restan 1,5. Un hilo con menos de 3 puntos no cuenta
 * como detectado.
 */
export function detectarHilos(ctx: ContextoIlustracion, max = 3): HiloDetectado[] {
  // Las palabras del hilo se buscan en el tema, no en el área («Ciencias Naturales» no es de ningún hilo)
  const texto = plano(ctx.tema);
  const motivo = areaDe(ctx);
  const out: HiloDetectado[] = [];
  for (const hilo of HILOS) {
    let puntos = 0;
    // «animal» y «animales» son la misma palabra: de las que empiezan igual cuenta la más larga
    const dichas = hilo.temas.filter(t => coincideTema(texto, t));
    for (const t of dichas) if (!dichas.some(o => o !== t && o.startsWith(t))) puntos += 3 + Math.min(1, t.length / 20);
    if (hilo.areas.includes(motivo)) puntos += 1.5;
    let extra = 0;
    for (const il of dibujosDeHilo(hilo)) if (puntuarIlustracion(il, ctx) > 2) extra += 0.5;
    puntos += Math.min(2, extra);
    if (hilo.amplio) puntos -= 1.5;
    if (puntos >= 3) out.push({ hilo, puntos });
  }
  return out.sort((a, b) => b.puntos - a.puntos || a.hilo.id.localeCompare(b.hilo.id)).slice(0, max);
}

/** El hilo que se le pone a una ficha: el mejor detectado o, sin pistas, el del área. */
export function hiloDeFicha(ctx: ContextoIlustracion): Hilo {
  const mejor = detectarHilos(ctx, 1)[0]?.hilo;
  return mejor ?? hiloPorId(HILO_DEL_AREA[areaDe(ctx)])!;
}

const areaDe = (ctx: ContextoIlustracion): FichaMotifKey => pickMotifKey(ctx.tema, ctx.area);
const plano = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Para el prompt de la IA: los dibujos del hilo, «id (descripción)», separados por comas. */
export function listaDibujosParaIA(hilo: Hilo, lang: Lang = 'es'): string {
  return dibujosDeHilo(hilo).map(i => `${i.id}${esContable(i.id) ? '' : ' [solo 1]'} (${i.descripcion[lang]})`).join(', ');
}

/** Todos los dibujos del catálogo `img` que no están en ningún hilo (debe ser ninguno). */
export const dibujosSinHilo = (): string[] =>
  ILUSTRACIONES.filter(i => i.fuente === 'img' && !HILOS.some(h => h.dibujos.includes(i.id))).map(i => i.id);
