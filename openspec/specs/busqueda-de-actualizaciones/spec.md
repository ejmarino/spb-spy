# busqueda-de-actualizaciones Specification

## Purpose

Define cómo la app se entera de que hay una versión nueva publicada: cada cuánto
la busca sola, cómo se la busca a mano, cómo avisa y cómo se descarga e instala,
siempre a pedido del usuario.

En este spec, "una copia que se actualiza" es la app instalada en una versión
publicada. En desarrollo y en las versiones intermedias no hay búsqueda.

## Requirements

### Requirement: Periodicidad de la búsqueda automática

La configuración SHALL permitir elegir cada cuánto se buscan actualizaciones
automáticamente: diaria (1 día), semanal (7 días), mensual (30 días) o nunca. El
intervalo se SHALL contar desde la última búsqueda, sea manual o automática. Sin
nada configurado la periodicidad SHALL ser diaria.

#### Scenario: Periodicidad semanal sin cumplirse

- **WHEN** la periodicidad es semanal y la última búsqueda fue hace 3 días
- **THEN** no se lanza una búsqueda automática

#### Scenario: Periodicidad semanal cumplida

- **WHEN** la periodicidad es semanal y la última búsqueda fue hace 7 días o más
- **THEN** se lanza una búsqueda automática dentro de la hora siguiente

#### Scenario: Periodicidad mensual

- **WHEN** la periodicidad es mensual y la última búsqueda fue hace 29 días
- **THEN** no se lanza una búsqueda automática

#### Scenario: Nunca

- **WHEN** la periodicidad es nunca
- **THEN** no se lanza ninguna búsqueda automática, pase el tiempo que pase

#### Scenario: Una búsqueda manual reinicia la cuenta

- **WHEN** la periodicidad es diaria y el usuario busca a mano
- **THEN** la próxima búsqueda automática no ocurre antes de un día después de esa búsqueda

#### Scenario: Cambio de periodicidad

- **WHEN** el usuario pasa de "Nunca" a "Diaria" y la última búsqueda fue hace más de un día
- **THEN** se lanza una búsqueda automática dentro de la hora siguiente, sin reiniciar la app

### Requirement: Búsqueda automática al arrancar

Cuando al arrancar la app ya se cumplió el intervalo de la periodicidad elegida,
la búsqueda automática SHALL lanzarse poco después del arranque. Una búsqueda
automática que falla SHALL pasar inadvertida para el usuario.

#### Scenario: Arranque con el intervalo cumplido

- **WHEN** la app arranca, la periodicidad es diaria y la última búsqueda fue hace más de un día
- **THEN** se lanza una búsqueda a los pocos segundos de arrancar

#### Scenario: Búsqueda automática sin red

- **WHEN** una búsqueda automática falla
- **THEN** no se muestra ningún error ni aviso

### Requirement: Migración de la opción anterior

Una instalación que ya tenía guardada la opción "Buscar actualizaciones
automáticamente" SHALL conservar su elección al pasar a la periodicidad:
activada equivale a diaria y apagada equivale a nunca.

#### Scenario: Tenía la búsqueda automática activada

- **WHEN** la app arranca con una configuración guardada por una versión anterior que tenía la búsqueda automática activada
- **THEN** la periodicidad es diaria

#### Scenario: Tenía la búsqueda automática apagada

- **WHEN** la app arranca con una configuración guardada por una versión anterior que tenía la búsqueda automática apagada
- **THEN** la periodicidad es nunca y no se busca sola

### Requirement: Búsqueda manual

La sección de actualizaciones de la configuración SHALL ofrecer, junto a la
periodicidad, un botón para buscar en el momento, y SHALL mostrar en qué anda la
búsqueda: buscando, al día, versión nueva disponible, avance de la descarga,
lista para instalar o el motivo del error. La búsqueda manual SHALL estar
disponible con cualquier periodicidad, también con "Nunca".

#### Scenario: Buscar con todo al día

- **WHEN** el usuario pulsa el botón de buscar y no hay una versión más nueva
- **THEN** la sección indica que tiene la última versión

#### Scenario: Buscar con la periodicidad en nunca

- **WHEN** la periodicidad es nunca y el usuario pulsa el botón de buscar
- **THEN** la búsqueda se hace igual

#### Scenario: Búsqueda manual que falla

- **WHEN** una búsqueda pedida por el usuario falla
- **THEN** la sección muestra el motivo del error

#### Scenario: Copia que no se actualiza

- **WHEN** la app corre en desarrollo o en una versión intermedia
- **THEN** el botón de buscar está deshabilitado y la sección explica que solo está disponible en las versiones publicadas de la app instalada

### Requirement: Descarga e instalación a pedido

Cuando hay una versión nueva, la sección de actualizaciones SHALL ofrecer
descargarla e instalarla, y una vez descargada, reiniciar para instalarla. Nada
SHALL descargarse ni instalarse sin que el usuario lo pida.

#### Scenario: Versión nueva encontrada

- **WHEN** una búsqueda encuentra una versión nueva
- **THEN** la sección muestra su número y un botón para descargarla e instalarla
- **AND** la descarga no empieza sola

#### Scenario: Descarga terminada

- **WHEN** termina la descarga de la versión nueva
- **THEN** la sección ofrece reiniciar la app para instalarla

### Requirement: Aviso de versión nueva en el panel lateral

Mientras haya una versión nueva disponible, descargándose o lista para instalar,
el pie del panel lateral SHALL mostrar un aviso. Al hacer clic en el aviso se
SHALL abrir la ventana de configuración.

#### Scenario: Clic en el aviso

- **WHEN** hay una versión nueva disponible y el usuario hace clic en el aviso del panel lateral
- **THEN** se abre la ventana de configuración, con la sección de actualizaciones ofreciendo descargarla

#### Scenario: Sin novedades

- **WHEN** no hay una versión nueva
- **THEN** el panel lateral no muestra el aviso
