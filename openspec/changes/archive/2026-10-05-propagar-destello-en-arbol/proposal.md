# Proposal

## Why

En el árbol de datos, el valor de una métrica destella cuando llega una
actualización, pero solo si la fila de esa métrica está en la lista. Con una
rama colapsada (a mano, o porque arranca cerrada: listas de más de 60 métricas
y definiciones de UDT) o con el buscador filtrando, las actualizaciones pasan
sin ninguna señal: un device que publica todo el tiempo se ve igual que uno
callado. Propagar el destello al primer nivel visible permite seguir la
actividad con el árbol plegado.

## What Changes

- Cada actualización de una métrica hace destellar **una sola fila**: la más
  profunda de su rama que esté en la lista.
  - Si la fila de la métrica está en la lista, destella su valor, igual que hoy.
  - Si no, destella el **nombre** del primer nivel visible por encima: el UDT,
    el device, la fila `-` de métricas del nodo, el nodo, un tramo intermedio
    del id, el grupo o la conexión.
- El destello propagado usa la misma animación (color y duración) que hoy tiene
  el valor, aplicada al nombre de la fila.
- La regla no distingue por qué la métrica no está en la lista: rama colapsada
  o filtro del buscador. El comportamiento del buscador no cambia.

Fuera de alcance:

- Cambios en el buscador (por ejemplo, poder colapsar durante una búsqueda).
- Señalar cambios de estado (ONLINE, OFFLINE): para eso ya está el contador
  `N offline`.
- Contadores de cambios, niveles de intensidad o una opción para apagar el
  destello.

Supuestos tomados sin confirmación explícita, para revisar en los specs:

- Un UDT colapsado cuenta como un nivel más: destella cuando cambia un miembro.
- El primer valor de una métrica (BIRTH) no destella hoy y tampoco se propaga:
  un rebirth no enciende el árbol.
- Cada actualización nueva reinicia el destello, así que una rama colapsada con
  mucho tráfico queda encendida casi todo el tiempo.
- Una fila que está en la lista pero fuera de pantalla por el scroll cuenta como
  visible: no propaga.

## Capabilities

### New Capabilities

- `destello-de-actualizaciones`: cómo el árbol de datos señala las métricas que
  acaban de actualizarse: qué fila destella, cuándo destella y cuándo no. El
  proyecto todavía no tiene specs, así que cubre el destello sobre el valor que
  ya existe y la propagación nueva.

### Modified Capabilities

Ninguna: no hay specs previos.

## Impact

- `src/renderer/src/tree.ts`: cálculo de la última actualización entre lo que
  cuelga de una fila y no está en la lista.
- `src/renderer/src/views/TreeView.tsx`: conjunto de filas en la lista y
  destello sobre el nombre de la fila.
- `src/renderer/src/assets/main.css`: estilo del destello en el nombre.
- `README.md`: sección "Árbol de datos".
- Sin cambios en el proceso principal, el preload, el modelo de datos
  compartido ni las dependencias.
- Costo en cada pasada de dibujo: se recorre lo que está oculto debajo de las
  filas que hay en pantalla (detalle en `design.md`).
