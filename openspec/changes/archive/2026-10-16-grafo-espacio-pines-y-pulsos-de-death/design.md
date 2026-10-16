# Design

## Context

Motivación y alcance: ver proposal.md. Comportamiento esperado: ver specs.

La vista acomoda los elementos con una simulación de `d3-force`: un resorte de
cada elemento a su padre con un largo de reposo, repulsión entre todos, una
colisión por el disco que ocupa cada elemento con sus puntos, y un centrado
suave. El largo de reposo de un enlace es hoy `radio(hijo) + radio(padre) +
holgura`, donde el radio es el del disco de los puntos propios, que calcula
`occupiedRadius` en `graph.ts`. `d3-force` reparte cada enlace según el grado de
sus extremos: el que tiene más enlaces se mueve menos, así que un nodo con
treinta devices ya es un ancla y es su rama la que va a los tirones.

El arrastre fija el elemento al puntero con `fx`/`fy` y lo suelta al levantar el
botón; `rebuild` copia `fx`/`fy` de un grafo al siguiente. Los pulsos se
detectan en `detectPulses` comparando, por elemento, el momento del último DATA
con el de la pasada anterior: el renderer no recibe eventos, solo el estado.
Un DEATH llega como `status: 'offline'` con un `statusAt` nuevo; una caída del
enlace con el broker deja los elementos en `stale`, no en `offline`.

## Goals / Non-Goals

**Goals:**

- Que el lugar que pide un elemento salga de la geometría del árbol, sin
  depender de que la repulsión le gane al resorte.
- Que fijar, mover y soltar salgan del mismo gesto de arrastre que ya existe.
- Que el pulso de DEATH reutilice el recorrido, el ritmo y el dibujo del pulso
  de datos.

**Non-Goals:**

- Una fuerza de colisión entre subárboles enteros.
- Cambios en el modelo compartido o en el proceso principal para avisar un
  DEATH: el estado alcanza.

## Decisions

### 1. La huella se calcula en el grafo, de abajo hacia arriba

Cada elemento gana una **huella**: el radio de lo que ocupa con todo lo que
cuelga de él. Se calcula en `buildGraph`, que ya recorre el árbol con los hijos
listos antes que el padre, con la misma ley de raíz de la suma que
`occupiedRadius` usa para los puntos:

- Sin hijos, la huella es el radio propio.
- Con hijos, es lo mayor entre el radio propio, el disco en que se empaquetan
  los hijos (`empaque * sqrt(suma (huella(hijo) + separacion)^2)`, que es como
  la colisión los acomoda de verdad) y lo más lejos que llega un hijo con lo
  suyo (`largo(hijo) + huella(hijo)`).

El largo de reposo de cada enlace también se decide ahí y queda guardado en el
elemento; el accessor de `forceLink` solo lo lee. Para eso las constantes de
holgura del enlace y de la colisión pasan de `GraphView.tsx` a `graph.ts`, junto
a los radios. Así la geometría queda en un solo lugar y la vista no repite el
recorrido del árbol.

Alternativa descartada: calcular la huella en el accessor de `distance`. Se
evalúa por enlace en cada inicialización y recorre el subárbol cada vez.

### 2. El largo de reposo crece solo entre hermanos

El largo base sigue siendo `radio(hijo) + radio(padre) + holgura`. Cuando un
padre tiene `k >= 2` hijos, el hijo `e` necesita que la cuerda hasta su vecino
en el anillo alrededor del padre alcance para las dos huellas:

```
largo(padre -> e) = max( base, (huella(e) + huella(hermano mayor)) / (2 * sin(pi / k)) )
```

- Con `k = 1` no hay vecino y queda el largo base: las cadenas de hijo único
  no se estiran aunque al final haya un nodo cargado; el padre queda en el borde
  del bollo, como hoy, y el bollo entero sigue a la rama.
- La regla se aplica solo a hijos que tienen hijos. Las hojas (devices y nodos
  sin devices) conservan el largo base y se empaquetan por la colisión como
  hasta ahora: con treinta devices la cuerda daría un anillo de un solo giro,
  que con cien devices sería enorme y vacío en el centro.
