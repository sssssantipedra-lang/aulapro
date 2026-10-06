/**
 * El banco de actividades de partida de Educación Física, escrito para
 * AulaPro (decisión del dueño, 5-10-2026: un banco propio, más la IA y las
 * actividades del docente). Son juegos y tareas de uso común en las clases de
 * EF, contados con nuestras palabras; ninguno se copia de un libro. Cada
 * texto va en castellano, catalán e inglés. Ver `docs/EF.md`.
 *
 * La columna «inclusion» sigue el DUA-A: quien tiene una limitación juega la
 * misma actividad con un cambio de reglas, espacio, material o papel.
 */
import type { ActividadEF, ModalidadEF, TipoActividadEF } from '../types/ef';

type Lang = 'es' | 'ca' | 'en';
/** Castellano, catalán e inglés. */
type T3 = readonly [es: string, ca: string, en: string];

interface EntradaBanco {
  id: string;
  tipo: TipoActividadEF;
  modalidad?: ModalidadEF;
  titulo: T3;
  descripcion: T3;
  organizacion: T3;
  material: T3;
  variantes: T3;
  inclusion: T3;
}

const BANCO: readonly EntradaBanco[] = [
  /* ── Juegos motrices ── */
  {
    id: 'banco-panuelo', tipo: 'juego', modalidad: 'tradicionales',
    titulo: ['El pañuelo por números', 'El mocador per números', 'Handkerchief by numbers'],
    descripcion: [
      'Dos equipos frente a frente, con un número para cada jugador. Quien dirige el juego sostiene el pañuelo en el centro y dice un número: los dos jugadores con ese número salen a por él. Gana el punto quien lo lleva a su línea sin que el otro le toque.',
      'Dos equips l\'un davant de l\'altre, amb un número per a cada jugador. Qui dirigeix el joc aguanta el mocador al centre i diu un número: els dos jugadors amb aquest número surten a buscar-lo. Guanya el punt qui el porta a la seva línia sense que l\'altre el toqui.',
      'Two teams face each other, each player with a number. The leader holds the handkerchief in the centre and calls a number: the two players with that number run for it. The point goes to whoever brings it back to their line without being tagged.',
    ],
    organizacion: ['Dos equipos en líneas a 15 m. 10 minutos.', 'Dos equips en línies a 15 m. 10 minuts.', 'Two teams on lines 15 m apart. 10 minutes.'],
    material: ['Un pañuelo o un peto.', 'Un mocador o un pitet.', 'A handkerchief or a bib.'],
    variantes: [
      'Decir una operación («3 + 2») en lugar del número; salir dos números a la vez y cooperar; cambiar el desplazamiento (lateral, a la pata coja, de espaldas).',
      'Dir una operació («3 + 2») en lloc del número; sortir dos números alhora i cooperar; canviar el desplaçament (lateral, a peu coix, d\'esquena).',
      'Call a sum ("3 + 2") instead of the number; call two numbers at once so they cooperate; change the movement (sideways, hopping, backwards).',
    ],
    inclusion: [
      'Quien no puede correr dirige el juego y elige los números, o juega con la norma de que su pareja de número también va andando.',
      'Qui no pot córrer dirigeix el joc i tria els números, o juga amb la norma que la seva parella de número també hi va caminant.',
      'A student who cannot run leads the game and calls the numbers, or plays with the rule that their number partner also walks.',
    ],
  },
  {
    id: 'banco-balon-tiro', tipo: 'juego', modalidad: 'tradicionales',
    titulo: ['Balón tiro', 'Pilota presonera', 'Dodgeball with a back zone'],
    descripcion: [
      'Dos campos y, detrás de cada uno, la zona de «eliminados» del otro equipo. Se lanza para dar a un contrario por debajo de la cintura; quien recibe un impacto pasa a la zona de detrás y desde allí sigue lanzando. Si alguien atrapa el balón, vuelve un compañero.',
      'Dos camps i, darrere de cada un, la zona d\'«eliminats» de l\'altre equip. Es llança per tocar un contrari per sota de la cintura; qui rep un impacte passa a la zona del darrere i des d\'allà continua llançant. Si algú atrapa la pilota, torna un company.',
      'Two halves and, behind each one, the other team\'s "out" zone. Players throw to hit an opponent below the waist; anyone hit goes to the back zone and keeps throwing from there. Catching the ball brings a teammate back.',
    ],
    organizacion: ['Dos equipos en una pista de voleibol. 12 minutos.', 'Dos equips en una pista de voleibol. 12 minuts.', 'Two teams on a volleyball court. 12 minutes.'],
    material: ['Uno o dos balones de espuma.', 'Una o dues pilotes d\'escuma.', 'One or two foam balls.'],
    variantes: [
      'Dos balones a la vez; cada equipo tiene un «sanador» que puede devolver al campo a un compañero; quien atrapa elige quién vuelve.',
      'Dues pilotes alhora; cada equip té un «sanador» que pot retornar al camp un company; qui atrapa tria qui torna.',
      'Two balls at once; each team has a "healer" who can bring a teammate back; whoever catches chooses who returns.',
    ],
    inclusion: [
      'Quien no puede correr o recibir impactos empieza en la zona de detrás, como lanzador con un balón propio, y sus atrapadas valen doble.',
      'Qui no pot córrer o rebre impactes comença a la zona del darrere, com a llançador amb una pilota pròpia, i les seves atrapades valen doble.',
      'A student who cannot run or be hit starts in the back zone as a thrower with their own ball, and their catches count double.',
    ],
  },
  {
    id: 'banco-cortahilos', tipo: 'juego', modalidad: 'tradicionales',
    titulo: ['Cortahílos', 'Talla fils', 'Cut the thread'],
    descripcion: [
      'Quien la para persigue a un jugador, que dice en voz alta su nombre. Cualquiera puede cruzar entre los dos y «cortar el hilo»: entonces se persigue a quien ha cruzado. Si atrapa a quien persigue, cambian los papeles.',
      'Qui para persegueix un jugador, que diu en veu alta el seu nom. Qualsevol pot creuar entre tots dos i «tallar el fil»: llavors es persegueix qui ha creuat. Si atrapa qui persegueix, es canvien els papers.',
      'The chaser goes after one player, who calls out their name. Anyone can run between them and "cut the thread": the chaser then goes after that player. Whoever is caught becomes the chaser.',
    ],
    organizacion: ['Todo el grupo en media pista. 8 minutos.', 'Tot el grup en mitja pista. 8 minuts.', 'The whole group on half a court. 8 minutes.'],
    material: ['Un peto para quien la para.', 'Un pitet per a qui para.', 'A bib for the chaser.'],
    variantes: [
      'Dos perseguidores; desplazamiento solo en cuadrupedia o saltando; cortar el hilo pasando un balón entre los dos.',
      'Dos perseguidors; desplaçament només a quatre grapes o saltant; tallar el fil passant una pilota entre tots dos.',
      'Two chasers; moving only on all fours or jumping; cutting the thread by passing a ball between them.',
    ],
    inclusion: [
      'Quien no puede correr es «el telar»: desde un aro, da una palmada para cambiar a quien se persigue. Así decide el juego sin desplazarse.',
      'Qui no pot córrer és «el teler»: des d\'un cèrcol, pica de mans per canviar qui es persegueix. Així decideix el joc sense desplaçar-se.',
      'A student who cannot run is "the loom": from a hoop, they clap to change who is being chased, so they steer the game without moving.',
    ],
  },
  {
    id: 'banco-diez-pases', tipo: 'juego', modalidad: 'invasion',
    titulo: ['Los diez pases', 'Els deu passis', 'Ten passes'],
    descripcion: [
      'Dos equipos. El que tiene el balón intenta dar diez pases seguidos sin que el otro lo intercepte, contándolos en voz alta. No se puede correr con el balón ni devolverlo a quien te lo ha pasado. Diez pases son un punto.',
      'Dos equips. El que té la pilota intenta fer deu passis seguits sense que l\'altre l\'intercepti, comptant-los en veu alta. No es pot córrer amb la pilota ni tornar-la a qui te l\'ha passada. Deu passis són un punt.',
      'Two teams. The team with the ball tries to make ten passes in a row without the other team intercepting, counting them aloud. No running with the ball and no passing straight back. Ten passes score a point.',
    ],
    organizacion: ['Equipos de 5 o 6 en media pista. 10 minutos.', 'Equips de 5 o 6 en mitja pista. 10 minuts.', 'Teams of 5 or 6 on half a court. 10 minutes.'],
    material: ['Un balón blando y petos de dos colores.', 'Una pilota tova i pitets de dos colors.', 'A soft ball and bibs in two colours.'],
    variantes: [
      'Que hayan tocado el balón todos los del equipo; pases solo con bote; el punto vale si el último pase llega a una zona marcada.',
      'Que hagin tocat la pilota tots els de l\'equip; passis només amb bot; el punt val si l\'últim passi arriba a una zona marcada.',
      'Every player must have touched the ball; bounce passes only; the point counts if the last pass reaches a marked zone.',
    ],
    inclusion: [
      'Quien tiene una limitación juega desde un aro en el que no se le puede defender, y los pases que recibe cuentan doble.',
      'Qui té una limitació juga des d\'un cèrcol en què no se li pot defensar, i els passis que rep compten doble.',
      'A student with a limitation plays from a hoop where they cannot be marked, and passes they receive count double.',
    ],
  },
  /* ── Deportes (juegos modificados) ── */
  {
    id: 'banco-voley-atrapa', tipo: 'deporte', modalidad: 'red-pared',
    titulo: ['Voleibol atrapa y lanza', 'Voleibol agafa i llança', 'Catch-and-throw volleyball'],
    descripcion: [
      'Iniciación al voleibol: se atrapa el balón y se lanza en lugar de golpearlo. Cada equipo hace tres pases antes de pasar la red, y se puntúa si el balón toca el suelo del otro campo. Poco a poco, el tercer pase se convierte en un toque de dedos.',
      'Iniciació al voleibol: s\'atrapa la pilota i es llança en lloc de colpejar-la. Cada equip fa tres passis abans de passar la xarxa, i es puntua si la pilota toca el terra de l\'altre camp. A poc a poc, el tercer passi es converteix en un toc de dits.',
      'An introduction to volleyball: players catch and throw instead of hitting. Each team makes three passes before sending the ball over the net, and scores when the ball lands in the other court. Little by little, the third pass becomes a volley.',
    ],
    organizacion: ['3 contra 3 en pistas de bádminton. 15 minutos.', '3 contra 3 en pistes de bàdminton. 15 minuts.', '3 v 3 on badminton courts. 15 minutes.'],
    material: ['Balones de voleibol blandos y redes o cuerdas a 2 m.', 'Pilotes de voleibol toves i xarxes o cordes a 2 m.', 'Soft volleyballs and nets or ropes at 2 m.'],
    variantes: [
      'Permitir un bote; obligar a que el segundo pase sea de dedos; puntos extra si el balón cae en una zona marcada.',
      'Permetre un bot; obligar que el segon passi sigui de dits; punts extra si la pilota cau en una zona marcada.',
      'Allow one bounce; the second pass must be a volley; extra points if the ball lands in a marked zone.',
    ],
    inclusion: [
      'Con un balón de playa o un globo grande, que va más lento. Quien no puede saltar ni desplazarse rápido juega cerca de la red, donde atrapa y pasa.',
      'Amb una pilota de platja o un globus gran, que va més a poc a poc. Qui no pot saltar ni desplaçar-se de pressa juga a prop de la xarxa, on atrapa i passa.',
      'Use a beach ball or a large balloon, which is slower. A student who cannot jump or move fast plays near the net, catching and passing.',
    ],
  },
  {
    id: 'banco-basket-todos', tipo: 'deporte', modalidad: 'invasion',
    titulo: ['Baloncesto 3 contra 3: todos tocan', 'Bàsquet 3 contra 3: tots toquen', '3 v 3 basketball: everyone touches'],
    descripcion: [
      'Partido a media pista en el que una canasta solo vale si antes han tocado el balón los tres del equipo. Tras canasta o robo, el balón sale de detrás de la línea de tres. Sin contacto: quien defiende, a un brazo de distancia.',
      'Partit a mitja pista en què una cistella només val si abans han tocat la pilota els tres de l\'equip. Després de cistella o robatori, la pilota surt de darrere de la línia de tres. Sense contacte: qui defensa, a un braç de distància.',
      'Half-court game where a basket only counts if all three teammates have touched the ball. After a basket or a steal, the ball goes back behind the three-point line. No contact: defenders stay an arm\'s length away.',
    ],
    organizacion: ['3 contra 3 en cada canasta. 15 minutos, rotando rivales.', '3 contra 3 a cada cistella. 15 minuts, rotant rivals.', '3 v 3 at each basket. 15 minutes, rotating opponents.'],
    material: ['Un balón por canasta y petos.', 'Una pilota per cistella i pitets.', 'One ball per basket and bibs.'],
    variantes: [
      'Canasta que toca el aro vale un punto; prohibido botar (solo pases); cada jugador puede marcar como mucho dos canastas seguidas.',
      'Cistella que toca l\'anella val un punt; prohibit botar (només passis); cada jugador pot fer com a màxim dues cistelles seguides.',
      'A shot that hits the rim scores one point; no dribbling (passes only); each player may score at most two baskets in a row.',
    ],
    inclusion: [
      'Quien no puede correr tiene una zona de tiro propia cerca de la canasta, donde no se le defiende, y sus canastas valen doble.',
      'Qui no pot córrer té una zona de tir pròpia a prop de la cistella, on no se li defensa, i les seves cistelles valen doble.',
      'A student who cannot run has their own shooting zone near the basket, where they cannot be defended, and their baskets count double.',
    ],
  },
  {
    id: 'banco-badminton-coop', tipo: 'deporte', modalidad: 'red-pared',
    titulo: ['Bádminton: de cooperar a competir', 'Bàdminton: de cooperar a competir', 'Badminton: from cooperation to competition'],
    descripcion: [
      'Por parejas, primero se cuentan los golpeos seguidos sin que el volante caiga (cooperación). Después, la misma pareja juega a puntos en un campo pequeño y se busca el hueco libre del otro campo (oposición).',
      'Per parelles, primer es compten els cops seguits sense que el volant caigui (cooperació). Després, la mateixa parella juga a punts en un camp petit i es busca el forat lliure de l\'altre camp (oposició).',
      'In pairs, first count consecutive hits without the shuttle falling (cooperation). Then the same pair plays for points on a small court, looking for the open space on the other side (opposition).',
    ],
    organizacion: ['Por parejas, en medio campo de bádminton. 15 minutos.', 'Per parelles, en mig camp de bàdminton. 15 minuts.', 'In pairs, on half a badminton court. 15 minutes.'],
    material: ['Una raqueta por persona, volantes y una cuerda o red baja.', 'Una raqueta per persona, volants i una corda o xarxa baixa.', 'One racket each, shuttles and a rope or low net.'],
    variantes: [
      'Golpeos solo de revés; récord de la pareja en un minuto; dobles con la norma de golpear alternando.',
      'Cops només de revés; rècord de la parella en un minut; dobles amb la norma de colpejar alternant.',
      'Backhand only; the pair\'s record in one minute; doubles where partners must alternate hits.',
    ],
    inclusion: [
      'Con un globo en lugar del volante, que da más tiempo, o jugando sentado en un campo más estrecho, con la misma puntuación.',
      'Amb un globus en lloc del volant, que dona més temps, o jugant assegut en un camp més estret, amb la mateixa puntuació.',
      'Use a balloon instead of the shuttle, which gives more time, or play seated on a narrower court with the same scoring.',
    ],
  },
  {
    id: 'banco-ultimate', tipo: 'deporte', modalidad: 'invasion',
    titulo: ['Ultimate adaptado', 'Ultimate adaptat', 'Adapted ultimate'],
    descripcion: [
      'Dos equipos intentan atrapar el disco dentro de la zona de marca contraria. Quien tiene el disco no se mueve y tiene diez segundos para pasar. Si el disco cae o se intercepta, cambia la posesión. Sin contacto y con autoarbitraje: las faltas las cantan los propios jugadores.',
      'Dos equips intenten atrapar el disc dins de la zona de marca contrària. Qui té el disc no es mou i té deu segons per passar. Si el disc cau o s\'intercepta, canvia la possessió. Sense contacte i amb autoarbitratge: les faltes les canten els mateixos jugadors.',
      'Two teams try to catch the disc in the opposing end zone. The player holding the disc cannot move and has ten seconds to pass. A dropped or intercepted disc changes possession. No contact and self-refereed: players call their own fouls.',
    ],
    organizacion: ['Equipos de 5 en un campo de 30 × 15 m. 20 minutos.', 'Equips de 5 en un camp de 30 × 15 m. 20 minuts.', 'Teams of 5 on a 30 × 15 m field. 20 minutes.'],
    material: ['Un disco blando por partido, conos y petos.', 'Un disc tou per partit, cons i pitets.', 'One soft disc per game, cones and bibs.'],
    variantes: [
      'Punto solo si han tocado el disco chicos y chicas; zona de marca más pequeña; cinco segundos para pasar.',
      'Punt només si han tocat el disc nois i noies; zona de marca més petita; cinc segons per passar.',
      'A point only counts if both boys and girls touched the disc; smaller end zone; five seconds to pass.',
    ],
    inclusion: [
      'Quien no puede correr juega de «pivote» en el centro del campo, sin que se le defienda: el disco tiene que pasar por sus manos en cada ataque.',
      'Qui no pot córrer juga de «pivot» al centre del camp, sense que se li defensi: el disc ha de passar per les seves mans a cada atac.',
      'A student who cannot run plays as the "pivot" in the middle of the field, unmarked: the disc must pass through their hands in every attack.',
    ],
  },
  /* ── Días de lluvia ── */
  {
    id: 'banco-estatuas-emociones', tipo: 'lluvia',
    titulo: ['Estatuas de emociones', 'Estàtues d\'emocions', 'Emotion statues'],
    descripcion: [
      'Con música, el grupo se mueve libremente. Cuando se para, quien dirige dice una emoción (alegría, miedo, sorpresa, enfado) y todos se quedan quietos expresándola con el cuerpo. Al final, se comenta qué ha sentido cada uno.',
      'Amb música, el grup es mou lliurement. Quan s\'atura, qui dirigeix diu una emoció (alegria, por, sorpresa, enuig) i tothom es queda quiet expressant-la amb el cos. Al final, es comenta què ha sentit cadascú.',
      'With music, the group moves freely. When it stops, the leader names an emotion (joy, fear, surprise, anger) and everyone freezes, showing it with their body. At the end, students share how they felt.',
    ],
    organizacion: ['Todo el grupo en un espacio cubierto pequeño. 10 minutos.', 'Tot el grup en un espai cobert petit. 10 minuts.', 'The whole group in a small indoor space. 10 minutes.'],
    material: ['Música.', 'Música.', 'Music.'],
    variantes: [
      'Estatuas por parejas o por tríos que forman una escena; el resto adivina la emoción; cambiar el ritmo de la música.',
      'Estàtues per parelles o per trios que formen una escena; la resta endevina l\'emoció; canviar el ritme de la música.',
      'Statues in pairs or threes forming a scene; the others guess the emotion; change the pace of the music.',
    ],
    inclusion: [
      'Se puede hacer de pie o sentado, con la cara y los brazos. Quien no puede desplazarse elige la música y las emociones.',
      'Es pot fer dempeus o assegut, amb la cara i els braços. Qui no es pot desplaçar tria la música i les emocions.',
      'It can be done standing or seated, using face and arms. A student who cannot move around chooses the music and the emotions.',
    ],
  },
  {
    id: 'banco-aro-cadena', tipo: 'lluvia', modalidad: 'cooperacion',
    titulo: ['El aro viajero', 'El cèrcol viatger', 'The travelling hoop'],
    descripcion: [
      'En corro y cogidos de las manos, el grupo pasa un aro de uno a otro sin soltarse, pasando el cuerpo por dentro. Se cronometra la vuelta completa y se busca entre todos cómo mejorar el tiempo.',
      'En rotllana i agafats de les mans, el grup passa un cèrcol d\'un a l\'altre sense deixar-se anar, passant el cos per dins. Es cronometra la volta completa i es busca entre tots com millorar el temps.',
      'Standing in a circle holding hands, the group passes a hoop from one person to the next without letting go, stepping through it. Time a full lap and decide together how to beat it.',
    ],
    organizacion: ['Corros de 8 a 12. 8 minutos.', 'Rotllanes de 8 a 12. 8 minuts.', 'Circles of 8 to 12. 8 minutes.'],
    material: ['Un aro grande por corro y un cronómetro.', 'Un cèrcol gran per rotllana i un cronòmetre.', 'One large hoop per circle and a stopwatch.'],
    variantes: [
      'Dos aros en sentidos contrarios; con los ojos cerrados; sin hablar.',
      'Dos cèrcols en sentits contraris; amb els ulls tancats; sense parlar.',
      'Two hoops going opposite ways; with eyes closed; without talking.',
    ],
    inclusion: [
      'Funciona sentados en sillas; quien no puede mover un brazo usa el otro y el compañero le ayuda a pasar el aro.',
      'Funciona asseguts en cadires; qui no pot moure un braç fa servir l\'altre i el company l\'ajuda a passar el cèrcol.',
      'It works seated on chairs; a student who cannot use one arm uses the other, and their neighbour helps them pass the hoop.',
    ],
  },
  {
    id: 'banco-malabares-panuelos', tipo: 'lluvia',
    titulo: ['Malabares con pañuelos', 'Malabars amb mocadors', 'Juggling with scarves'],
    descripcion: [
      'Iniciación a los malabares con pañuelos de gasa, que caen despacio: primero uno, lanzando y recogiendo con cada mano; después dos, en cruz; por último tres, en cascada. Cada uno avanza a su ritmo con retos por niveles.',
      'Iniciació als malabars amb mocadors de gasa, que cauen a poc a poc: primer un, llançant i recollint amb cada mà; després dos, en creu; per acabar tres, en cascada. Cadascú avança al seu ritme amb reptes per nivells.',
      'An introduction to juggling with chiffon scarves, which fall slowly: first one, throwing and catching with each hand; then two, crossing; finally three, in a cascade. Everyone progresses at their own pace through levelled challenges.',
    ],
    organizacion: ['Individual, en un espacio cubierto o en el aula. 15 minutos.', 'Individual, en un espai cobert o a l\'aula. 15 minuts.', 'Individually, indoors or in the classroom. 15 minutes.'],
    material: ['Tres pañuelos de gasa por persona.', 'Tres mocadors de gasa per persona.', 'Three chiffon scarves per person.'],
    variantes: [
      'Por parejas, pasándose un pañuelo; dar una palmada antes de recoger; con pelotas de malabares quien ya domina los pañuelos.',
      'Per parelles, passant-se un mocador; picar de mans abans de recollir; amb pilotes de malabars qui ja domina els mocadors.',
      'In pairs, passing a scarf; clap before catching; juggling balls for those who have mastered the scarves.',
    ],
    inclusion: [
      'Se hace sentado igual que de pie. Con un solo brazo útil, se trabaja con un pañuelo y retos de lanzar y recoger con la misma mano.',
      'Es fa assegut igual que dempeus. Amb un sol braç útil, es treballa amb un mocador i reptes de llançar i recollir amb la mateixa mà.',
      'It can be done seated just as well as standing. With only one usable arm, work with one scarf and throw-and-catch challenges with the same hand.',
    ],
  },
  {
    id: 'banco-bolos', tipo: 'lluvia', modalidad: 'blanco-diana',
    titulo: ['Bolos con botellas', 'Bitlles amb ampolles', 'Bottle bowling'],
    descripcion: [
      'Diez botellas de plástico con un poco de agua forman los bolos. Por equipos, cada jugador tiene dos lanzamientos rodando una pelota; se suman los bolos derribados. Los propios jugadores anotan y vuelven a colocar los bolos.',
      'Deu ampolles de plàstic amb una mica d\'aigua fan de bitlles. Per equips, cada jugador té dos llançaments fent rodar una pilota; se sumen les bitlles tombades. Els mateixos jugadors anoten i tornen a col·locar les bitlles.',
      'Ten plastic bottles with a little water in them are the pins. In teams, each player has two throws, rolling a ball; knocked-down pins are added up. Players keep the score and reset the pins themselves.',
    ],
    organizacion: ['Equipos de 4 o 5, cada uno con su pista de bolos. 15 minutos.', 'Equips de 4 o 5, cadascun amb la seva pista de bitlles. 15 minuts.', 'Teams of 4 or 5, each with its own lane. 15 minutes.'],
    material: ['Botellas de plástico y una pelota por equipo.', 'Ampolles de plàstic i una pilota per equip.', 'Plastic bottles and one ball per team.'],
    variantes: [
      'Lanzar con la mano no dominante; bolos con puntos distintos; lanzar desde más lejos en cada ronda.',
      'Llançar amb la mà no dominant; bitlles amb punts diferents; llançar des de més lluny a cada ronda.',
      'Throw with the non-dominant hand; pins worth different points; throw from further away each round.',
    ],
    inclusion: [
      'Se lanza sentado o de pie, con la mano o con el pie; quien no puede agacharse lanza desde una silla y con una pelota más grande.',
      'Es llança assegut o dempeus, amb la mà o amb el peu; qui no es pot ajupir llança des d\'una cadira i amb una pilota més grossa.',
      'Players can throw seated or standing, by hand or by foot; a student who cannot bend down throws from a chair with a bigger ball.',
    ],
  },
  /* ── Medio natural ── */
  {
    id: 'banco-orientacion-centro', tipo: 'natural', modalidad: 'natural-urbano',
    titulo: ['Orientación en el centro', 'Orientació al centre', 'Orienteering around the school'],
    descripcion: [
      'Con un plano del patio y del centro, por parejas, se buscan balizas escondidas en un orden libre. Cada baliza tiene una letra; con todas se forma una palabra. Gana la pareja que la forma bien, no solo la más rápida.',
      'Amb un plànol del pati i del centre, per parelles, es busquen fites amagades en un ordre lliure. Cada fita té una lletra; amb totes es forma una paraula. Guanya la parella que la forma bé, no només la més ràpida.',
      'With a map of the playground and school, in pairs, students look for hidden controls in any order. Each control has a letter; together they spell a word. The winning pair is the one that gets the word right, not just the fastest.',
    ],
    organizacion: ['Por parejas, en el patio y alrededores. 25 minutos.', 'Per parelles, al pati i els voltants. 25 minuts.', 'In pairs, around the playground. 25 minutes.'],
    material: ['Planos del centro, 10 balizas con letra y lápices.', 'Plànols del centre, 10 fites amb lletra i llapis.', 'School maps, 10 controls with letters and pencils.'],
    variantes: [
      'Recorrido en orden fijo; balizas con preguntas de otras materias; cambiar de pareja a mitad del recorrido.',
      'Recorregut en ordre fix; fites amb preguntes d\'altres matèries; canviar de parella a mig recorregut.',
      'A fixed-order course; controls with questions from other subjects; swap partners halfway.',
    ],
    inclusion: [
      'Recorrido sin escaleras ni obstáculos. Quien no puede correr orienta el plano y decide la ruta; el tiempo no cuenta, solo la palabra.',
      'Recorregut sense escales ni obstacles. Qui no pot córrer orienta el plànol i decideix la ruta; el temps no compta, només la paraula.',
      'A course without stairs or obstacles. A student who cannot run orients the map and chooses the route; time does not count, only the word.',
    ],
  },
  {
    id: 'banco-rastreo', tipo: 'natural', modalidad: 'natural-urbano',
    titulo: ['Rastreo con señales de pista', 'Rastreig amb senyals de pista', 'Trail-sign tracking'],
    descripcion: [
      'Un equipo marca un recorrido con señales de pista hechas con piedras, palos o tiza (seguir, girar, peligro, mensaje escondido). Diez minutos después, otro equipo lo sigue hasta encontrar el mensaje final.',
      'Un equip marca un recorregut amb senyals de pista fets amb pedres, branques o guix (seguir, girar, perill, missatge amagat). Deu minuts després, un altre equip el segueix fins a trobar el missatge final.',
      'One team marks a route with trail signs made of stones, sticks or chalk (go this way, turn, danger, hidden message). Ten minutes later, another team follows it to the final message.',
    ],
    organizacion: ['Equipos de 4 a 6, en el patio o en un parque. 25 minutos.', 'Equips de 4 a 6, al pati o en un parc. 25 minuts.', 'Teams of 4 to 6, in the playground or a park. 25 minutes.'],
    material: ['Tiza, piedras o palos, y una tarjeta con las señales.', 'Guix, pedres o branques, i una targeta amb els senyals.', 'Chalk, stones or sticks, and a card with the signs.'],
    variantes: [
      'Señales en clave inventada por cada equipo; recorrido de ida y vuelta; dibujar el plano del recorrido al acabar.',
      'Senyals en clau inventada per cada equip; recorregut d\'anada i tornada; dibuixar el plànol del recorregut en acabar.',
      'Signs in a code each team invents; an out-and-back route; draw a map of the route at the end.',
    ],
    inclusion: [
      'El recorrido va por terreno firme. Quien no puede desplazarse mucho diseña las señales y el mensaje y los comprueba al final.',
      'El recorregut va per terreny ferm. Qui no es pot desplaçar gaire dissenya els senyals i el missatge i els comprova al final.',
      'The route stays on firm ground. A student who cannot move much designs the signs and the message and checks them at the end.',
    ],
  },
  {
    id: 'banco-nudos', tipo: 'natural', modalidad: 'natural-urbano',
    titulo: ['Nudos básicos por relevos', 'Nusos bàsics per relleus', 'Basic knots relay'],
    descripcion: [
      'Se aprenden tres nudos útiles en la montaña (as de guía, ballestrinque y nudo en ocho) con una ficha de pasos. Después, por relevos: cada jugador hace un nudo, el siguiente lo revisa y lo deshace, y hace el suyo.',
      'S\'aprenen tres nusos útils a la muntanya (as de guia, ballestrinca i nus en vuit) amb una fitxa de passos. Després, per relleus: cada jugador fa un nus, el següent el revisa, el desfà i fa el seu.',
      'Students learn three useful outdoor knots (bowline, clove hitch and figure-eight) using a step card. Then, as a relay: each player ties a knot, the next one checks it, unties it and ties theirs.',
    ],
    organizacion: ['Equipos de 4, en el aula o en el porche. 20 minutos.', 'Equips de 4, a l\'aula o al porxo. 20 minuts.', 'Teams of 4, in the classroom or under cover. 20 minutes.'],
    material: ['Una cuerda de 1,5 m por persona y fichas con los pasos.', 'Una corda d\'1,5 m per persona i fitxes amb els passos.', 'A 1.5 m rope per person and step cards.'],
    variantes: [
      'Nudos con los ojos cerrados; atar una cuerda a un poste o a un árbol; enseñar un nudo a otro equipo.',
      'Nusos amb els ulls tancats; lligar una corda a un pal o a un arbre; ensenyar un nus a un altre equip.',
      'Tie knots with eyes closed; tie a rope to a post or a tree; teach a knot to another team.',
    ],
    inclusion: [
      'No exige desplazamiento. Con un solo brazo útil, en pareja: uno sujeta y el otro anuda, y se cambian los papeles.',
      'No exigeix desplaçament. Amb un sol braç útil, en parella: un subjecta i l\'altre fa el nus, i es canvien els papers.',
      'No movement is needed. With only one usable arm, work in pairs: one holds while the other ties, then swap roles.',
    ],
  },
  {
    id: 'banco-foto-orientacion', tipo: 'natural', modalidad: 'natural-urbano',
    titulo: ['Foto-orientación', 'Foto-orientació', 'Photo orienteering'],
    descripcion: [
      'Cada pareja recibe fotos de detalles del centro o del parque (una barandilla, un grafiti, un árbol). Tienen que encontrar cada lugar y anotar el código que hay escondido allí.',
      'Cada parella rep fotos de detalls del centre o del parc (una barana, un grafit, un arbre). Han de trobar cada lloc i anotar el codi que hi ha amagat.',
      'Each pair gets photos of details around the school or park (a railing, some graffiti, a tree). They have to find each spot and write down the code hidden there.',
    ],
    organizacion: ['Por parejas. 20 minutos.', 'Per parelles. 20 minuts.', 'In pairs. 20 minutes.'],
    material: ['Fotos impresas o en una tableta, y códigos escondidos.', 'Fotos impreses o en una tauleta, i codis amagats.', 'Printed photos or a tablet, and hidden codes.'],
    variantes: [
      'Fotos más cerradas (más difíciles); ordenar las fotos por el recorrido más corto; que cada pareja haga fotos para otra.',
      'Fotos més tancades (més difícils); ordenar les fotos pel recorregut més curt; que cada parella faci fotos per a una altra.',
      'Closer-up photos (harder); order the photos by the shortest route; each pair takes photos for another pair.',
    ],
    inclusion: [
      'Los lugares están en zonas accesibles. Quien no puede correr decide el orden y la ruta, y el tiempo no puntúa.',
      'Els llocs són en zones accessibles. Qui no pot córrer decideix l\'ordre i la ruta, i el temps no puntua.',
      'The spots are in accessible areas. A student who cannot run decides the order and the route, and time does not score.',
    ],
  },
  /* ── Modalidades que faltaban (decisión del dueño, 6-10-2026) ── */
  {
    id: 'banco-sumo-equilibrio', tipo: 'juego', modalidad: 'lucha',
    titulo: ['Lucha de equilibrio por parejas', 'Lluita d\'equilibri per parelles', 'Pair balance wrestling'],
    descripcion: [
      'Por parejas, dentro de un círculo marcado y sobre colchonetas, se empujan solo palma contra palma para hacer que el otro pise fuera o levante un pie. Antes se practican las caídas seguras. Gana el punto quien mantiene el equilibrio; a la señal, todo el mundo para.',
      'Per parelles, dins d\'un cercle marcat i sobre matalassos, s\'empenyen només palmell contra palmell per fer que l\'altre trepitgi fora o aixequi un peu. Abans es practiquen les caigudes segures. Guanya el punt qui manté l\'equilibri; al senyal, tothom s\'atura.',
      'In pairs, inside a marked circle and on mats, students push palm against palm only, trying to make the other step out or lift a foot. Safe falls are practised first. The point goes to whoever keeps their balance; at the signal, everyone stops.',
    ],
    organizacion: ['Parejas de peso parecido, rotando cada minuto. 10 minutos.', 'Parelles de pes semblant, rotant cada minut. 10 minuts.', 'Pairs of similar weight, rotating every minute. 10 minutes.'],
    material: ['Colchonetas y cinta o aros para marcar los círculos.', 'Matalassos i cinta o cèrcols per marcar els cercles.', 'Mats and tape or hoops to mark the circles.'],
    variantes: [
      'Sentados con las piernas cruzadas; a la pata coja; tirando de una cuerda corta en lugar de empujar.',
      'Asseguts amb les cames creuades; a peu coix; estirant una corda curta en lloc d\'empènyer.',
      'Seated cross-legged; on one leg; pulling a short rope instead of pushing.',
    ],
    inclusion: [
      'Quien no puede apoyar una pierna o no debe recibir impactos juega la versión sentada, con la misma puntuación, o hace de árbitro y da la señal.',
      'Qui no pot recolzar una cama o no ha de rebre impactes juga la versió asseguda, amb la mateixa puntuació, o fa d\'àrbitre i dona el senyal.',
      'A student who cannot put weight on one leg or must avoid impacts plays the seated version with the same scoring, or referees and gives the signal.',
    ],
  },
  {
    id: 'banco-caidas-tortuga', tipo: 'juego', modalidad: 'lucha',
    titulo: ['Caídas y la tortuga', 'Caigudes i la tortuga', 'Falls and the turtle'],
    descripcion: [
      'Primero, caídas seguras: rodar de lado, caer hacia atrás amortiguando con los brazos y voltear por encima del hombro. Después, por parejas, uno se pone a cuatro patas como una tortuga y el otro intenta darle la vuelta en 20 segundos, sin agarrar del cuello ni de la ropa.',
      'Primer, caigudes segures: rodolar de costat, caure enrere esmorteint amb els braços i voltejar per damunt de l\'espatlla. Després, per parelles, un es posa a quatre grapes com una tortuga i l\'altre intenta donar-li la volta en 20 segons, sense agafar del coll ni de la roba.',
      'First, safe falls: rolling sideways, falling backwards and cushioning with the arms, and rolling over the shoulder. Then, in pairs, one gets on all fours like a turtle and the other tries to turn them over within 20 seconds, without grabbing the neck or clothes.',
    ],
    organizacion: ['Por parejas, sobre colchonetas. 12 minutos.', 'Per parelles, sobre matalassos. 12 minuts.', 'In pairs, on mats. 12 minutes.'],
    material: ['Colchonetas.', 'Matalassos.', 'Mats.'],
    variantes: [
      'La tortuga puede moverse; dar la vuelta a la tortuga entre dos; inmovilizar tres segundos al acabar.',
      'La tortuga es pot moure; donar la volta a la tortuga entre dos; immobilitzar tres segons en acabar.',
      'The turtle may move; two students try to turn one turtle; hold for three seconds at the end.',
    ],
    inclusion: [
      'Quien no puede hacer esfuerzos intensos o tiene un brazo lesionado cuenta el tiempo y vigila las normas, o hace de tortuga en una versión sin fuerza (resistir solo con el equilibrio).',
      'Qui no pot fer esforços intensos o té un braç lesionat compta el temps i vigila les normes, o fa de tortuga en una versió sense força (resistir només amb l\'equilibri).',
      'A student who must avoid intense effort or has an injured arm keeps time and watches the rules, or plays the turtle in a strength-free version (resisting with balance only).',
    ],
  },
  {
    id: 'banco-diana-saquitos', tipo: 'juego', modalidad: 'blanco-diana',
    titulo: ['Diana de aros', 'Diana de cèrcols', 'Hoop target'],
    descripcion: [
      'Tres aros concéntricos en el suelo forman una diana: el centro vale 3 puntos, el segundo 2 y el de fuera 1. Por equipos, cada jugador lanza tres saquitos desde una línea. Se suma la puntuación del equipo y, en cada ronda, la línea se aleja.',
      'Tres cèrcols concèntrics a terra formen una diana: el centre val 3 punts, el segon 2 i el de fora 1. Per equips, cada jugador llança tres saquets des d\'una línia. Se suma la puntuació de l\'equip i, a cada ronda, la línia s\'allunya.',
      'Three concentric hoops on the floor form a target: the centre is worth 3 points, the second 2 and the outer one 1. In teams, each player throws three beanbags from a line. Team scores are added up and the line moves back each round.',
    ],
    organizacion: ['Equipos de 4 o 5, una diana por equipo. 12 minutos.', 'Equips de 4 o 5, una diana per equip. 12 minuts.', 'Teams of 4 or 5, one target per team. 12 minutes.'],
    material: ['Aros de tres tamaños y saquitos.', 'Cèrcols de tres mides i saquets.', 'Hoops in three sizes and beanbags.'],
    variantes: [
      'Lanzar con la mano no dominante, de espaldas o rodando; dianas a distintas alturas; puntos solo si se dice antes dónde caerá.',
      'Llançar amb la mà no dominant, d\'esquena o rodolant; dianes a diferents altures; punts només si es diu abans on caurà.',
      'Throw with the non-dominant hand, backwards or rolling; targets at different heights; points only if the landing spot is called beforehand.',
    ],
    inclusion: [
      'Se lanza sentado o de pie; quien tiene una limitación lanza desde una línea más cercana o con saquitos más grandes, con la misma puntuación.',
      'Es llança assegut o dempeus; qui té una limitació llança des d\'una línia més propera o amb saquets més grans, amb la mateixa puntuació.',
      'Players throw seated or standing; a student with a limitation throws from a closer line or with bigger beanbags, with the same scoring.',
    ],
  },
  {
    id: 'banco-acrosport', tipo: 'deporte', modalidad: 'cooperacion',
    titulo: ['Acrosport por tríos', 'Acrosport per trios', 'Acrosport in threes'],
    descripcion: [
      'Por tríos, con tarjetas de figuras, se montan figuras de equilibrio con tres papeles: base, ágil y ayudante. Normas: apoyos solo en cadera y hombros, nunca en la columna; se sube y se baja despacio y en orden inverso; la figura se mantiene tres segundos.',
      'Per trios, amb targetes de figures, es munten figures d\'equilibri amb tres papers: base, àgil i ajudant. Normes: suports només a maluc i espatlles, mai a la columna; es puja i es baixa a poc a poc i en ordre invers; la figura es manté tres segons.',
      'In threes, using figure cards, students build balance figures with three roles: base, flyer and spotter. Rules: support only on hips and shoulders, never on the spine; climb up and down slowly and in reverse order; hold the figure for three seconds.',
    ],
    organizacion: ['Tríos sobre colchonetas, cambiando de papel. 20 minutos.', 'Trios sobre matalassos, canviant de paper. 20 minuts.', 'Groups of three on mats, swapping roles. 20 minutes.'],
    material: ['Colchonetas y tarjetas de figuras.', 'Matalassos i targetes de figures.', 'Mats and figure cards.'],
    variantes: [
      'Enlazar tres figuras con transiciones; montar una coreografía corta con música; inventar una figura y dibujar su tarjeta.',
      'Enllaçar tres figures amb transicions; muntar una coreografia curta amb música; inventar una figura i dibuixar-ne la targeta.',
      'Link three figures with transitions; build a short routine to music; invent a figure and draw its card.',
    ],
    inclusion: [
      'Quien no puede cargar peso hace de ayudante o de coordinador de la figura, o forma parte de figuras sin carga (apoyos en el suelo); también puede ser base sentado.',
      'Qui no pot carregar pes fa d\'ajudant o de coordinador de la figura, o forma part de figures sense càrrega (suports a terra); també pot ser base assegut.',
      'A student who cannot bear weight acts as spotter or figure coordinator, or joins weight-free figures (floor supports); they can also be a seated base.',
    ],
  },
  {
    id: 'banco-comba', tipo: 'juego', modalidad: 'tradicionales',
    titulo: ['La comba con canciones', 'La corda amb cançons', 'Skipping rhymes'],
    descripcion: [
      'Dos personas dan a una comba larga mientras el grupo canta una canción de comba tradicional. Por turnos, se entra, se salta al ritmo de la canción y se sale sin tocar la cuerda. Antes, cada uno pregunta en casa qué canciones de comba se cantaban.',
      'Dues persones donen corda a una corda llarga mentre el grup canta una cançó tradicional de saltar a corda. Per torns, s\'entra, se salta al ritme de la cançó i se surt sense tocar la corda. Abans, cadascú pregunta a casa quines cançons de corda es cantaven.',
      'Two people turn a long rope while the group sings a traditional skipping rhyme. In turns, students jump in, skip to the rhythm of the song and jump out without touching the rope. Beforehand, everyone asks at home which skipping rhymes were sung.',
    ],
    organizacion: ['Grupos de 6 a 8, una comba por grupo. 12 minutos.', 'Grups de 6 a 8, una corda per grup. 12 minuts.', 'Groups of 6 to 8, one rope per group. 12 minutes.'],
    material: ['Combas largas.', 'Cordes llargues.', 'Long skipping ropes.'],
    variantes: [
      'Entrar por parejas; hacer gestos que dice la canción; la «culebrilla», con la cuerda ondulando en el suelo.',
      'Entrar per parelles; fer els gestos que diu la cançó; la «serp», amb la corda fent ones a terra.',
      'Jump in pairs; do the actions in the rhyme; the "snake", with the rope wriggling along the floor.',
    ],
    inclusion: [
      'Quien no puede saltar da a la comba, marca el ritmo o canta y dirige; con la «culebrilla» se puede pasar caminando.',
      'Qui no pot saltar dona corda, marca el ritme o canta i dirigeix; amb la «serp» es pot passar caminant.',
      'A student who cannot jump turns the rope, keeps the rhythm or leads the singing; with the "snake" they can walk across.',
    ],
  },
  {
    id: 'banco-ruta-urbana', tipo: 'natural', modalidad: 'natural-urbano',
    titulo: ['Ruta urbana con plano', 'Ruta urbana amb plànol', 'Town trail with a map'],
    descripcion: [
      'Con un plano del barrio, los grupos siguen una ruta a pie con puntos de control en lugares conocidos (una plaza, una fuente, un parque). En cada punto responden una pregunta sobre el lugar. Antes se repasan las normas de seguridad vial; cada grupo va con una persona adulta.',
      'Amb un plànol del barri, els grups segueixen una ruta a peu amb punts de control en llocs coneguts (una plaça, una font, un parc). A cada punt responen una pregunta sobre el lloc. Abans es repassen les normes de seguretat viària; cada grup va amb una persona adulta.',
      'With a map of the neighbourhood, groups follow a walking route with checkpoints at known places (a square, a fountain, a park). At each point they answer a question about the place. Road safety rules are reviewed first; each group goes with an adult.',
    ],
    organizacion: ['Grupos de 5 o 6 con una persona adulta. Una sesión doble.', 'Grups de 5 o 6 amb una persona adulta. Una sessió doble.', 'Groups of 5 or 6 with an adult. One double session.'],
    material: ['Planos del barrio, tarjetas de preguntas y petos.', 'Plànols del barri, targetes de preguntes i pitets.', 'Neighbourhood maps, question cards and bibs.'],
    variantes: [
      'Ruta en estrella desde la plaza del centro; cada grupo diseña una ruta para otro; medir la distancia con una aplicación y compararla con la del plano.',
      'Ruta en estrella des de la plaça del centre; cada grup dissenya una ruta per a un altre; mesurar la distància amb una aplicació i comparar-la amb la del plànol.',
      'A star route from the central square; each group designs a route for another; measure the distance with an app and compare it with the map.',
    ],
    inclusion: [
      'Ruta sin escaleras y con descansos. Quien no puede caminar mucho hace de orientador con el plano o de fotógrafo del grupo, desde los puntos más cercanos.',
      'Ruta sense escales i amb descansos. Qui no pot caminar gaire fa d\'orientador amb el plànol o de fotògraf del grup, des dels punts més propers.',
      'A route without stairs and with rests. A student who cannot walk far navigates with the map or is the group photographer, from the nearest checkpoints.',
    ],
  },
  /* ── Calentamiento ── */
  {
    id: 'banco-pilla-movilidad', tipo: 'calentamiento',
    titulo: ['Pilla-pilla de movilidad', 'Pilla-pilla de mobilitat', 'Mobility tag'],
    descripcion: [
      'Dos o tres jugadores la paran. Quien es tocado hace en el sitio un ejercicio de movilidad (círculos de brazos, de cadera, de tobillos) contando hasta cinco y vuelve al juego. Cada dos minutos cambian quienes la paran y el ejercicio.',
      'Dos o tres jugadors paren. Qui és tocat fa al lloc un exercici de mobilitat (cercles de braços, de maluc, de turmells) comptant fins a cinc i torna al joc. Cada dos minuts canvien els qui paren i l\'exercici.',
      'Two or three players are "it". Anyone tagged does a mobility exercise on the spot (arm, hip or ankle circles), counts to five and rejoins. Every two minutes the taggers and the exercise change.',
    ],
    organizacion: ['Todo el grupo en media pista. 8 minutos.', 'Tot el grup en mitja pista. 8 minuts.', 'The whole group on half a court. 8 minutes.'],
    material: ['Petos para quienes la paran.', 'Pitets per als qui paren.', 'Bibs for the taggers.'],
    variantes: [
      'Desplazamientos variados (lateral, de espaldas, con skipping); salvarse dándose la mano con otro; ejercicio elegido por quien toca.',
      'Desplaçaments variats (lateral, d\'esquena, amb skipping); salvar-se donant-se la mà amb un altre; exercici triat per qui toca.',
      'Varied movements (sideways, backwards, high knees); safe when holding hands with someone; the tagger chooses the exercise.',
    ],
    inclusion: [
      'Quien no puede correr marca el ejercicio de movilidad desde el centro y lo hace con los demás, a su ritmo.',
      'Qui no pot córrer marca l\'exercici de mobilitat des del centre i el fa amb els altres, al seu ritme.',
      'A student who cannot run calls the mobility exercise from the centre and does it with the others at their own pace.',
    ],
  },
  {
    id: 'banco-espejo', tipo: 'calentamiento',
    titulo: ['El espejo en movimiento', 'El mirall en moviment', 'The moving mirror'],
    descripcion: [
      'Por parejas, uno guía y el otro es su espejo. El guía hace movimientos de todas las articulaciones, de arriba abajo, primero en el sitio y luego desplazándose suave. Cada minuto se cambia el papel.',
      'Per parelles, un guia i l\'altre és el seu mirall. El guia fa moviments de totes les articulacions, de dalt a baix, primer al lloc i després desplaçant-se suaument. Cada minut es canvia el paper.',
      'In pairs, one leads and the other is their mirror. The leader moves every joint from head to toe, first on the spot and then travelling gently. Swap roles every minute.',
    ],
    organizacion: ['Por parejas, en todo el espacio. 6 minutos.', 'Per parelles, en tot l\'espai. 6 minuts.', 'In pairs, around the space. 6 minutes.'],
    material: ['Ninguno; música opcional.', 'Cap; música opcional.', 'None; music optional.'],
    variantes: [
      'Espejo en grupos de cuatro; aumentar poco a poco la intensidad; el espejo va con retraso de un movimiento.',
      'Mirall en grups de quatre; augmentar a poc a poc la intensitat; el mirall va amb un moviment de retard.',
      'Mirror in groups of four; gradually raise the intensity; the mirror lags one movement behind.',
    ],
    inclusion: [
      'Se puede hacer sentado; la pareja adapta los movimientos a lo que el otro puede hacer.',
      'Es pot fer assegut; la parella adapta els moviments al que l\'altre pot fer.',
      'It can be done seated; the partner adapts the movements to what the other can do.',
    ],
  },
  {
    id: 'banco-calentamiento-guiado', tipo: 'calentamiento',
    titulo: ['Calentamiento dirigido por el alumnado', 'Escalfament dirigit per l\'alumnat', 'Student-led warm-up'],
    descripcion: [
      'Cada grupo pequeño prepara y dirige una parte del calentamiento (desplazamientos, movilidad, activación específica del deporte del día) con una ficha de pautas. El docente da retroalimentación al final.',
      'Cada grup petit prepara i dirigeix una part de l\'escalfament (desplaçaments, mobilitat, activació específica de l\'esport del dia) amb una fitxa de pautes. El docent dona retroacció al final.',
      'Each small group plans and leads part of the warm-up (moving around, mobility, sport-specific activation) using a guideline card. The teacher gives feedback at the end.',
    ],
    organizacion: ['Grupos de 4, por turnos. 12 minutos.', 'Grups de 4, per torns. 12 minuts.', 'Groups of 4, taking turns. 12 minutes.'],
    material: ['Fichas de pautas de calentamiento.', 'Fitxes de pautes d\'escalfament.', 'Warm-up guideline cards.'],
    variantes: [
      'Calentamiento con balón; cada grupo inventa un juego de calentamiento; coevaluación con una lista de control.',
      'Escalfament amb pilota; cada grup inventa un joc d\'escalfament; coavaluació amb una llista de control.',
      'Warm-up with a ball; each group invents a warm-up game; peer assessment with a checklist.',
    ],
    inclusion: [
      'Quien tiene una limitación puede dirigir su parte desde el centro y proponer alternativas para quien no puede hacer un ejercicio.',
      'Qui té una limitació pot dirigir la seva part des del centre i proposar alternatives per a qui no pot fer un exercici.',
      'A student with a limitation can lead their part from the centre and suggest alternatives for anyone who cannot do an exercise.',
    ],
  },
  /* ── Vuelta a la calma ── */
  {
    id: 'banco-estiramientos-tarjetas', tipo: 'calma',
    titulo: ['Estiramientos con tarjetas', 'Estiraments amb targetes', 'Stretching cards'],
    descripcion: [
      'Por parejas, se reparten tarjetas con dibujos de estiramientos. Uno lee la tarjeta y comprueba la postura del otro; cada estiramiento se mantiene 20 segundos sin rebotes, respirando despacio.',
      'Per parelles, es reparteixen targetes amb dibuixos d\'estiraments. Un llegeix la targeta i comprova la postura de l\'altre; cada estirament es manté 20 segons sense rebots, respirant a poc a poc.',
      'In pairs, students get cards with stretch drawings. One reads the card and checks the other\'s posture; each stretch is held for 20 seconds without bouncing, breathing slowly.',
    ],
    organizacion: ['Por parejas. 8 minutos.', 'Per parelles. 8 minuts.', 'In pairs. 8 minutes.'],
    material: ['Tarjetas de estiramientos; esterillas si hay.', 'Targetes d\'estiraments; estoretes si n\'hi ha.', 'Stretching cards; mats if available.'],
    variantes: [
      'Elegir los estiramientos de los músculos trabajados en la sesión; inventar una tarjeta nueva; hacerlo en silencio con música.',
      'Triar els estiraments dels músculs treballats a la sessió; inventar una targeta nova; fer-ho en silenci amb música.',
      'Choose stretches for the muscles worked in the session; design a new card; do it in silence with music.',
    ],
    inclusion: [
      'Cada tarjeta tiene una versión sentada o en silla. Quien tiene una lesión evita la zona afectada y hace de guía.',
      'Cada targeta té una versió asseguda o en cadira. Qui té una lesió evita la zona afectada i fa de guia.',
      'Each card has a seated or chair version. A student with an injury avoids the affected area and acts as the guide.',
    ],
  },
  {
    id: 'banco-escaner', tipo: 'calma',
    titulo: ['El escáner del cuerpo', 'L\'escàner del cos', 'Body scan'],
    descripcion: [
      'Tumbados o sentados, con los ojos cerrados, el docente guía la atención por el cuerpo, de los pies a la cabeza, notando cada parte y soltando la tensión. Termina con tres respiraciones lentas.',
      'Estirats o asseguts, amb els ulls tancats, el docent guia l\'atenció pel cos, dels peus al cap, notant cada part i deixant anar la tensió. Acaba amb tres respiracions lentes.',
      'Lying down or seated, eyes closed, the teacher guides attention through the body from feet to head, noticing each part and releasing tension. It ends with three slow breaths.',
    ],
    organizacion: ['Todo el grupo. 5 minutos.', 'Tot el grup. 5 minuts.', 'The whole group. 5 minutes.'],
    material: ['Esterillas si hay; música suave opcional.', 'Estoretes si n\'hi ha; música suau opcional.', 'Mats if available; soft music optional.'],
    variantes: [
      'Que lo guíe un alumno o una alumna; respiración contando hasta cuatro; terminar diciendo una palabra sobre cómo se sienten.',
      'Que el guiï un alumne o una alumna; respiració comptant fins a quatre; acabar dient una paraula sobre com se senten.',
      'A student leads it; breathing counting to four; finish by saying one word about how they feel.',
    ],
    inclusion: [
      'Sirve para todo el grupo tal cual, en la postura que a cada uno le resulte cómoda.',
      'Serveix per a tot el grup tal com és, en la postura que a cadascú li resulti còmoda.',
      'It works for the whole group as it is, in whatever position is comfortable.',
    ],
  },
  {
    id: 'banco-masaje-pelota', tipo: 'calma',
    titulo: ['Masaje con pelota', 'Massatge amb pilota', 'Ball massage'],
    descripcion: [
      'Por parejas, uno tumbado boca abajo o sentado y el otro le pasa una pelota de tenis por la espalda con movimientos lentos y circulares, preguntando si la presión le va bien. A los dos minutos se cambian.',
      'Per parelles, un estirat de bocaterrosa o assegut i l\'altre li passa una pilota de tennis per l\'esquena amb moviments lents i circulars, preguntant si la pressió li va bé. Als dos minuts es canvien.',
      'In pairs, one lies face down or sits while the other rolls a tennis ball slowly in circles over their back, asking whether the pressure is all right. Swap after two minutes.',
    ],
    organizacion: ['Por parejas. 5 minutos.', 'Per parelles. 5 minuts.', 'In pairs. 5 minutes.'],
    material: ['Una pelota de tenis por pareja.', 'Una pilota de tennis per parella.', 'One tennis ball per pair.'],
    variantes: [
      'Contar una historia con la pelota («llueve, pasa un camión»); masaje en los pies sentados; en corro, cada uno al de delante.',
      'Explicar una història amb la pilota («plou, passa un camió»); massatge als peus asseguts; en rotllana, cadascú al de davant.',
      'Tell a story with the ball ("it\'s raining, a lorry goes by"); seated foot massage; in a circle, each person massages the one in front.',
    ],
    inclusion: [
      'Se hace sentado si alguien no puede tumbarse. Siempre se pregunta antes y se respeta a quien prefiera no recibir masaje: puede darlo o guiar la historia.',
      'Es fa assegut si algú no es pot estirar. Sempre es pregunta abans i es respecta qui prefereixi no rebre massatge: el pot fer o guiar la història.',
      'Done seated if someone cannot lie down. Always ask first and respect anyone who prefers not to be massaged: they can give it or lead the story.',
    ],
  },
  {
    id: 'banco-semaforo', tipo: 'calma',
    titulo: ['El semáforo de la sesión', 'El semàfor de la sessió', 'Session traffic light'],
    descripcion: [
      'Al acabar, cada alumno o alumna se coloca en una de tres zonas (verde, ámbar, roja) según cómo ha ido el objetivo de la sesión, y una persona de cada zona explica por qué. Sirve de autoevaluación y orienta la sesión siguiente.',
      'En acabar, cada alumne o alumna es col·loca en una de tres zones (verda, ambre, vermella) segons com ha anat l\'objectiu de la sessió, i una persona de cada zona explica per què. Serveix d\'autoavaluació i orienta la sessió següent.',
      'At the end, each student stands in one of three zones (green, amber, red) depending on how they did with the session goal, and one person from each zone explains why. It works as self-assessment and guides the next session.',
    ],
    organizacion: ['Todo el grupo, en tres zonas marcadas. 4 minutos.', 'Tot el grup, en tres zones marcades. 4 minuts.', 'The whole group, in three marked zones. 4 minutes.'],
    material: ['Tres conos o aros de colores.', 'Tres cons o cèrcols de colors.', 'Three coloured cones or hoops.'],
    variantes: [
      'Con tarjetas en lugar de zonas; preguntar por el trabajo en equipo; anotar en el cuaderno de clase lo que dice cada zona.',
      'Amb targetes en lloc de zones; preguntar pel treball en equip; anotar al quadern de classe el que diu cada zona.',
      'Use cards instead of zones; ask about teamwork; note what each zone says in the class notebook.',
    ],
    inclusion: [
      'Quien no puede desplazarse levanta una tarjeta del color. Las zonas llevan también un rótulo, no solo el color.',
      'Qui no es pot desplaçar aixeca una targeta del color. Les zones porten també un rètol, no només el color.',
      'A student who cannot move holds up a coloured card. The zones also have a written label, not just a colour.',
    ],
  },
];

const IDX: Record<Lang, 0 | 1 | 2> = { es: 0, ca: 1, en: 2 };

/** El banco de partida en el idioma de la app. */
export function bancoEF(lang: Lang): ActividadEF[] {
  const i = IDX[lang];
  return BANCO.map(b => ({
    id: b.id, tipo: b.tipo, origen: 'banco', ...(b.modalidad ? { modalidad: b.modalidad } : {}),
    titulo: b.titulo[i], descripcion: b.descripcion[i], organizacion: b.organizacion[i],
    material: b.material[i], variantes: b.variantes[i], inclusion: b.inclusion[i],
  }));
}

/** Cuántas hay de cada tipo, para las pruebas y la ayuda. */
export const TAMANO_BANCO = BANCO.length;
