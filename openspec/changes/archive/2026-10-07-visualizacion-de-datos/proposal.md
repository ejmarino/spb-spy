# Proposal

## Why

El árbol de datos muestra bien los valores, pero no deja ver de un vistazo qué
partes de una instalación están hablando: la actividad aparece fila por fila y
la mayor parte queda fuera de pantalla o dentro de ramas cerradas. Hace falta
una vista pensada para mirar, que muestre toda la jerarquía a la vez y dónde hay
tráfico, al estilo de Gource.

## What Changes

- Nueva vista **"Visualización de datos"** en el panel lateral, debajo de
  "Árbol de datos". Muestra la misma información que el árbol como un grafo
  animado, sobre un lienzo que se recorre con zoom y arrastre.
- Cada conexión, grupo, nodo y device es un elemento del grafo unido a su
  padre, con su nombre a la vista. Los ids se abren en niveles con la misma
  regla y la misma configuración que el árbol de datos.
- Las métricas son puntos sin nombre, agrupados alrededor de su nodo o device.
  Un UDT es un solo punto.
- Una métrica que se actualiza hace brillar su punto, con la misma regla que el
  destello del árbol. Cada mensaje de datos manda además un pulso por las ramas,
  desde el nodo o device que lo publicó hasta la conexión.
- Los nodos y devices offline se ven en gris junto con sus puntos; los que no
  tienen confirmación en vivo, atenuados.
- Al apuntar a un punto, un tooltip muestra el nombre de la métrica, su valor
  con unidad, el tipo y la hora. Sobre un nodo o device muestra su estado y
  cuántas métricas tiene.
- Todas las conexiones comparten el lienzo, cada una como un grafo aparte con
  su color.
- El grafo es un entramado elástico: los elementos se repelen entre sí y se
  mantienen separados solos. El usuario puede agarrar con el mouse cualquier
  elemento y llevarlo a otro lado; al soltarlo, toda la estructura se vuelve a
  acomodar. Los puntos siguen a su elemento con un pequeño retraso.
- Cada punto y cada elemento tienen un halo luminoso; la luz se suma donde se
  superponen.
- Un rebirth de un nodo o device que ya estaba no mueve nada; un nodo o device
  nuevo hace que el grafo se acomode para darle lugar.

Fuera de alcance:

- Buscar, filtrar o elegir conexiones dentro de la vista.
- Enviar comandos o pedir un rebirth desde el grafo.
- Mostrar el nombre o el valor de las métricas sin apuntarlas, y abrir los
  miembros de un UDT.
- Fijar un elemento en un lugar (lo que se arrastra vuelve a quedar sujeto a
  las fuerzas al soltarlo), agarrar los puntos de las métricas, y recordar la
  disposición entre sesiones.
- Opciones nuevas en la configuración.
- Reproducir tráfico pasado: la vista muestra solo lo que pasa en vivo.

Supuestos tomados sin confirmación explícita, registrados en design.md: las
instalaciones grandes se resuelven con zoom y no resumiendo métricas, y los
mensajes muy seguidos de un mismo nodo o device pueden compartir un pulso.

## Capabilities

### New Capabilities

- `visualizacion-de-datos`: la vista en grafo de la jerarquía de conexiones,
  grupos, nodos, devices y métricas, cómo señala la actividad y el estado, y
  cómo se recorre.

### Modified Capabilities

Ninguna. `separacion-en-niveles` y `destello-de-actualizaciones` definen reglas
que esta vista reutiliza, pero sus requisitos sobre el árbol no cambian.

## Impact

- **Dependencia nueva**: `d3-force` (y sus tipos), solo para la simulación
  física que acomoda el grafo. Es la primera librería de visualización del
  proyecto; el dibujo es canvas 2D propio.
- **Renderer**: vista nueva y un módulo con la lógica pura del grafo; `App.tsx`
  (ítem del panel lateral), `tree.ts` (exponer el momento de la última
  actualización de una fila, que hoy es interno) y `assets/main.css`.
- **Sin cambios** en el proceso principal, el IPC, el modelo de datos ni
  `settings.json`.
- **Rendimiento**: la vista anima un lienzo mientras está abierta y hay
  actividad; cerrada no consume nada.
- **Documentación**: `README.md`, sección nueva y la lista de funciones.