- Con huellas chicas la cuerda queda por debajo del largo base y `max` la deja
  en el base: un nodo con dos devices descansa donde descansaba. La constante
  de empaque y la separación se calibran contra el escenario "Pocos hijos".

Alternativa descartada: aflojar la fuerza del enlace en proporción a los hijos,
como única perilla. La fuerza no cambia el largo que el resorte quiere, solo
cuánto tarda en volver; haría falta aflojar tanto que el grafo quedaría flojo y
congelado donde cae, y por el reparto por grado el nodo cargado casi no se
mueve por ese enlace de todos modos.

### 3. La fuerza afloja un poco con los hijos propios

La fuerza del enlace sigue dividida por la raíz de la cantidad de hermanos y se
divide además por una potencia baja de la cantidad de hijos del elemento
(exponente del orden de 0,25). Con tres o más hermanos cargados la separación
es angular y la cuerda del punto 2 es una estimación; un resorte apenas más
flojo deja que la colisión los termine de repartir. Más que eso suma flojedad
sin ganancia, por el reparto por grado.

### 4. Un cambio de huella reacomoda como un cambio de radio

`rebuild` cuenta hoy como "movido" al elemento cuyo radio cambió, para calentar
la simulación en proporción. El largo de reposo pasa a contar igual: cuando a un
nodo le nace el hermano cargado que lo obliga a abrirse, el grafo se calienta lo
justo para que se acomode, no entero.

### 5. Fijar es conservar `fx`/`fy` al soltar

Cada elemento gana una marca `pinned`, aparte de `fx`/`fy`, porque durante un
arrastre común `fx`/`fy` también están puestos. El gesto:

- En `pointerdown` sobre un elemento con `ctrlKey` o `metaKey` se invierte la
  marca: si queda fijado, `fx`/`fy` toman su posición; si queda suelto, se
  vacían. Después sigue el agarre normal, así ctrl y arrastre fija y mueve de
  una vez.
- `release` deja `fx`/`fy` puestos si el elemento está fijado y los vacía si
  no. Arrastrar un elemento fijado sin ctrl lo deja fijado donde se soltó.
- `rebuild` copia `pinned` junto con `fx`/`fy`, así un elemento fijado
  sobrevive a rearmados, rebirths y devices nuevos. Si el id cambia de clave,
  por ejemplo al cambiar el separador de niveles, la marca se pierde con la
  clave, igual que la posición.

Se acepta `metaKey` porque en macOS ctrl-click es el click secundario del
sistema. El lienzo no tiene menú contextual, así que ctrl-click también anda
ahí, pero cmd-click es lo natural.

Alternativa descartada: invertir la marca en `pointerup` solo si no hubo
movimiento. Distingue click de arrastre con un umbral y deja sin definir qué
pasa con ctrl y arrastre; invertir al apretar es una regla sola.

### 6. La marca es una línea en unidades del grafo

Después de pintar el disco, un elemento fijado lleva una línea blanca vertical
centrada, de largo algo mayor que el radio del disco y extremos redondeados,
con la misma `globalAlpha` que el disco. Se dibuja en la misma transformación
que el disco, así escala con el zoom y desaparece al alejarse como los nombres,
y se ve igual sobre un disco sólido y sobre una rama hueca.

### 7. Un DEATH se detecta por el cambio de `statusAt`

`detectPulses` devuelve los orígenes con su tipo, `data` o `death`, y guarda
por elemento, además del último DATA contado, el último `statusAt` en
`offline` contado. Un elemento pulsa `death` cuando está `offline` con un
`statusAt` mayor al anotado; visto por primera vez solo se anota, como los
datos. De eso salen gratis:

- Un DEATH repetido de algo ya en gris no pulsa: `setStatus` no cambia
  `statusAt` si el estado es el mismo.
- La caída del enlace con el broker no pulsa: deja `stale`, no `offline`.
- Un NDEATH retenido al conectar no pulsa: el nodo se ve por primera vez.

