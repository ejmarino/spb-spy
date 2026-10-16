# busqueda-en-el-arbol Specification

## Purpose

Define cómo el buscador del árbol de datos interpreta el texto, qué filas deja
a la vista de cada coincidencia y cómo se recorre y se pliega el resultado.

## Requirements

### Requirement: Modos de coincidencia del texto

El buscador SHALL ofrecer dos modos para el texto: **contiene**, donde la fila
coincide si su nombre contiene todas las palabras del texto, y **regex**, donde
coincide si su nombre encaja con el texto como expresión regular. En los dos
modos SHALL compararse el nombre simple de la fila, sin su camino, y sin
distinguir mayúsculas de minúsculas. Una expresión inválida SHALL marcarse en
el cuadro, con el error a la vista, y SHALL dejar el árbol sin filtrar.

#### Scenario: Contiene con varias palabras

- **WHEN** el modo es contiene y el texto es `smer 23`
- **THEN** coinciden las filas cuyo nombre contiene `smer` y `23`, como `smer_2323`, y no `smer_2424`

#### Scenario: Regex anclada

- **WHEN** el modo es regex y el texto es `^d0[0-5]$`
- **THEN** coinciden los devices `d00` a `d05` y no `d06` ni `d012`

#### Scenario: El nombre es el tramo, no el camino

- **WHEN** el separador es `:`, el nodo `comunicacion:smer_2323` está en el árbol y el texto es `comunicacion`
- **THEN** coincide la rama `comunicacion` y no coincide `smer_2323`

#### Scenario: Mayúsculas

- **WHEN** el modo es regex y el texto es `SYS-CLI`
- **THEN** coincide la métrica `sys-cli`

#### Scenario: Regex inválida

- **WHEN** el modo es regex y el texto es `temp(`
- **THEN** el cuadro se marca como inválido con el error, y el árbol se muestra entero como si no hubiera texto

#### Scenario: Cambiar de modo con un texto simple

- **WHEN** el texto es `temp` y el usuario pasa de contiene a regex
- **THEN** quedan a la vista las mismas filas

### Requirement: Alcance de lo que se muestra de una coincidencia

El usuario SHALL poder elegir si el resultado muestra la herencia de cada
coincidencia. Con **herencia**, la vista SHALL mostrar cada coincidencia con
las filas que llevan hasta ella y con lo que cuelga de ella, la coincidencia
abierta y lo que cuelga según las reglas normales del árbol. Sin herencia, la
vista SHALL mostrar solo las líneas que coinciden, una debajo de otra en el
orden del árbol, sin sangría, sin chevrón y sin ninguna otra fila.

#### Scenario: Métrica repetida en varios devices

- **WHEN** no se muestra la herencia y el texto es `sys-cli`, que es una métrica de treinta devices
- **THEN** se ven treinta líneas `sys-cli`, una debajo de otra, con su valor, tipo y hora, y ninguna otra fila

#### Scenario: Nodo con herencia

- **WHEN** se muestra la herencia y el texto es `smer_2323`
- **THEN** el nodo se ve con su conexión, grupo y rama arriba, abierto, con sus devices y las métricas de cada uno

#### Scenario: Device encontrado sin herencia

- **WHEN** no se muestra la herencia y el texto es `d05`, un device con nueve métricas
- **THEN** se ve solo la línea `d05`, sin chevrón, sin sus métricas y sin su camino

#### Scenario: Lista larga bajo una coincidencia

- **WHEN** se muestra la herencia y la coincidencia es un device con más de 60 métricas
- **THEN** el device se ve abierto y su lista de métricas arranca colapsada, como en el árbol sin buscar

#### Scenario: Hermanas que no coinciden

- **WHEN** el texto es `d05` y el nodo tiene también `d06`
- **THEN** `d06` no se ve, con o sin herencia

### Requirement: El resultado se pliega como el árbol

Con texto en el buscador y la herencia a la vista, cada fila con hijos SHALL
conservar su chevrón y el usuario SHALL poder cerrarla y abrirla. El resultado
SHALL tener su propia memoria de lo abierto y lo cerrado: empieza abierto con
cada búsqueda, se conserva mientras el texto se refina y se descarta al borrar
el texto o al cambiar el alcance. Expandir todo y Colapsar todo SHALL actuar
sobre el resultado, y SHALL quedar deshabilitados sin herencia, donde no hay
nada que plegar.

#### Scenario: Cerrar una coincidencia abierta

- **WHEN** se muestra la herencia, el texto es `smer` y el usuario cierra `smer_2324`
- **THEN** `smer_2324` queda cerrada con su chevrón y `smer_2323` sigue abierta

#### Scenario: Sin herencia no hay nada que plegar

- **WHEN** no se muestra la herencia y el texto es `d05`
- **THEN** la línea `d05` no tiene chevrón y Expandir todo y Colapsar todo están deshabilitados

#### Scenario: Refinar el texto

- **WHEN** el usuario cerró `smer_2324` en el resultado de `smer` y agrega texto hasta `smer_2323`
- **THEN** `smer_2324` ya no está y `smer_2323` sigue como estaba

#### Scenario: Borrar el texto

- **WHEN** el usuario cerró `smer_2324` en un resultado y borra el texto
- **THEN** el árbol vuelve con lo abierto y lo cerrado que tenía antes de buscar

#### Scenario: Colapsar todo con una búsqueda

- **WHEN** hay texto en el buscador y el usuario aprieta Colapsar todo
- **THEN** quedan a la vista las conexiones, cerradas, y Expandir todo vuelve a abrir el resultado

#### Scenario: Coincidencia con actividad debajo

- **WHEN** una coincidencia está cerrada, o se muestra sin herencia, y una métrica que cuelga de ella se actualiza
- **THEN** el nombre de la coincidencia destella, como una rama colapsada del árbol

### Requirement: Opciones junto al cuadro

Las opciones de modo y de alcance SHALL estar al lado del cuadro de búsqueda,
como dos chips que se encienden y apagan y muestran su estado, y SHALL
recordarse mientras la app está abierta, también al pasar a otra pantalla y
volver.

#### Scenario: Ubicación y estado

- **WHEN** el usuario mira la barra del árbol de datos
- **THEN** junto al cuadro ve un chip "Regex" y un chip "Mostrar herencia", cada uno encendido o apagado

#### Scenario: Volver a la pantalla

- **WHEN** el usuario enciende Regex, pasa a otra pantalla y vuelve al árbol
- **THEN** Regex sigue encendido y el texto sigue en el cuadro
