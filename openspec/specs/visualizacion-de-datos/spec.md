# visualizacion-de-datos Specification

## Purpose

Define la vista "Visualización de datos": un grafo animado de la jerarquía de
conexiones, grupos, nodos, devices y métricas, pensado para ver de un vistazo
dónde hay actividad y qué está fuera de línea.

En este spec, "elemento" es cada conexión, grupo, nodo, device o rama
intermedia del grafo, y "punto" es la marca que representa a una métrica.

## Requirements

### Requirement: Acceso a la vista

El panel lateral SHALL ofrecer un ítem "Visualización de datos", ubicado
inmediatamente debajo de "Árbol de datos", que abre la vista en el área
principal.

#### Scenario: Abrir la vista

- **WHEN** el usuario hace clic en "Visualización de datos"
- **THEN** el área principal muestra el grafo de las conexiones configuradas

#### Scenario: Sin datos

- **WHEN** el usuario abre la vista y ninguna conexión recibió datos todavía
- **THEN** la vista muestra un elemento por cada conexión configurada, sin nada colgando de ellos
- **AND** si no hay conexiones configuradas, muestra un mensaje que lo indica

### Requirement: Estructura del grafo

La vista SHALL mostrar un elemento por cada conexión, grupo, nodo y device que
muestra el árbol de datos, unido con una línea al elemento del que depende. Los
ids de grupo, nodo y device SHALL abrirse en niveles según la capacidad
`separacion-en-niveles`, con una rama intermedia por tramo. Una rama intermedia
SHALL dibujarse como un círculo hueco, para distinguirla de un nodo o device
real, y la leyenda de la vista SHALL explicarlo.

#### Scenario: Jerarquía simple

- **WHEN** la conexión `Planta` recibe el device `bomba` del nodo `plc` del grupo `G1`
- **THEN** el grafo muestra `Planta` unido a `G1`, `G1` unido a `plc` y `plc` unido a `bomba`

#### Scenario: Ids con tramos

- **WHEN** el separador es `:` y un nodo publica los devices `sala:tanque1` y `sala:tanque2`
- **THEN** del nodo cuelga un elemento `sala`, y de `sala` cuelgan `tanque1` y `tanque2`

#### Scenario: Rama intermedia hueca

- **WHEN** el separador es `:` y los únicos devices de un nodo son `sala:tanque1` y `sala:tanque2`
- **THEN** `sala` se dibuja como un círculo hueco y `tanque1` y `tanque2` como círculos llenos

#### Scenario: La rama también es un device

- **WHEN** además existe el device `sala`
- **THEN** `sala` se dibuja como un círculo lleno, con sus puntos

#### Scenario: Separación deshabilitada

- **WHEN** la separación en niveles está deshabilitada y un nodo publica el device `sala:tanque1`
- **THEN** del nodo cuelga un único elemento `sala:tanque1`

#### Scenario: Varias conexiones

- **WHEN** hay dos conexiones con datos
- **THEN** el lienzo muestra dos grafos separados, cada uno con el color de su conexión en el elemento raíz

### Requirement: Las métricas son puntos alrededor de su dueño

Cada métrica SHALL mostrarse como un punto, agrupado alrededor del nodo o device
que la publica. Las métricas propias de un nodo SHALL agruparse alrededor del
elemento del nodo. Un UDT SHALL mostrarse como un único punto, de un color
distinto al de las demás métricas, sin abrir sus miembros.

#### Scenario: Métricas de un device

- **WHEN** el device `bomba` tiene 12 métricas
- **THEN** alrededor del elemento `bomba` hay 12 puntos

#### Scenario: Métricas del nodo

- **WHEN** el nodo `plc` publica 3 métricas propias y tiene un device con 5
- **THEN** hay 3 puntos alrededor de `plc` y 5 alrededor del device

#### Scenario: UDT

- **WHEN** un device tiene una métrica UDT con 8 miembros
- **THEN** alrededor del device hay un solo punto por ese UDT

#### Scenario: Muchas métricas

- **WHEN** un device tiene 500 métricas
- **THEN** el device muestra los 500 puntos, sin superponerse con los de los elementos vecinos

### Requirement: Puntos resumidos al alejar

Cuando el zoom está tan alejado que los puntos no se distinguirían, la vista
SHALL mostrar en su lugar una sola marca del tamaño que ocupan los puntos de
cada nodo o device, y SHALL encenderla cuando ese nodo o device publica datos.

#### Scenario: Instalación grande encuadrada

- **WHEN** el grafo tiene 200 devices de 100 métricas y está todo encuadrado
- **THEN** cada device se ve como una marca, y las de los devices que publican se encienden

#### Scenario: Acercarse

- **WHEN** el usuario acerca el zoom sobre un device
- **THEN** la marca da lugar a los puntos de sus métricas

### Requirement: Nombres hasta el device

