# Design

## Context

Motivación y alcance: ver proposal.md. Comportamiento esperado: ver specs.

Estado actual que condiciona el diseño:

- `buildTree(connections, model, separator)` en `src/renderer/src/tree.ts` es
  una función pura que devuelve la jerarquía completa como `TreeItem`, ya con
  los ids abiertos en niveles. Cada ítem tiene una clave estable mientras su
  rama no cambie de forma. Las métricas propias de un nodo cuelgan de una fila
  "-" (`nodeLevel`), y un UDT es un ítem `template` con sus miembros como hijos.
- El store del renderer guarda los modelos en estructuras mutables y avisa con
  dos contadores: `structure` sube solo cuando cambia la forma del árbol;
  `version` sube con cada lote de eventos. `store.now` es el "ahora" común.
- Cada métrica guarda `updatedAt` y `updates`; el destello del árbol es
  `now - updatedAt < FLASH_MS && updates > 1`. `tree.ts` ya sabe calcular el
  momento de la última actualización de un UDT mirando sus miembros, pero esa
  función es interna.
- Cada nodo y device guarda `birthAt` y su `status`.
- Las tres vistas están siempre montadas; `App.tsx` les pasa `active` y cada
  una evita trabajar cuando no lo está.
- Los colores de cada nivel son variables CSS (`--kind-group`, `--kind-node`,
  `--kind-device`, `--kind-metric`, `--kind-template`).
- El proyecto no tiene librerías de visualización ni tests automatizados. El
  devcontainer no tiene GPU: lo que dependa de WebGL no se puede verificar ahí.

## Goals / Non-Goals

**Goals:**

- Que el costo de la vista dependa de la cantidad de elementos y no de la
  cantidad de métricas ni del tráfico.
- Que un DATA nunca mueva el grafo: solo los cambios de forma lo acomodan.
- Que la lógica que no se ve (armado del grafo, ubicación de los puntos,
  detección de pulsos, qué hay bajo el mouse) quede en funciones puras
  verificables fuera de la app.
- Reutilizar las reglas del árbol (separación, destello, estado) en vez de
  volver a escribirlas.

**Non-Goals:**

- Efectos de posprocesado (bloom real, desenfoque): se aproximan con dibujo 2D.
- Una disposición determinista o repetible entre sesiones.
- Accesibilidad por teclado del lienzo; la información sigue disponible en el
  árbol de datos.

## Decisions

### 1. `d3-force` para acomodar, canvas 2D propio para dibujar

`d3-force` aporta solo la simulación (enlaces, repulsión, colisión). El dibujo,
el zoom y la detección del mouse son código propio sobre un `<canvas>` 2D.

Alternativas descartadas:

- `force-graph`: trae zoom, arrastre y partículas hechos, pero trata cada cosa
  dibujable como un nodo de la simulación y arrastra más dependencias; acá los
  puntos no son nodos (decisión 3).
- sigma.js, PixiJS, cosmos: WebGL. Rinden más y permitirían brillo real, pero
  no se pueden verificar en el devcontainer y son mucha librería para una vista
  de solo mirar.
- Escribir la simulación a mano: son pocas líneas para un caso simple, pero la
  colisión entre elementos de radios muy distintos es justo lo difícil.

`d3-force` va en `devDependencies`, como React: el renderer se empaqueta con
Vite y no se resuelve en tiempo de ejecución.

### 2. El grafo sale del árbol

Un módulo nuevo `src/renderer/src/graph.ts`, puro, convierte los `TreeItem` de
`buildTree` en:

- **Elementos**: los ítems `connection`, `group`, `node` y `device`, salvo la
  fila "-". Cada uno guarda su clave, su padre y su `TreeItem`.
- **Puntos**: los hijos `metric` y `template` directos de cada elemento. Los de
  la fila "-" pasan a su nodo. Los hijos de un `template` no se recorren.

Así la separación en niveles, el orden y las claves llegan resueltos, y un
cambio en la regla del árbol alcanza a las dos vistas.

Alternativa descartada: armar el grafo directo desde `ConnectionModel`.
Duplicaría la regla de separación y el tratamiento de los UDT.

### 3. Los puntos no participan de la simulación

Solo los elementos son nodos de `d3-force`. Los puntos de un elemento se ubican
en una espiral de girasol alrededor de él: el punto `i` va a un radio
proporcional a `sqrt(i)` y un ángulo de `i` por el ángulo áureo. El radio que
ocupa el conjunto crece con `sqrt(n)` y es el radio de colisión del elemento,
así los vecinos se apartan solos.

Con esto la simulación tiene decenas o cientos de nodos aunque haya decenas de
miles de métricas, y no hace falta recortar puntos: una instalación grande da
un grafo grande que se recorre con zoom (supuesto de proposal.md). Cuando el
zoom deja los puntos por debajo de un tamaño de pantalla, cada elemento dibuja
un disco del radio que ocupan en vez de los puntos, y lo enciende con el
último DATA de su nodo o device.