Para que un NDEATH mande un solo pulso, un device que pasa a `offline` en el
mismo `statusAt` que su nodo no pulsa: el modelo apaga al nodo y a sus devices
con el mismo instante. El nodo de un device es el primer ancestro con `state`.

El filtro que hace compartir pulso a los mensajes seguidos de un mismo elemento
no se aplica al `death`: un DEATH inmediatamente después de un DATA tiene que
verse, y no hay ráfagas de DEATH que filtrar.

### 8. El pulso rojo es el mismo pulso con otro color y más resplandor

`Pulse` gana el tipo, y `drawPulseLight` elige por tipo el color del trazo y
del halo: el acento para `data` y el rojo de la paleta (`--red`, que pasa a
leerse en `readPalette`) para `death`, con un halo de radio mayor. La cabeza
del pulso sigue blanca en los dos: es el brillo del frente, no el color del
pulso. Un pulso en vuelo sobrevive a los rearmados igual que hoy.

### 9. El centrado tira de cada grafo entero, y no de lo que está anclado

La simulación tenía un centrado por elemento hacia el origen, para que los
grafos de distintas conexiones no se fueran a la deriva. Con pines deforma: un
nodo fijado lejos del centro no puede seguir a sus devices, y ellos, con un
resorte débil porque se reparte entre treinta hermanos, se van hacia el centro
y dejan al nodo en el borde. El centrado pasa a ser una fuerza propia con dos
reglas, y más suave, porque solo tiene que evitar la deriva:

- Una conexión con algún elemento fijado está anclada y no se centra: el pin ya
  le da lugar. Sin ese tirón, lo que cuelga de un elemento fijado no se deforma.
- Las demás conexiones reciben, en todos sus elementos por igual, el tirón que
  lleva el centro de su grafo hacia el origen. En conjunto es la misma fuerza
  que centrar cada elemento, así que dos grafos sueltos descansan como antes,
  pero el grafo se traslada parejo. Tirar según la posición de la conexión en
  vez de la del centro de su grafo juntaba las conexiones en el origen, pegadas
  por la colisión.

Lo que se fija en una conexión no cambia nada en las otras. Se probó y descartó
que el centro fuera el de los elementos fijados: fijar una rama en una conexión
movía los grafos de las demás. También se descartó que cada elemento fijado
atrajera a cada elemento con una fuerza ínfima: la suma de esos tirones es un
centrado elemento por elemento hacia el centro de los pines, y vuelve a correr
los devices de un nodo fijado lejos de ese centro. Y centrar solo las
conexiones, que arrastren lo suyo por los resortes: con la misma fuerza dos
grafos sueltos se alejan hasta donde alcanza la repulsión, y con más fuerza la
conexión se adelanta a su grafo a los tirones.

## Risks / Trade-offs

- [La cuerda supone un solo anillo de hermanos alrededor del padre; con muchos
  hermanos cargados puede quedar corta o larga] → La colisión y la fuerza más
  floja del punto 3 corrigen lo que falta; la colisión entre subárboles queda
  fuera de alcance como paso siguiente si no alcanza.
- [Las constantes de empaque y de fuerza se eligen a ojo] → Se calibran en la
  app con un grupo de nodos de treinta devices y con el caso chico de dos
  devices, y quedan juntas en `graph.ts` y `GraphView.tsx` con el resto.
- [Un elemento fijado puede quedar donde el grafo que crece lo necesita] → Es
  lo que pide el usuario al fijarlo; la colisión aparta al resto y la marca
  avisa por qué no se mueve.
- [Con ctrl-click en macOS el sistema dispara `contextmenu`] → El lienzo no lo
  usa; de aparecer un menú del sistema en alguna plataforma, se cancela el
  evento sobre el lienzo.
- [El dedupe del NDEATH depende de que nodo y devices compartan `statusAt`] →
  Así lo hace `applyEvent` hoy con un solo `at`; es una dependencia entre
  renderer y modelo que queda anotada en el código.
