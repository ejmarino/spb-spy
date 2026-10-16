# Proposal

## Why

Con nodos que publican unos treinta devices cada uno, el grafo de la
visualización de datos queda apelmazado: el enlace de cada elemento con su padre
descansa a una distancia que solo cuenta las métricas propias del elemento, no
los devices que cuelgan de él, así que la rama de la que cuelga queda enterrada
entre los devices y dos nodos hermanos cargados se pisan. Alejarlos con el mouse
no sirve porque el resorte los devuelve, y no hay forma de dejar un elemento
donde uno lo pone. Además, cuando un nodo o device muere solo se apaga su color,
y en una instalación grande eso pasa desapercibido mientras el resto pulsa.

## What Changes

- El enlace de un elemento con su padre descansa a una distancia que deja lugar
  a lo que cuelga del elemento, de cualquier tipo: devices, nodos o ramas
  intermedias. Un nodo con treinta devices queda a la distancia que ocupan sus
  devices, y dos hermanos así se abren hasta no pisarse.
- Las cadenas de hijo único no se estiran por eso, y un elemento con pocos hijos
  queda igual de cerca de su padre que hasta ahora.
- Los enlaces de un elemento con muchos hijos aflojan un poco más, para que la
  colisión pueda repartir a los hermanos alrededor del padre.
- El usuario puede fijar un elemento con ctrl-click (cmd-click en macOS): el
  elemento queda quieto en su lugar aunque el grafo se reacomode, y se lo puede
  seguir moviendo con el mouse, donde queda fijo de nuevo. Otro ctrl-click lo
  suelta. Un elemento fijado se distingue por una rayita blanca dentro de su
  círculo.
- Un NDEATH o un DDEATH manda un pulso rojo con resplandor por las líneas,
  desde el nodo o device que murió hasta su conexión, como hoy lo hace un
  mensaje de datos con el color de acento. Un NDEATH manda un solo pulso desde
  el nodo, no uno por cada device que se apaga con él. Un BIRTH sigue sin pulso.

Fuera de alcance: guardar los elementos fijados entre sesiones, una forma de
fijar que no sea con el mouse, una colisión entre subárboles enteros, y un pulso
para la pérdida del enlace con el broker, que no es un DEATH.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `visualizacion-de-datos`: el requisito "Entramado elástico que se puede mover"
  pasa a exigir que el enlace con el padre deje lugar a lo que cuelga de cada
  elemento; el requisito "Pulso de los mensajes de datos" deja de excluir al
  DEATH y pasa a exigirle un pulso rojo; y se agrega el requisito de los
  elementos fijados. Los demás requisitos no cambian.

## Impact

- **Renderer**: `src/renderer/src/graph.ts`, que calcula lo que ocupa cada
  elemento y detecta los pulsos, y `src/renderer/src/views/GraphView.tsx`, con
  el largo y la fuerza de los enlaces, el gesto de fijar, el dibujo de la marca
  y el color de los pulsos. El rojo ya existe en la paleta (`--red`).
- **Documentación**: `README.md`, sección "Visualización de datos".
- Sin dependencias nuevas, sin cambios en el modelo compartido ni en el proceso
  principal.