El orden de los puntos es el de las métricas en el árbol, o sea el del BIRTH:
una métrica conserva su lugar mientras el BIRTH no cambie.

### 4. Posiciones que sobreviven a los cambios de forma

La vista guarda la posición de cada elemento en un mapa por clave, fuera de
React. Cuando `structure` o el separador cambian, rearma el grafo y:

- los elementos cuya clave ya existía conservan posición y velocidad;
- los nuevos nacen en el medio del hueco angular más grande que dejan, alrededor
  de su padre, los vecinos que ya tienen lugar (el abuelo y los hermanos), y por
  fuera de esos hermanos: nacer entre ellos los desacomoda;
- la simulación se recalienta con un `alpha` bajo, no desde 1, proporcional a la
  parte del grafo que cambió, y solo si apareció o desapareció un elemento o
  cambió lo que ocupa alguno: un cambio de estado también sube `structure`, pero
  no mueve nada.

El enlace de un elemento con su padre tira menos cuantos más hermanos tiene; con
una fuerza fija, cincuenta devices de un mismo nodo se amontonan sobre él y la
colisión no alcanza a separarlos.

El estado con el que se dibuja cada elemento se calcula al armar el grafo: el
del nodo o device, o, para un grupo o una rama intermedia, en línea si algo de
lo que cuelga lo está. Sirve porque todo cambio de estado sube `structure`.

Un cambio de separador cambia las claves de las ramas afectadas: esas se
acomodan como nuevas. Es aceptable y coincide con lo que hace el árbol.

Cada conexión es un grafo suelto; una fuerza débil hacia el centro evita que
se alejen entre sí sin límite.

### 5. Un bucle de dibujo que duerme

El lienzo se redibuja con `requestAnimationFrame`, sin pasar por React: la
vista se suscribe al store directamente y no usa `useStoreVersion`, para no
renderizar el componente con cada lote. El bucle corre solo si la vista está
activa y pasa alguna de estas cosas: la simulación no se enfrió, hay un brillo
o un pulso vivo, o el usuario está moviendo el lienzo. Si no, se detiene, y lo
despierta el próximo aviso del store, el arrastre o el zoom del lienzo, o un
cambio de tamaño. Mover el mouse sin arrastrar no redibuja: el tooltip es HTML.

El lienzo se dimensiona con `devicePixelRatio` y un `ResizeObserver`. Los
colores se leen una vez de las variables CSS.

### 6. Brillo y pulsos derivados del modelo

No hay canal nuevo de eventos; todo sale de lo que el modelo ya guarda.

- **Brillo de un punto**: la regla del árbol. Para un UDT, el momento de la
  última actualización entre sus miembros; `tree.ts` exporta la función que ya
  lo calcula. La intensidad decae de forma continua con `now - updatedAt`
  sobre `FLASH_MS`.
- **Pulso**: por cada nodo y device se sigue el `updatedAt` más reciente entre
  sus métricas con `updates > 1`. Cuando ese valor avanza, sale un pulso. Un
  BIRTH deja todas las métricas en su primer valor, así que no dispara; varios
  mensajes del mismo elemento en un mismo lote dan un solo pulso (supuesto de
  proposal.md).

Un pulso es un punto luminoso que recorre, a velocidad constante, la cadena de
elementos desde el que publicó hasta la conexión. Se limita a un pulso en
vuelo por tramo y por elemento de origen: con tráfico alto la rama queda
encendida en vez de llenarse de pulsos.

Limitación conocida: un DATA que solo trae métricas que el modelo no conocía
no genera pulso. Alternativa descartada: guardar en el modelo el momento del
último DATA de cada nodo y device; es exacto, pero toca el modelo compartido,
su serialización y el proceso principal por un caso marginal.

El "ahora" del brillo es `Date.now()` del renderer, igual que en el árbol.

### 7. Tooltip en HTML y detección bajo el mouse

El tooltip es un elemento HTML sobre el lienzo, no texto dibujado: reutiliza
`formatValue`, `engUnit` y `formatTimestamp` y los estilos de la app. Es el
único estado de React de la vista (qué hay bajo el mouse); mientras está
visible se refresca con los avisos del store.

Para saber qué hay bajo el mouse se convierte su posición a coordenadas del
grafo y se busca primero el elemento cuyo radio la contiene y después, entre
sus puntos, el más cercano dentro de un margen. Con cientos de elementos un
recorrido lineal alcanza; no se agrega un índice espacial.

### 8. Zoom, arrastre y nombres

La transformación (desplazamiento y escala) vive en una referencia fuera de
React y persiste mientras la vista esté montada, que es toda la sesión. La
rueda escala alrededor del puntero; arrastrar desplaza. "Encuadrar" calcula el
rectángulo que contiene todos los elementos con sus puntos. El encuadre sigue
al grafo, con un movimiento suave, hasta que el usuario mueve o acerca el
lienzo, y vuelve a seguirlo después de "Encuadrar": sin eso, lo que nace con la
vista recién abierta queda fuera de pantalla.

