# Spec Delta

## MODIFIED Requirements

### Requirement: Entramado elástico que se puede mover

Los elementos SHALL repelerse entre sí y quedar unidos a su padre de forma
elástica, de modo que el grafo se mantenga separado por sí solo. La distancia a
la que un elemento descansa de su padre SHALL dejar lugar a lo que cuelga del
elemento, sea cual sea su tipo, de modo que el padre quede fuera de lo que
ocupan sus hijos y dos hermanos con muchos hijos no se superpongan. Un elemento
con pocos hijos SHALL descansar tan cerca de su padre como uno sin hijos, y una
cadena de elementos de hijo único SHALL NOT alargarse por lo que cuelga al
final de ella. El usuario SHALL poder agarrar con el mouse cualquier elemento,
por su círculo o por sus puntos, y arrastrarlo; mientras lo arrastra el
elemento SHALL seguir al puntero y el resto SHALL responder. Al soltarlo, el
elemento vuelve a quedar sujeto a las fuerzas y la estructura SHALL acomodarse
de nuevo sin superponerse.

#### Scenario: Arrastrar un device

- **WHEN** el usuario aprieta el botón sobre un device y mueve el mouse
- **THEN** el device va con el puntero, con sus puntos detrás, y los elementos unidos a él lo siguen

#### Scenario: Soltarlo entre otros dos

- **WHEN** el usuario suelta un device entre otros dos elementos
- **THEN** los elementos se apartan y el grafo queda otra vez separado, sin grupos de puntos superpuestos

#### Scenario: Arrastrar sobre el fondo

- **WHEN** el usuario arrastra sobre una parte del lienzo sin elementos ni puntos
- **THEN** se mueve el lienzo entero y ningún elemento cambia de lugar respecto de los demás

#### Scenario: Reposo

- **WHEN** el usuario suelta el elemento y pasan unos segundos sin tráfico
- **THEN** el grafo queda quieto

#### Scenario: Nodo con muchos devices

- **WHEN** el nodo `smer_2323`, que cuelga de la rama `comunicacion`, publica treinta devices con nueve métricas cada uno y el grafo queda en reposo
- **THEN** `comunicacion` queda fuera del círculo que ocupan los devices de `smer_2323`, no entre ellos

#### Scenario: Dos hermanos cargados

- **WHEN** los nodos `smer_2323` y `smer_2324` cuelgan de la rama `comunicacion` y cada uno tiene treinta devices
- **THEN** en reposo los devices de uno no se mezclan con los del otro

#### Scenario: Rama intermedia cargada

- **WHEN** la rama intermedia `sala` tiene treinta devices y es hermana de otra rama igual de cargada
- **THEN** las dos ramas se abren igual que lo harían dos nodos con esos devices

#### Scenario: Pocos hijos

- **WHEN** un nodo tiene dos devices
- **THEN** descansa de su padre a la misma distancia que un nodo sin devices

#### Scenario: Cadena de hijo único

- **WHEN** las ramas `recreo`, `ancasti` y `repetidora` tienen un solo hijo cada una y al final de la cadena hay un nodo con treinta devices
- **THEN** la distancia entre cada rama y la siguiente es la misma que si al final hubiera un nodo sin devices

### Requirement: Pulso de los mensajes de datos

Cuando llega un mensaje de datos de un nodo o de un device, la vista SHALL
mostrar un pulso que recorre las líneas del grafo desde el elemento que lo
publicó hasta la conexión. Los mensajes de un mismo elemento que llegan muy
seguidos MAY compartir un pulso. Cuando llega el DEATH de un nodo o de un
device, la vista SHALL mostrar un pulso del mismo recorrido, rojo y con
resplandor, que se distingue del de los datos. Un NDEATH SHALL generar un solo
pulso, el del nodo, aunque sus devices se apaguen con él. Un BIRTH SHALL NOT
generar pulso, y la pérdida del enlace con el broker SHALL NOT generar pulso.

#### Scenario: DATA de un device

- **WHEN** llega un DDATA del device `tanque1`, que cuelga de `sala`, del nodo `plc`, del grupo `G1`
- **THEN** un pulso sale de `tanque1` y pasa por `sala`, `plc` y `G1` hasta la conexión