Cada elemento SHALL mostrar su nombre junto a él. Los puntos SHALL NOT mostrar
nombre ni valor mientras no se los apunte. Al alejar el zoom, la vista SHALL
ocultar los nombres que resultarían ilegibles, y SHALL mantener visible el de
cada conexión.

#### Scenario: Nombres visibles

- **WHEN** el grafo entra completo en la vista con un zoom cómodo
- **THEN** se leen los nombres de la conexión, los grupos, los nodos, los devices y las ramas intermedias
- **AND** ningún punto tiene texto

#### Scenario: Zoom alejado

- **WHEN** el usuario aleja el zoom hasta que los devices quedan muy chicos
- **THEN** los nombres de los devices dejan de mostrarse y el de la conexión sigue visible

### Requirement: Brillo de las métricas actualizadas

Cuando una métrica recibe una actualización, su punto SHALL brillar y apagarse
en 1,2 segundos. Una actualización es lo que define la capacidad
`destello-de-actualizaciones`: el primer valor de una métrica no cuenta. El
punto de un UDT SHALL brillar cuando se actualiza cualquiera de sus miembros.

#### Scenario: Llega un dato

- **WHEN** llega un DATA con un valor nuevo para una métrica que ya tenía valor
- **THEN** el punto de esa métrica brilla y se apaga en 1,2 segundos

#### Scenario: BIRTH

- **WHEN** llega el BIRTH de un device
- **THEN** ninguno de sus puntos brilla

#### Scenario: Miembro de un UDT

- **WHEN** llega un DATA que actualiza un miembro de un UDT
- **THEN** brilla el punto del UDT

#### Scenario: Actividad continua

- **WHEN** una métrica se actualiza varias veces por segundo
- **THEN** su punto permanece encendido mientras dura la actividad y se apaga 1,2 segundos después de la última

### Requirement: Pulso de los mensajes de datos

Cuando llega un mensaje de datos de un nodo o de un device, la vista SHALL
mostrar un pulso que recorre las líneas del grafo desde el elemento que lo
publicó hasta la conexión. Los mensajes de un mismo elemento que llegan muy
seguidos MAY compartir un pulso. Un BIRTH o un DEATH SHALL NOT generar pulso.

#### Scenario: DATA de un device

- **WHEN** llega un DDATA del device `tanque1`, que cuelga de `sala`, del nodo `plc`, del grupo `G1`
- **THEN** un pulso sale de `tanque1` y pasa por `sala`, `plc` y `G1` hasta la conexión

#### Scenario: DATA de un nodo

- **WHEN** llega un NDATA del nodo `plc`
- **THEN** un pulso sale de `plc` y llega a la conexión pasando por su grupo

#### Scenario: BIRTH

- **WHEN** llega un DBIRTH
- **THEN** no sale ningún pulso

### Requirement: Estado de nodos y devices

La vista SHALL distinguir el estado de cada nodo y device: en línea con su
color, fuera de línea en gris y sin confirmación en vivo atenuado. Los puntos
SHALL seguir el estado del nodo o device del que dependen, y SHALL conservarse
aunque esté fuera de línea. Un grupo o una rama intermedia SHALL verse en línea
si algo de lo que cuelga de ellos lo está, y si no, con el estado de lo que
cuelga.

#### Scenario: DEATH de un nodo

- **WHEN** llega el NDEATH de un nodo
- **THEN** el nodo, sus devices y todos sus puntos pasan a verse en gris, sin desaparecer

#### Scenario: Rama intermedia con todo fuera de línea

- **WHEN** los devices `sala:tanque1` y `sala:tanque2` están fuera de línea
- **THEN** la rama `sala` se ve en gris

#### Scenario: Vuelve a nacer

- **WHEN** un nodo fuera de línea publica un NBIRTH en vivo
- **THEN** el nodo recupera su color

#### Scenario: Conexión cortada

- **WHEN** se corta el enlace con el broker
- **THEN** los nodos y devices que estaban en línea pasan a verse atenuados

### Requirement: Tooltip al apuntar

Al apuntar con el mouse a un punto, la vista SHALL mostrar un tooltip con el
nombre de la métrica, su valor con la unidad, el tipo de dato y la hora de la
última actualización, y SHALL mantenerlo al día mientras el mouse siga encima.
Sobre un nodo o device, el tooltip SHALL mostrar su id completo, su estado y
cuántas métricas tiene.

#### Scenario: Apuntar a una métrica

- **WHEN** el usuario apunta al punto de la métrica `nivel`, de tipo Int32, con valor 42 y unidad `cm`
- **THEN** aparece un tooltip con `nivel`, `42 cm`, `Int32` y la hora de la última actualización

#### Scenario: El valor cambia mientras se apunta

- **WHEN** el usuario mantiene el mouse sobre un punto y llega un valor nuevo para esa métrica
- **THEN** el tooltip pasa a mostrar el valor nuevo

