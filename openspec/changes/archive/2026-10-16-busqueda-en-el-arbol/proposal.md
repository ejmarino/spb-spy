# Proposal

## Why

El buscador del árbol de datos hace una sola cosa: filtra por texto contenido
en el nombre y muestra la coincidencia con todo lo que cuelga de ella, abierto
y sin poder cerrarse. Sirve para encontrar un nodo o un device, pero no para
buscar una métrica que se repite en muchos devices, porque cada coincidencia
arrastra a sus vecinas y el resultado se vuelve largo; tampoco deja expresar
patrones, y en una instalación con treinta devices por nodo no se puede
achicar el resultado para mirar una parte.

## What Changes

- El texto se puede interpretar de dos modos: **contiene**, como hasta ahora,
  o **regex**, donde solo queda lo que encaja con la expresión. En los dos
  modos se compara contra el nombre simple de la fila: un tramo del id de grupo
  o de nodo, el nodo, el device o la métrica, no el camino completo.
- Dos alcances para lo que se muestra de una coincidencia: **con lo que
  cuelga**, que la abre con todo lo suyo, o **solo la coincidencia**, que la
  muestra cerrada, con su camino arriba y nada más. El primero sirve para
  buscar nodos o devices por nombre; el segundo, métricas del mismo nombre a
  través de distintos nodos.
- El resultado de una búsqueda se puede colapsar y expandir como el árbol
  normal: el alcance decide cómo arranca cada coincidencia y el chevrón lo
  cambia después. Expandir todo y Colapsar todo vuelven a funcionar con una
  búsqueda puesta.
- Debajo de una coincidencia abierta rigen las reglas normales del árbol: una
  lista de más de 60 métricas arranca colapsada también en un resultado. Hoy se
  abre todo.
- Una regex inválida mientras se escribe marca el cuadro y deja el árbol sin
  filtrar, en vez de vaciarlo.
- Las dos opciones van como chips al lado del cuadro y se recuerdan mientras la
  app está abierta.

Fuera de alcance: buscar contra el camino completo, buscar por valor, y
guardar las opciones entre sesiones.

## Capabilities

### New Capabilities

- `busqueda-en-el-arbol`: cómo el buscador del árbol de datos interpreta el
  texto, qué filas deja a la vista de cada coincidencia y cómo se recorre el
  resultado. Hoy ese comportamiento no está escrito en ningún spec.

### Modified Capabilities

Ninguna. `separacion-en-niveles` sigue decidiendo qué filas existen; este
cambio solo decide cuáles quedan a la vista al buscar.

## Impact

- **Renderer**: `src/renderer/src/tree.ts`, donde `flattenTree` arma las filas
  visibles, y `src/renderer/src/views/TreeView.tsx`, con el cuadro, las
  opciones y el estado de abierto y cerrado; `src/renderer/src/assets/main.css`
  para los chips de opción y el cuadro inválido.
- **Documentación**: `README.md`, sección "Árbol de datos".
- Sin dependencias nuevas ni cambios fuera de la vista del árbol.
