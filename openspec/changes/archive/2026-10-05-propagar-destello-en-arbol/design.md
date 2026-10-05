# Design

## Context

Motivación y alcance: ver `proposal.md`. Requisitos: ver
`specs/destello-de-actualizaciones/spec.md`.

Estado actual que condiciona el enfoque:

- El destello se decide al dibujar cada fila (`TreeRow` en
  `src/renderer/src/views/TreeView.tsx`): destella si la métrica se actualizó
  hace menos de `FLASH_MS` (1,2 s) y no es su primer valor (`updates > 1`). El
  `span` del valor lleva `key={metric.updates}` para que la animación CSS
  `fresh` vuelva a empezar con cada actualización.
- El store del renderer vuelve a notificar `FLASH_MS + 100` ms después del
  último lote de eventos, y con esa pasada se apaga la clase.
- El árbol de `TreeItem` se rearma solo cuando cambia su forma; las filas
  apuntan a los estados de métrica del modelo, que se modifican en el lugar. Un
  recorrido del árbol ve siempre los `updatedAt` y `updates` al día.
- La lista de filas la arma `flattenTree` (`src/renderer/src/tree.ts`) según lo
  desplegado o el texto buscado. `VirtualList` monta después solo las que entran
  en pantalla.
- Todo ítem con métrica (métrica, miembro, UDT de cualquier nivel) ya expone,
  vía `leafOf`, un `updatedAt` y un `updates` que cubren lo que tiene debajo:
  un DATA que cambia un miembro sube también los del UDT que lo contiene
  (`applyData` en `src/shared/model.ts` y `mergeTemplate` en
  `src/shared/template.ts`).
- El repo no tiene tests automáticos: se verifica con typecheck, lint y la app
  corriendo contra un nodo simulado.

## Goals / Non-Goals

**Goals:**

- Obtener el destello propagado como un dato derivado al dibujar, sin estado
  nuevo que mantener.
- Una sola definición de "oculto" que sirva para el colapso y para el buscador.
- Que el costo dependa de lo que está oculto debajo de las filas en pantalla, no
  del tamaño total del árbol.

**Non-Goals:**

- Tocar el modelo compartido, el proceso principal o el IPC.
- Cambiar `flattenTree` o cualquier comportamiento del buscador.

## Decisions

### 1. Calcular al dibujar, no acumular marcas de actividad al aplicar eventos

Para una fila de la lista se miran sus hijos que **no** están en la lista y se
toma la actualización más reciente, entre las que no son un primer valor, de
todo lo que cuelga de ellos. Si hay una dentro de `FLASH_MS`, destella el
nombre.

- Es la misma forma en que ya se decide el destello del valor, y no agrega
  estado que sincronizar entre el proceso principal y el renderer.
- Alcanza para el buscador, donde una fila puede tener hijos en la lista e hijos
  ocultos a la vez.

Alternativa descartada: guardar en `applyData` la hora del último DATA de cada
nodo y device. Daría un costo fijo por fila, pero no distingue si la métrica que
cambió está a la vista (necesario con el buscador), y no cubre grupos, tramos de
id ni UDT, que solo existen en el renderer. Habría que recorrer igual.

### 2. "Está en la lista" es pertenecer al resultado de `flattenTree`

Junto con `rows` se arma un conjunto con esas mismas filas, con las mismas
dependencias del memo. El scroll no interviene porque la virtualización ocurre
después.

Alternativa descartada: usar el estado abierto/cerrado para el colapso y una
lógica aparte para la búsqueda. Duplicaría la regla del buscador fuera de
`flattenTree`.

### 3. No bajar por debajo de un ítem con métrica

El recorrido de lo oculto baja solo por contenedores sin métrica (conexión,
grupo, tramos de id, nodo, device, fila `-`). Al llegar a un ítem con métrica no
sigue por las filas: mira la métrica. Si es un UDT, recorre los miembros de su
valor y toma la marca de cada uno; si no, usa su `updatedAt` y `updates`.

- Cada métrica o miembro oculto cuesta una lectura, sin resolver el camino de
  cada miembro de un UDT.
- Un UDT colapsado sale del mismo mecanismo: sus miembros son hijos ocultos.

Ajuste hecho al implementar: la idea inicial era usar directamente el
`updatedAt` y `updates` del UDT, que suben con cualquier DATA suyo. Pero también
suben cuando el DATA trae un miembro por primera vez o solo parámetros, casos en
los que con el UDT desplegado no destella nada. Mirando miembro por miembro, una
fila destella por lo oculto exactamente cuando destellaría alguna de sus
métricas si estuviera a la vista.

### 4. Función pura en `tree.ts`, evaluada solo para las filas montadas

Vive junto a `leafOf` y `flattenTree`. Recibe la fila y el conjunto de filas en
la lista, y devuelve el instante de la última actualización oculta, o 0 si no
hay. `TreeView` la evalúa para las filas que `VirtualList` monta; `TreeRow`
compara ese instante con `store.now` y `FLASH_MS`, igual que hace con el valor.

### 5. Destello sobre el `span` del nombre, con la animación existente

- Clase `is-fresh` sobre `.tree-label`, reutilizando `@keyframes fresh`.
- `key` del `span` igual al instante de la última actualización oculta, para que
  la animación vuelva a empezar (equivalente al `key={metric.updates}` del
  valor).
- El nombre lleva de forma permanente el mismo relleno y radio que el valor, así
  el resaltado tiene la misma forma y el texto no se mueve al encenderse.
- El apagado usa el temporizador que ya tiene el store.

Alternativas descartadas por el usuario en la exploración: teñir la fila entera
y un punto indicador junto al nombre.

## Risks / Trade-offs

- [Recorrido en cada pasada con ramas ocultas muy grandes: una conexión
  colapsada con decenas de miles de métricas, hasta unas 10 pasadas por segundo]
  → Cada métrica oculta cuesta una lectura. Medido con 20 devices de 1.000
  métricas y un DATA de 50 métricas cada 100 ms: el recorrido de las 20.000
  métricas ocultas lleva unos 0,6 ms por pasada y la interfaz se mantiene en 60
  cuadros por segundo, sin tareas largas. El scroll usa el mismo tiempo de hilo
  principal que antes del cambio. No hizo falta guardar resultados.
- [Nombres destellando todo el tiempo ocupan el hilo principal: la animación del
  fondo se resuelve ahí] → Con 12 nombres encendidos a la vez, unos 0,15 s de
  cada segundo. Es el mismo costo que ya tienen los valores cuando destellan.
- [El destello compara la hora del sistema tomada en el proceso principal
  (llegada del mensaje) con la del renderer (dibujo), tanto en el nombre como en
  el valor: si el reloj salta entre una y otra, ese destello no se ve] → Es el
  mecanismo que ya existía y este cambio no lo toca. Se notó porque en el
  devcontainer (WSL2) el reloj adelanta unos 3,3 s cada 30 s; en ese entorno se
  pierde algún destello aislado.
- [Con el buscador, las filas que son solo camino hacia una coincidencia
  destellan por métricas que el filtro oculta] → Es el comportamiento pedido; se
  explica en el README.
- [Una rama con tráfico constante deja su nombre encendido casi todo el tiempo]
  → Aceptado como luz de actividad. Si molesta se revisa el aspecto, no la
  regla.
- [Volver a montar el `span` del nombre en cada reinicio corta una selección de
  texto en curso sobre ese nombre] → Menor; hoy pasa lo mismo con el valor.