Los nombres se dibujan en tamaño de pantalla constante, debajo de todo lo que
ocupa el elemento con sus puntos: más cerca del disco tapaban puntos, y dejarles
un hueco en la espiral se veía como una franja vacía al acercar. Se ocultan por nivel
cuando la escala baja de un umbral: primero devices y ramas de device, después
nodos y grupos; el de la conexión siempre se dibuja.

### 9. Arrastre, inercia de los puntos y halos

- **Arrastre**: al apretar sobre un elemento o sobre uno de sus puntos se lo
  fija al puntero con `fx`/`fy` de `d3-force` y se sube el `alphaTarget` de la
  simulación, así el resto responde mientras dura. Al soltar se quitan `fx`/`fy`
  y el `alphaTarget` vuelve a 0: la simulación se enfría sola y el bucle se
  duerme. Apretar sobre el fondo sigue moviendo el lienzo. No se deja nada
  fijado: lo que se suelta queda donde lo lleven las fuerzas.
- **Inercia de los puntos**: cada punto guarda posición y velocidad propias y
  persigue su lugar en la espiral con un resorte amortiguado, más blando cuanto
  más afuera está. Es una cuenta por punto y por cuadro, sin choques entre
  puntos; los de un elemento quieto y ya en su lugar se saltean. Los puntos
  nuevos nacen en el centro de su elemento y se abren. Alternativa descartada:
  que cada punto sea un cuerpo de la simulación, que con decenas de miles no es
  fluido.
- **Halos**: una imagen de degradado radial por color, preparada una vez, se
  dibuja con mezcla aditiva (`lighter`) bajo cada punto y cada elemento. El
  halo de reposo es apenas más ancho que la separación entre puntos para que un
  grupo denso no se queme a blanco. Por debajo de cierto tamaño de pantalla los
  halos de reposo no se dibujan. Los círculos de los elementos se dibujan al
  final y opacos. Alternativa descartada por ahora: WebGL con bloom real; no se
  puede verificar en el devcontainer y obliga a reescribir el dibujo.

### 10. Archivos

- `src/renderer/src/graph.ts`: lógica pura (armado, espiral, radios, pulsos,
  detección bajo el mouse, encuadre).
- `src/renderer/src/views/GraphView.tsx`: lienzo, simulación, bucle, entrada y
  tooltip.
- `App.tsx`: cuarto ítem en `VIEWS` y la vista montada con `active`.

## Risks / Trade-offs

- [El aspecto "tipo Gource" es subjetivo y no se puede especificar] → Primera
  versión sobria; brillo, velocidad de los pulsos y fuerzas quedan como
  constantes juntas al comienzo del módulo para ajustarlas mirando tráfico
  real.
- [Con decenas de miles de puntos, dibujarlos todos en cada cuadro puede no
  llegar a 60 cuadros por segundo en canvas 2D] → Se dibujan solo los puntos
  de los elementos que caen dentro de la vista, y por debajo de cierta escala
  los puntos de un elemento se dibujan como un disco. Se mide en la tarea de
  verificación de conjunto.
- [Un BIRTH con muchas más métricas agranda el radio de un elemento y empuja a
  los vecinos] → Es el desplazamiento necesario que admite el spec; el `alpha`
  bajo lo hace gradual.
- [Dos grafos de conexiones distintas pueden superponerse al nacer] → La
  colisión entre elementos los separa; las conexiones nacen repartidas en
  círculo.
- [El reloj del devcontainer salta respecto del monotónico y puede saltear un
  brillo aislado] → Es del entorno, ya conocido en el árbol; las verificaciones
  usan actividad sostenida.
- [Una dependencia nueva] → `d3-force` es chica, sin DOM y estable; sus
  dependencias son otros tres módulos de d3 igual de chicos.

- [Si la simulación se enfría antes de llegar al equilibrio, cada cambio
  posterior sigue acomodando todo el grafo: con el enfriado habitual de
  `d3-force`, un device nuevo en un nodo con 40 devices de 200 métricas corría a
  los vecinos más de 60 unidades] → Se enfría más lento (`COOLING`). Medido en
  ese mismo caso: 2 unidades. El costo es que el grafo tarda más en aquietarse
  (unos 6 s tras un BIRTH grande en vez de 3,5 s).
- [Con miles de puntos a la vista, un halo por punto baja los cuadros por
  segundo sin GPU] → Por encima de `HALO_BUDGET` puntos visibles cada elemento
  dibuja un solo halo para todos los suyos. El dibujo va por pasadas (primero
  toda la luz, después lo opaco) para no cambiar de modo de mezcla a cada rato.

## Open Questions

- Los valores finos de aspecto (tamaños, intensidad del brillo, velocidad del
  pulso, umbrales de zoom para los nombres) se ajustan al verlo en marcha; no
  cambian los specs ni las tareas.