#### Scenario: DATA de un nodo

- **WHEN** llega un NDATA del nodo `plc`
- **THEN** un pulso sale de `plc` y llega a la conexión pasando por su grupo

#### Scenario: BIRTH

- **WHEN** llega un DBIRTH
- **THEN** no sale ningún pulso

#### Scenario: DDEATH

- **WHEN** llega el DDEATH del device `tanque1`
- **THEN** un pulso rojo con resplandor sale de `tanque1` y recorre las líneas hasta la conexión, y `tanque1` queda en gris

#### Scenario: NDEATH de un nodo con devices

- **WHEN** llega el NDEATH del nodo `plc`, que tiene diez devices en línea
- **THEN** sale un solo pulso rojo, desde `plc` hasta la conexión, y ningún pulso desde los devices

#### Scenario: DEATH de algo que ya estaba fuera de línea

- **WHEN** llega el DDEATH de un device que ya se veía en gris
- **THEN** no sale ningún pulso

#### Scenario: DATA y DEATH seguidos

- **WHEN** un device publica un DDATA y de inmediato llega su DDEATH
- **THEN** salen los dos pulsos, el de acento y el rojo

#### Scenario: Conexión cortada

- **WHEN** se corta el enlace con el broker y los nodos pasan a verse atenuados
- **THEN** no sale ningún pulso rojo

## ADDED Requirements

### Requirement: Elementos fijados

El usuario SHALL poder fijar cualquier elemento con ctrl-click, o cmd-click en
macOS. Un elemento fijado SHALL quedarse en su lugar aunque el resto del grafo
se reacomode, SHALL poder arrastrarse con el mouse y quedar fijado donde se lo
suelta, y SHALL seguir fijado mientras el grafo crece o cambia. Un segundo
ctrl-click SHALL soltarlo. La vista SHALL marcar un elemento fijado con una
pequeña línea blanca vertical dentro de su círculo, y su leyenda SHALL indicar
que ctrl-click fija un elemento.

#### Scenario: Fijar

- **WHEN** el usuario hace ctrl-click sobre un device y luego aparece un device nuevo junto a él
- **THEN** el device fijado no se mueve, los demás se acomodan alrededor, y dentro de su círculo se ve una línea blanca vertical

#### Scenario: Mover uno fijado

- **WHEN** el usuario arrastra un elemento fijado sin apretar ctrl y lo suelta en otro lugar
- **THEN** el elemento queda fijado en el lugar nuevo y conserva la marca

#### Scenario: Soltar

- **WHEN** el usuario hace ctrl-click sobre un elemento fijado
- **THEN** la marca desaparece y el elemento vuelve a quedar sujeto a las fuerzas

#### Scenario: Ancla para acomodar a mano

- **WHEN** el usuario fija la rama `comunicacion` y arrastra el nodo `smer_2323` que cuelga de ella
- **THEN** `comunicacion` no se mueve y el resto del grafo pivota alrededor de ella

#### Scenario: Nodo fijado lejos de su rama

- **WHEN** el usuario fija la rama `comunicacion` y fija el nodo `smer_2323` lejos de ella, con sus treinta devices sueltos
- **THEN** en reposo los devices siguen repartidos alrededor del nodo, no corridos hacia un lado

#### Scenario: Rebirth de uno fijado

- **WHEN** un nodo fijado vuelve a publicar su NBIRTH con las mismas métricas
- **THEN** sigue fijado en el mismo lugar

#### Scenario: Fijado fuera de línea

- **WHEN** llega el DDEATH de un device fijado
- **THEN** el device se ve en gris y la línea blanca se ve con la misma atenuación que el círculo

#### Scenario: Zoom alejado

- **WHEN** el usuario se aleja hasta que los círculos se ven pequeños
- **THEN** la línea blanca se achica con el círculo, sin tapar el nombre ni los puntos

#### Scenario: Leyenda

- **WHEN** el usuario mira la leyenda de la vista
- **THEN** encuentra, junto a los tipos de elemento, la marca del elemento fijado con el texto "Ctrl+click fija"
