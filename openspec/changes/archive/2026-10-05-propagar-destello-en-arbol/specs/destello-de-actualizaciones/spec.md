# Spec Delta

## Purpose

Define cómo el árbol de datos señala con un destello las métricas que acaban de
recibir una actualización, de modo que la actividad se pueda seguir aunque la
fila de la métrica no esté a la vista por una rama colapsada o por el filtro del
buscador.

En este spec, "la lista" son las filas del árbol que resultan de lo que está
desplegado y del texto del buscador, estén o no dentro del área visible.

## ADDED Requirements

### Requirement: Destello del valor actualizado

Cuando una métrica o un miembro de un UDT recibe una actualización y su fila
está en la lista, el árbol SHALL resaltar el valor de esa fila con un destello
que se desvanece en 1,2 segundos. Una actualización es un valor que llega en un
mensaje DATA para una métrica que ya tenía un valor conocido.

#### Scenario: Métrica a la vista

- **WHEN** llega un DATA con un valor para una métrica cuya fila está en la lista
- **THEN** el valor de esa fila destella
- **AND** ninguna otra fila destella por esa actualización

#### Scenario: Miembro de un UDT desplegado

- **WHEN** llega un DATA que cambia un miembro de un UDT y la fila de ese miembro está en la lista
- **THEN** destella el valor de ese miembro
- **AND** no destellan los demás miembros ni la fila del UDT

#### Scenario: Actualizaciones seguidas de la misma métrica

- **WHEN** llega otra actualización de la misma métrica antes de que termine su destello
- **THEN** el destello vuelve a empezar

#### Scenario: Valor histórico

- **WHEN** llega un DATA con una métrica marcada como histórica
- **THEN** no destella ninguna fila por esa métrica

### Requirement: El primer valor no destella

El árbol SHALL NOT destellar por el primer valor que conoce de una métrica: ni
el que declara un BIRTH ni el de una métrica que aparece por primera vez en un
DATA. Después de un BIRTH, todas las métricas de ese nodo o device vuelven a
estar en su primer valor.

#### Scenario: BIRTH o rebirth

- **WHEN** llega un NBIRTH o un DBIRTH con las métricas de un nodo o device
- **THEN** no destella ninguna fila, esté la rama desplegada o colapsada

#### Scenario: Primer DATA después del BIRTH

- **WHEN** llega el primer DATA de una métrica después de su BIRTH
- **THEN** esa actualización destella según las reglas de este spec

### Requirement: Propagación a la fila visible más profunda

Cuando la fila de la métrica actualizada no está en la lista, el árbol SHALL
hacer destellar el nombre de la fila más profunda de su rama que sí esté en la
lista. Cada actualización SHALL hacer destellar exactamente una fila.

#### Scenario: Device colapsado

- **WHEN** un device está colapsado y llega una actualización de una de sus métricas
- **THEN** destella el nombre del device
- **AND** no destellan el nodo, el grupo ni la conexión

#### Scenario: Nodo colapsado

- **WHEN** un nodo está colapsado y llega una actualización de una métrica de uno de sus devices
- **THEN** destella el nombre del nodo

#### Scenario: Conexión colapsada

- **WHEN** una conexión está colapsada y llega una actualización de cualquier métrica de cualquiera de sus nodos
- **THEN** destella el nombre de la conexión

#### Scenario: Métricas propias del nodo colapsadas

- **WHEN** la fila `-` de un nodo está colapsada y llega una actualización de una métrica propia del nodo
- **THEN** destella el nombre de la fila `-`

#### Scenario: Rama intermedia de un id con dos puntos

- **WHEN** los devices `sala:tanque1` y `sala:tanque2` cuelgan de la rama `sala`, que está colapsada, y llega una actualización de una métrica de `sala:tanque2`
- **THEN** destella el nombre de la rama `sala`

#### Scenario: UDT colapsado

- **WHEN** la fila de un UDT está en la lista con el UDT colapsado, y llega un DATA que cambia uno de sus miembros
- **THEN** destella el nombre del UDT

#### Scenario: Lista larga que arranca colapsada

- **WHEN** un device con más de 60 métricas no fue desplegado por el usuario y llega una actualización de una de ellas
- **THEN** destella el nombre del device

#### Scenario: Se despliega la rama

- **WHEN** el usuario despliega un device que estaba colapsado
- **THEN** las actualizaciones siguientes destellan en el valor de cada métrica y no en el nombre del device

### Requirement: Aspecto del destello propagado

El destello propagado SHALL resaltar únicamente el nombre de la fila, con el
mismo color y la misma duración que el destello del valor de una métrica.

#### Scenario: Mismo lenguaje visual que el valor

- **WHEN** destella el nombre de un device colapsado
- **THEN** el resaltado tiene el mismo color y dura lo mismo que el de un valor
- **AND** el resto de la fila (estado, contadores, hora) no cambia

### Requirement: Actividad continua en una rama oculta

Cada actualización de una métrica que no está en la lista SHALL reiniciar el
destello de la fila que la representa. Una rama oculta con actualizaciones
frecuentes permanece resaltada mientras dura la actividad y se apaga 1,2
segundos después de la última.

#### Scenario: Varias métricas ocultas bajo la misma fila

- **WHEN** bajo un device colapsado se actualizan dos métricas distintas con menos de 1,2 segundos de diferencia
- **THEN** el nombre del device destella con la primera y el destello vuelve a empezar con la segunda

#### Scenario: Fin de la actividad

- **WHEN** pasan 1,2 segundos sin actualizaciones debajo de una fila colapsada
- **THEN** su nombre queda sin resaltar

### Requirement: El buscador no altera la regla

Con texto en el buscador, el árbol SHALL aplicar la misma regla sobre las filas
que el filtro deja en la lista: la actualización de una métrica que el filtro
oculta hace destellar el nombre de la fila más profunda de su rama que esté en
la lista.

#### Scenario: Métrica oculta por el filtro

- **WHEN** el buscador muestra el device `Bomba` solo como camino hacia la métrica `Temperature`, y llega una actualización de `Level`, que el filtro oculta
- **THEN** destella el nombre de `Bomba`

#### Scenario: Métrica que coincide con el filtro

- **WHEN** con ese mismo filtro llega una actualización de `Temperature`
- **THEN** destella el valor de `Temperature` y no el nombre de `Bomba`

#### Scenario: El filtro coincide con el device

- **WHEN** el texto buscado coincide con el nombre de un device, por lo que todas sus métricas quedan en la lista, y llega una actualización de una de ellas
- **THEN** destella el valor de esa métrica y no el nombre del device

### Requirement: El scroll no cuenta como oculto

Una fila que está en la lista SHALL contar como visible aunque quede fuera de
pantalla por el scroll: su actualización no hace destellar a ninguna fila
superior.

#### Scenario: Métrica desplegada fuera de pantalla

- **WHEN** una métrica está desplegada pero fuera del área visible por el scroll, y llega una actualización suya
- **THEN** no destella el nombre de su device, de su nodo, de su grupo ni de su conexión
