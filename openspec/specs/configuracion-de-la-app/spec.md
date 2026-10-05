# configuracion-de-la-app Specification

## Purpose

Define la ventana de configuración de la app: cómo se llega a ella, qué opciones
reúne y que lo que el usuario elige se conserva entre sesiones y rige sin
reiniciar.

## Requirements

### Requirement: Acceso a la configuración

El pie del panel lateral SHALL ofrecer un ítem "Configuración", con ícono de
engranaje, ubicado inmediatamente arriba del ítem "Acerca de …". Al elegirlo se
SHALL abrir la ventana de configuración, que se cierra con su botón de cerrar o
haciendo clic fuera de ella.

#### Scenario: Abrir desde el panel lateral

- **WHEN** el usuario hace clic en "Configuración"
- **THEN** se abre la ventana de configuración sobre la pantalla en la que estaba

#### Scenario: Cerrar

- **WHEN** el usuario hace clic en el botón de cerrar o fuera de la ventana
- **THEN** la ventana se cierra y la pantalla de atrás queda como estaba

### Requirement: Opciones de la configuración

La ventana de configuración SHALL reunir la sección de actualizaciones
(periodicidad de la búsqueda automática, estado de la búsqueda y sus acciones) y
la opción del máximo de eventos en memoria. Cada opción SHALL mostrar el valor
vigente al abrir la ventana.

#### Scenario: Valores vigentes al abrir

- **WHEN** el usuario abre la configuración
- **THEN** la periodicidad y el máximo de eventos muestran los valores en uso

#### Scenario: Primera vez

- **WHEN** el usuario abre la configuración sin haber cambiado nunca nada
- **THEN** la periodicidad muestra "Diaria" y el máximo de eventos muestra 10.000

### Requirement: Las opciones se conservan entre sesiones

Todo cambio de una opción SHALL guardarse en el momento, sin un botón de
guardar, y SHALL seguir vigente al volver a abrir la app.

#### Scenario: Reinicio de la app

- **WHEN** el usuario cambia la periodicidad a "Semanal" y el máximo de eventos a 20.000, cierra la app y la vuelve a abrir
- **THEN** la configuración muestra "Semanal" y 20.000

#### Scenario: Archivo de configuración ilegible

- **WHEN** el archivo de configuración no se puede leer o tiene valores que no son válidos
- **THEN** la app arranca igual y usa el valor por defecto de cada opción que no pudo leer

### Requirement: Las opciones rigen sin reiniciar

Un cambio de una opción SHALL aplicarse en el momento a la app en marcha, sin
reiniciarla ni reconectar las conexiones.

#### Scenario: Cambio con conexiones activas

- **WHEN** el usuario cambia una opción con conexiones conectadas
- **THEN** las conexiones siguen conectadas y el árbol de datos no pierde nada
- **AND** el valor nuevo rige desde ese momento
