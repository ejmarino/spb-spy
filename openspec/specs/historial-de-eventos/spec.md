# historial-de-eventos Specification

## Purpose

Define cuántos eventos conserva la app en memoria para la pantalla de eventos y
qué pasa con los más viejos cuando se supera ese máximo o cuando el usuario lo
cambia.

## Requirements

### Requirement: Máximo de eventos en memoria

La app SHALL conservar en memoria solo los eventos más recientes, hasta un
máximo configurable. El máximo es uno solo para toda la app: cuenta juntos los
eventos de todas las conexiones. Al superarse, se SHALL descartar los más
viejos, sea cual sea su conexión. La app PUEDE retener transitoriamente hasta un
20 % por encima del máximo antes de recortar.

#### Scenario: Se supera el máximo

- **WHEN** el máximo es 10.000 y siguen llegando eventos
- **THEN** la lista de eventos nunca muestra más de 12.000
- **AND** los que se descartan son siempre los más viejos

#### Scenario: Varias conexiones

- **WHEN** hay dos conexiones activas y entre las dos superan el máximo
- **THEN** se descartan los eventos más viejos sin distinguir de qué conexión son

#### Scenario: El árbol de datos no depende del historial

- **WHEN** se descartan eventos viejos por haberse superado el máximo
- **THEN** el árbol de datos conserva los valores que esos eventos habían dejado

### Requirement: Valor por defecto del máximo

Cuando no hay un máximo configurado, la app SHALL conservar hasta 10.000
eventos.

#### Scenario: Instalación nueva

- **WHEN** la app arranca sin configuración guardada
- **THEN** el máximo de eventos es 10.000

#### Scenario: Configuración de una versión anterior

- **WHEN** la app arranca con una configuración guardada por una versión que no tenía esta opción
- **THEN** el máximo de eventos es 10.000

### Requirement: Cambio del máximo desde la configuración

La configuración SHALL permitir cambiar el máximo de eventos a un número entero
entre 500 y 50.000. El valor se SHALL aplicar al confirmar el campo (al salir
de él o con Enter), no con cada tecla. Un valor fuera de ese rango o que no es
un entero SHALL rechazarse con un mensaje que indique el rango, sin cambiar el
máximo vigente.

#### Scenario: Valor válido

- **WHEN** el usuario escribe 20000 y confirma
- **THEN** el máximo pasa a ser 20.000

#### Scenario: Valor fuera de rango

- **WHEN** el usuario escribe 50 y confirma
- **THEN** el campo muestra que el valor debe estar entre 500 y 50.000
- **AND** el máximo vigente no cambia

#### Scenario: Valor a medio escribir

- **WHEN** el usuario está escribiendo 15000 y lleva tipeado "15"
- **THEN** el máximo vigente no cambia ni se descarta ningún evento

### Requirement: El cambio del máximo se aplica en el momento

Al bajar el máximo, la app SHALL descartar en el momento los eventos más viejos
que excedan el nuevo valor. Al subirlo, SHALL empezar a conservar más eventos
desde ese momento; los ya descartados no vuelven.

#### Scenario: Bajar el máximo

- **WHEN** hay 9.000 eventos en la lista y el usuario baja el máximo a 2.000
- **THEN** la lista queda con los 2.000 eventos más recientes

#### Scenario: Subir el máximo

- **WHEN** hay 10.000 eventos en la lista y el usuario sube el máximo a 40.000
- **THEN** la lista conserva sus 10.000 eventos y sigue creciendo con los que llegan

#### Scenario: Lista en pausa

- **WHEN** la lista de eventos está en pausa y el usuario baja el máximo
- **THEN** lo que se ve en pausa no cambia hasta reanudar
