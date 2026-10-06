# Spec Delta

## MODIFIED Requirements

### Requirement: Opciones de la configuración

La ventana de configuración SHALL reunir la sección de actualizaciones
(periodicidad de la búsqueda automática, estado de la búsqueda y sus acciones),
la opción del máximo de eventos en memoria y la sección del árbol de datos (una
casilla para separar los nombres en niveles y el carácter separador). Cada
opción SHALL mostrar el valor vigente al abrir la ventana. El campo del
carácter separador SHALL estar deshabilitado mientras la casilla esté apagada,
mostrando el separador guardado.

#### Scenario: Valores vigentes al abrir

- **WHEN** el usuario abre la configuración
- **THEN** la periodicidad, el máximo de eventos, la casilla de separar en niveles y el carácter separador muestran los valores en uso

#### Scenario: Primera vez

- **WHEN** el usuario abre la configuración sin haber cambiado nunca nada
- **THEN** la periodicidad muestra "Diaria" y el máximo de eventos muestra 10.000
- **AND** la casilla de separar en niveles está encendida y el carácter separador muestra `:`

#### Scenario: Separación deshabilitada

- **WHEN** el usuario apaga la casilla de separar en niveles con el separador en `.`
- **THEN** el campo del carácter separador queda deshabilitado y sigue mostrando `.`
