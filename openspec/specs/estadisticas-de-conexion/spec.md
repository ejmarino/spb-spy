# estadisticas-de-conexion Specification

## Purpose

Define las estadísticas de caudal que la app muestra para cada conexión en el
panel lateral, de modo que el usuario vea cuánto tráfico recibe de cada broker
y note si una conexión lo está desbordando.

## Requirements

### Requirement: Caudal de cada conexión en el panel lateral

El panel lateral SHALL mostrar, debajo del nombre de cada conexión que está
conectada, su caudal: mensajes por segundo, métricas por segundo y kB por
segundo. Una conexión que no está conectada SHALL NOT mostrar caudal.

#### Scenario: Conexión conectada con tráfico

- **WHEN** una conexión está conectada y recibe mensajes
- **THEN** debajo de su nombre se ven sus mensajes por segundo, sus métricas por segundo y sus kB por segundo

#### Scenario: Conexión conectada sin tráfico

- **WHEN** una conexión está conectada y no recibe mensajes
- **THEN** su caudal se muestra en cero

#### Scenario: Conexión desconectada o reintentando

- **WHEN** una conexión está desconectada, conectando o reintentando
- **THEN** debajo de su nombre no se muestra caudal

#### Scenario: Varias conexiones

- **WHEN** hay dos conexiones conectadas y solo una recibe mensajes
- **THEN** cada una muestra su propio caudal y el de la otra queda en cero

### Requirement: Promedio y refresco del caudal

Cada valor del caudal SHALL ser el promedio por segundo de los últimos 5
segundos y SHALL refrescarse una vez por segundo.

#### Scenario: Caudal constante

- **WHEN** una conexión recibe 20 mensajes por segundo de forma sostenida
- **THEN** su caudal muestra 20 mensajes por segundo

#### Scenario: Mensajes espaciados

- **WHEN** una conexión recibe un mensaje cada 5 segundos
- **THEN** su caudal muestra 0,2 mensajes por segundo en lugar de alternar entre 0 y 1

#### Scenario: Se corta el tráfico

- **WHEN** una conexión deja de recibir mensajes
- **THEN** su caudal llega a cero a los 5 segundos

### Requirement: Qué cuenta como tráfico recibido

El caudal SHALL contar todo mensaje que el broker entrega a la conexión, sea o
no Sparkplug y esté o no retenido. Los mensajes que publica la propia app y su
eco SHALL NOT contarse. Las métricas son las que traen los mensajes Sparkplug
decodificados; los kB son el tamaño de los payloads.

#### Scenario: Mensaje con muchas métricas

- **WHEN** llega un único DDATA con 500 métricas
- **THEN** cuenta como 1 mensaje y como 500 métricas

#### Scenario: Métrica UDT

- **WHEN** llega un DATA con una métrica UDT de 10 miembros
- **THEN** cuenta como 1 métrica

#### Scenario: Mensaje que no es Sparkplug

- **WHEN** llega un mensaje cuyo tópico no es Sparkplug
- **THEN** cuenta como mensaje y suma sus bytes, y no suma métricas

#### Scenario: Comando enviado por la app

- **WHEN** la app publica un comando o un pedido de rebirth y el broker se lo devuelve por la suscripción
- **THEN** el caudal de la conexión no cambia por ese mensaje

### Requirement: Saltos de secuencia de la conexión

Cuando una conexión detectó saltos de secuencia desde que el usuario la
conectó, el panel lateral SHALL mostrar junto a su caudal cuántos fueron, con
aspecto de advertencia. Sin saltos, SHALL NOT mostrarse nada. La cuenta SHALL
volver a cero cuando el usuario vuelve a conectar la conexión.

#### Scenario: Sin saltos

- **WHEN** una conexión no detectó ningún salto de secuencia
- **THEN** su caudal no muestra ninguna cuenta de saltos

#### Scenario: Con saltos

- **WHEN** una conexión detectó 3 saltos de secuencia
- **THEN** junto a su caudal se lee que hubo 3 saltos, resaltado como advertencia

#### Scenario: Reconexión automática

- **WHEN** una conexión con saltos pierde el enlace y se reconecta sola
- **THEN** la cuenta de saltos se conserva

#### Scenario: El usuario vuelve a conectar

- **WHEN** el usuario desconecta y vuelve a conectar una conexión que tenía saltos
- **THEN** la cuenta de saltos arranca en cero

### Requirement: Formato compacto del caudal

El caudal SHALL entrar en el ancho del panel lateral sin cortar ningún valor:
los mensajes y las métricas de mil o más SHALL abreviarse con el sufijo `k` y
un decimal, el tamaño SHALL pasar de kB a MB a partir de 1.000 kB, y los
valores menores que 10 que no sean enteros SHALL mostrarse con un decimal. Al
pasar el puntero se SHALL ver la descripción completa de cada valor.

#### Scenario: Valor grande

- **WHEN** una conexión recibe 3.420 métricas por segundo
- **THEN** el caudal muestra `3,4k`

#### Scenario: Tamaño grande

- **WHEN** una conexión recibe 2.500 kB por segundo
- **THEN** el caudal muestra `2,5 MB/s`

#### Scenario: Valor chico

- **WHEN** una conexión recibe 0,2 mensajes por segundo
- **THEN** el caudal muestra `0,2`

#### Scenario: Descripción al pasar el puntero

- **WHEN** el usuario pasa el puntero sobre el caudal de una conexión
- **THEN** se lee qué es cada valor y que es el promedio de los últimos 5 segundos
