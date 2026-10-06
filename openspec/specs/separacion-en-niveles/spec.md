# separacion-en-niveles Specification

## Purpose

Define cómo los ids de grupo, nodo y device se parten en niveles a partir de un
carácter separador configurable, de modo que los equipos nombrados con una
jerarquía dentro del id se muestren agrupados en ramas.

En este spec, "tramo" es cada parte de un id que queda entre dos separadores, y
"rama intermedia" es el nivel que corresponde a un tramo que no es el último.

## Requirements

### Requirement: Separación de los ids en niveles

Con la separación habilitada, el árbol de datos SHALL partir cada id de grupo,
de nodo y de device por el carácter separador configurado y mostrar un nivel por
tramo, en el orden en que aparecen en el id. Los nombres de las métricas y de
las conexiones SHALL NOT partirse.

#### Scenario: Device con dos tramos

- **WHEN** el separador es `:` y un nodo publica el device `sala:tanque1`
- **THEN** bajo el nodo aparece la rama `sala` y, dentro de ella, `tanque1`

#### Scenario: Grupo y nodo con tramos

- **WHEN** el separador es `:` y llega un nodo `linea1:plc` del grupo `planta:norte`
- **THEN** el árbol muestra `planta`, dentro `norte`, dentro `linea1` y dentro `plc`

#### Scenario: Id sin el separador

- **WHEN** el separador es `:` y un nodo publica el device `tanque1`
- **THEN** el device aparece como un solo nivel `tanque1`

#### Scenario: Métrica con el separador en el nombre

- **WHEN** el separador es `:` y un device tiene la métrica `motor:velocidad`
- **THEN** la métrica aparece como una sola fila `motor:velocidad`

### Requirement: Los ids con tramos en común comparten rama

Los ids del mismo tipo que cuelgan del mismo elemento y empiezan con los mismos
tramos SHALL compartir las ramas de esos tramos, en lugar de repetirlas.

#### Scenario: Dos devices bajo la misma rama

- **WHEN** un nodo publica los devices `sala:tanque1` y `sala:tanque2`
- **THEN** hay una sola rama `sala` con `tanque1` y `tanque2` dentro

#### Scenario: Un id es el comienzo de otro

- **WHEN** un nodo publica los devices `sala` y `sala:tanque1`
- **THEN** hay una sola fila `sala`, que muestra el estado y las métricas del device `sala` y además contiene a `tanque1`

### Requirement: Las ramas intermedias no son nodos ni devices

Una rama intermedia SHALL mostrarse con el ícono y el color del tipo de id del
que sale (grupo, nodo o device), pero SHALL NOT mostrar estado ni métricas
propias ni contar como nodo o device en los totales, salvo que exista un nodo o
device cuyo id termine en ese tramo.

#### Scenario: Rama intermedia de un device

- **WHEN** el único device de un nodo es `sala:tanque1`
- **THEN** la fila `sala` no muestra estado en línea ni fuera de línea
- **AND** el total de devices del nodo es 1

### Requirement: Los tramos vacíos se descartan

El árbol SHALL descartar los tramos vacíos que resultan de separadores
seguidos, al comienzo o al final del id. Un id formado solo por separadores
SHALL mostrarse entero, como un solo nivel.

#### Scenario: Separadores seguidos

- **WHEN** el separador es `:` y un nodo publica el device `sala::tanque1`
- **THEN** el árbol muestra `sala` y dentro `tanque1`, sin un nivel vacío entre los dos

#### Scenario: Separador al comienzo y al final

- **WHEN** el separador es `:` y un nodo publica el device `:tanque1:`
- **THEN** el device aparece como un solo nivel `tanque1`

#### Scenario: Id formado solo por separadores

- **WHEN** el separador es `:` y un nodo publica el device `::`
- **THEN** el device aparece como un solo nivel `::`

### Requirement: Separación deshabilitada

Con la separación deshabilitada, el árbol SHALL mostrar cada id de grupo, nodo y
device entero, como un solo nivel, sea cual sea el carácter separador
configurado.

#### Scenario: Ids con el separador y la separación deshabilitada

- **WHEN** la separación está deshabilitada y un nodo publica los devices `sala:tanque1` y `sala:tanque2`
- **THEN** bajo el nodo aparecen dos filas, `sala:tanque1` y `sala:tanque2`, y ninguna rama `sala`

### Requirement: Carácter separador válido

El separador SHALL ser exactamente un carácter. La app SHALL rechazar como
separador el valor vacío, más de un carácter, el espacio en blanco y los
caracteres `/`, `+` y `#`, e informar el motivo junto al campo. Un valor
rechazado SHALL NOT reemplazar al separador vigente.

#### Scenario: Separador válido

- **WHEN** el usuario escribe `.` como separador y lo confirma
- **THEN** el separador vigente pasa a ser `.`

#### Scenario: Carácter que Sparkplug no admite en un id

- **WHEN** el usuario escribe `/`, `+` o `#` como separador y lo confirma
- **THEN** el campo muestra un error y el separador vigente no cambia

#### Scenario: Más de un carácter

- **WHEN** el usuario escribe `::` como separador y lo confirma
- **THEN** el campo muestra un error y el separador vigente no cambia

#### Scenario: Vacío o espacio

- **WHEN** el usuario deja el campo vacío o con un espacio y lo confirma
- **THEN** el campo muestra un error y el separador vigente no cambia

### Requirement: El cambio rearma el árbol en el momento

Al habilitar o deshabilitar la separación, o al cambiar el separador, el árbol
de datos SHALL rearmarse en el momento con la regla nueva, sin perder nodos,
devices, métricas ni valores. Las ramas cuya forma no cambia SHALL conservar si
estaban abiertas o cerradas; las que cambian SHALL quedar en su estado por
defecto.

#### Scenario: Cambiar el separador con datos en el árbol

- **WHEN** el árbol muestra el device `sala.tanque1` como un solo nivel y el usuario cambia el separador de `:` a `.`
- **THEN** el árbol pasa a mostrar `sala` y dentro `tanque1`, con las mismas métricas y valores

#### Scenario: Deshabilitar la separación

- **WHEN** el árbol muestra `sala` con `tanque1` y `tanque2` dentro y el usuario deshabilita la separación
- **THEN** el árbol pasa a mostrar `sala:tanque1` y `sala:tanque2` como dos niveles enteros

#### Scenario: Ramas que no cambian

- **WHEN** el usuario cerró la rama del device `bomba`, de un grupo y un nodo sin `:` ni `.` en sus ids, y cambia el separador de `:` a `.`
- **THEN** la rama `bomba` sigue cerrada

#### Scenario: Volver a habilitar

- **WHEN** el usuario cambia el separador a `.`, deshabilita la separación y más tarde la vuelve a habilitar
- **THEN** el árbol separa por `.`