#### Scenario: Apuntar a un UDT

- **WHEN** el usuario apunta al punto de un UDT
- **THEN** el tooltip muestra el nombre del UDT y el mismo resumen que muestra su fila en el árbol de datos

#### Scenario: Apuntar a un device

- **WHEN** el usuario apunta al device `sala:tanque1`, en línea y con 12 métricas
- **THEN** el tooltip muestra `sala:tanque1`, que está en línea y que tiene 12 métricas

#### Scenario: Salir

- **WHEN** el usuario mueve el mouse fuera del punto o del elemento
- **THEN** el tooltip desaparece

### Requirement: Recorrer el lienzo

El usuario SHALL poder acercar y alejar con la rueda del mouse, centrado en el
puntero, y mover el lienzo arrastrándolo. La vista SHALL ofrecer un botón que
encuadra todo el grafo, y SHALL abrir encuadrada la primera vez. Hasta que el
usuario mueve o acerca el lienzo, y de nuevo después de encuadrar, la vista
SHALL mantener el grafo encuadrado a medida que crece.

#### Scenario: Zoom

- **WHEN** el usuario gira la rueda sobre un device
- **THEN** la vista se acerca o se aleja y el device queda bajo el puntero

#### Scenario: Arrastrar

- **WHEN** el usuario arrastra sobre el lienzo
- **THEN** el grafo se desplaza con el mouse

#### Scenario: Encuadrar

- **WHEN** el usuario hace clic en el botón de encuadrar
- **THEN** todo el grafo queda a la vista

#### Scenario: El grafo crece sin que el usuario haya tocado el lienzo

- **WHEN** aparece un device nuevo fuera de lo que se ve y el usuario no movió ni acercó el lienzo
- **THEN** la vista se reencuadra para mostrarlo

#### Scenario: El grafo crece después de un zoom

- **WHEN** el usuario acercó el lienzo y aparece un device nuevo
- **THEN** la vista no se mueve

#### Scenario: Volver a la vista

- **WHEN** el usuario pasa a otra pantalla y vuelve a "Visualización de datos"
- **THEN** el grafo está donde lo dejó, con el mismo zoom

### Requirement: Entramado elástico que se puede mover

Los elementos SHALL repelerse entre sí y quedar unidos a su padre de forma
elástica, de modo que el grafo se mantenga separado por sí solo. El usuario
SHALL poder agarrar con el mouse cualquier elemento, por su círculo o por sus
puntos, y arrastrarlo; mientras lo arrastra el elemento SHALL seguir al puntero
y el resto SHALL responder. Al soltarlo, el elemento vuelve a quedar sujeto a
las fuerzas y la estructura SHALL acomodarse de nuevo sin superponerse.

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

### Requirement: Halo luminoso

Cada punto y cada elemento en línea SHALL dibujarse con un halo de su color que
se desvanece hacia afuera, y la luz de los halos SHALL sumarse donde se
superponen. El brillo de una actualización y los pulsos SHALL ser más intensos
que el halo de reposo. Lo que está fuera de línea SHALL NOT tener halo.

#### Scenario: En reposo

- **WHEN** el grafo está quieto y sin tráfico
- **THEN** cada punto en línea se ve con un halo tenue alrededor

#### Scenario: Fuera de línea

- **WHEN** un device está fuera de línea
- **THEN** su círculo y sus puntos se ven grises y sin halo

### Requirement: El grafo sigue a los datos sin reacomodarse entero

La vista SHALL reflejar en el momento los nodos, devices y métricas que aparecen
o desaparecen, y los cambios en la configuración de la separación en niveles.
Los elementos que ya estaban SHALL conservar su lugar salvo el desplazamiento
necesario para hacer sitio a los nuevos; la vista SHALL NOT recalcular la
disposición desde cero.

#### Scenario: Rebirth de lo que ya estaba

- **WHEN** un nodo que ya está en el grafo vuelve a publicar su NBIRTH y los DBIRTH de sus devices, con las mismas métricas
- **THEN** ningún elemento ni punto cambia de lugar

#### Scenario: Device nuevo

- **WHEN** un nodo que ya está en el grafo publica el DBIRTH de un device nuevo
- **THEN** el device aparece junto a su nodo y el resto del grafo queda prácticamente donde estaba

#### Scenario: Métricas nuevas

- **WHEN** un rebirth declara más métricas para un device
- **THEN** el device muestra los puntos nuevos y los demás elementos se apartan lo necesario

#### Scenario: Cambio del separador

- **WHEN** el usuario cambia el carácter separador con la vista abierta
- **THEN** el grafo pasa a mostrar los niveles según la regla nueva

#### Scenario: Conexión borrada

- **WHEN** el usuario borra una conexión
- **THEN** su grafo desaparece del lienzo
