# spb-spy

Visor de tráfico **Sparkplug B** sobre MQTT. Se conecta a uno o varios brokers, se
anuncia como Host Application, decodifica lo que publican los edge nodes y lo
muestra de dos maneras: como una lista de eventos en orden de llegada y como un
árbol con el último valor de cada métrica.

Está pensado para diagnosticar y desarrollar: ver qué publica un nodo, detectar
mensajes que no cumplen la norma, saltos de secuencia, alias sin resolver, y
seguir el estado (vivo o muerto) de nodos y devices.

Es una app de escritorio hecha con Electron, React y TypeScript.

## Contenido

- [Capacidades](#capacidades)
- [Conexiones](#conexiones)
- [Comportamiento como host Sparkplug](#comportamiento-como-host-sparkplug)
- [Pantalla de eventos](#pantalla-de-eventos)
- [Árbol de datos](#árbol-de-datos)
- [UDT (templates)](#udt-templates)
- [Tipos de datos](#tipos-de-datos)
- [Limitaciones](#limitaciones)
- [Desarrollo](#desarrollo)

## Capacidades

- Varias conexiones MQTT a la vez, cada una con su color.
- Decodificación completa de los payloads Sparkplug B, incluidos DataSets, UDT y
  los tipos de array de Sparkplug 3.0.
- Resolución de alias a partir de los BIRTH, pidiendo rebirth cuando hace falta
  o leyendo los BIRTH que guarda un broker Sparkplug Aware.
- Control de la secuencia (`seq`) de cada nodo y de su `bdSeq`.
- Detección de tópicos que tienen forma de Sparkplug pero no cumplen la norma.
- Registro de lo que publica la propia app (su `STATE` y los `NCMD` de rebirth).
- Lista de eventos con filtros por texto, conexión y tipo de mensaje.
- Árbol de datos en vivo, con el estado de cada nodo y device.

## Conexiones

La pantalla **Conexiones** tiene la lista de brokers. Cada conexión se conecta y
desconecta por separado, desde su tarjeta o desde la barra lateral, y todas las
que estén conectadas alimentan a la vez la lista de eventos y el árbol.

| Campo                  | Qué es                                                                                                    |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| Nombre y color         | Identifican la conexión en eventos y árbol. Sin nombre se usa el host.                                    |
| Host y puerto          | Dirección del broker. El puerto arranca en 1883, o 8883 al activar TLS.                                   |
| TLS                    | Conecta por `mqtts://`. "Verificar certificado" se puede desactivar para certificados autofirmados.       |
| Usuario y contraseña   | Opcionales.                                                                                               |
| Nombre de cliente      | Client ID de MQTT. Si la app se anuncia como host, también es su Host ID. No admite `/`, `+` ni `#`.      |
| Anunciarse como host   | Publica el `STATE` de la app. Activado por defecto; se desactiva para ser menos invasivo (ver más abajo). |
| Tópico a escuchar      | Filtro de suscripción. Por defecto `spBv1.0/#`.                                                           |
| Broker Sparkplug Aware | Suscribe además a `$sparkplug/certificates/…` para leer los BIRTH que guarda el broker.                   |
| Pedir rebirth          | Cuándo pedirle un rebirth a un nodo (ver más abajo).                                                      |
| Espera entre rebirths  | Segundos mínimos entre dos pedidos al mismo nodo. Por defecto 5; admite de 1 a 3600.                      |

Si el tópico no empieza con `spBv1.0/` la app lo acepta pero avisa, en el
formulario y en la tarjeta. Los mensajes que lleguen por tópicos sin la
estructura de Sparkplug se muestran sin decodificar.

Si se pierde la conexión con el broker, la app reintenta cada 5 segundos. Editar
una conexión que está en uso la reconecta con la configuración nueva y descarta
los datos que tenía en el árbol.

Las conexiones se guardan en `connections.json`, dentro de la carpeta de datos
del usuario (`~/.config/spb-spy` en Linux, `%APPDATA%\spb-spy` en Windows). La
contraseña se guarda cifrada cuando el sistema ofrece un almacén de credenciales.

## Comportamiento como host Sparkplug

**STATE.** Al conectar, la app registra como will `spBv1.0/STATE/<nombre de cliente>`
con `{"online": false}` y, una vez suscripta, publica `{"online": true}` (QoS 1,
retenido). Al desconectar voluntariamente publica el `offline` antes de cerrar.

**Sin anunciarse.** Con "Anunciarse como host" desactivado la app no registra el
will ni publica ningún `STATE`, así que no deja nada retenido en el broker. Los
nodos que esperan a un host primario no la van a ver. Todavía puede pedir
rebirth si la política lo permite; con el rebirth en "Nunca" la app **solo
escucha**: se suscribe y no publica nada.

**Alias.** Los alias se resuelven con las métricas declaradas en el NBIRTH o
DBIRTH del nodo o device. Mientras no hay BIRTH, la métrica aparece como
"alias N sin resolver".

**Rebirth.** Tras conectar, la app espera 5 segundos a que los nodos publiquen su
BIRTH por haber visto el `STATE` del host (la espera se mantiene aunque no se
anuncie). Pasado ese tiempo pide rebirth
(`NCMD` con `Node Control/Rebirth = true`) según la política elegida:

| Política                                                    | Pide rebirth cuando                                                                             |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Si falta el BIRTH o hay un salto de secuencia (por defecto) | Llega DATA de un nodo o device sin BIRTH, hay alias sin resolver, o el `seq` no es consecutivo. |
| Solo alias sin resolver                                     | Llega DATA con alias que no se pueden resolver.                                                 |
| Nunca                                                       | No pide rebirth.                                                                                |

Dos frenos evitan saturar a un nodo: nunca se envía más de un pedido al mismo
nodo dentro de la espera configurada, y si el nodo no contesta con su NBIRTH se
deja de insistir a los 3 intentos. También se puede pedir a mano con el botón
**Rebirth** de cada nodo en el árbol.

**Broker Sparkplug Aware.** Los BIRTH retenidos en `$sparkplug/certificates`
alcanzan para resolver alias sin pedir rebirth. Los nodos conocidos solo por su
certificado quedan en estado `STALE` hasta que llega un mensaje suyo en vivo.

**Secuencia.** Cada mensaje de un nodo o de sus devices debe traer el `seq`
siguiente al anterior, de 0 a 255. Si no coincide, el evento se marca
(`seq 142 ≠ 139`) y, con la política por defecto, se pide rebirth. Un NDEATH cuyo
`bdSeq` no coincide con el del NBIRTH se considera el will de una sesión vieja:
se muestra, pero no marca al nodo como muerto.

**Tópicos inválidos.** Un mensaje de device (`DBIRTH`, `DDATA`, `DDEATH`, `DCMD`)
sin el device en su propio nivel, o uno de nodo con un nivel de más, no se
acepta: no entra al árbol ni dispara rebirth por falta de BIRTH. Se muestra en
eventos marcado como `INVÁLIDO`, con el motivo en el detalle. El caso típico es
`spBv1.0/grupo/DDATA/nodo:device` en lugar de `…/nodo/device`. Su `seq` sí cuenta
para la secuencia del nodo (siempre que la app ya conozca ese nodo), de modo que
el mensaje válido siguiente no parezca un salto.

## Pantalla de eventos

Muestra los mensajes de todas las conexiones en orden de llegada, una fila por
métrica: hora, conexión, tipo, grupo, nodo, device, métrica y valor. Cada fila
lleva el color de su conexión.

- Los mensajes con más de 5 métricas se resumen en una fila que se puede abrir.
- Al hacer clic en una fila se abre el detalle: tópico, timestamps, `seq`,
  `bdSeq`, tamaño y todas las métricas con tipo, alias y propiedades.
- La lista sigue el final mientras llegan eventos. **Pausar**, o subir con el
  scroll, la congela; **Seguir en vivo** la reanuda e indica cuántos llegaron.
- Se conservan los últimos 5000 eventos, en memoria.

### Filtros

**Texto.** Busca en conexión, tipo, grupo, nodo, device, tópico, nombre de
métrica, valor y tipo de dato. Varias palabras separadas por espacios deben
coincidir todas. Al buscar, los mensajes resumidos se comparan métrica por
métrica. Tres palabras sirven de atajo: `inválido`, `enviado` y `salto`.

**Conexiones.** Un desplegable con la lista de conexiones para tildar. Tiene
"Todas", "Ninguna" y, por fila, "solo" para quedarse con una sola. A partir de 8
conexiones suma un buscador. El botón indica cuántas están a la vista.

**Píldoras por tipo.** Cada una muestra u oculta una categoría, y cada evento
pertenece a una sola:

| Píldora  | Contiene                                                                        |
| -------- | ------------------------------------------------------------------------------- |
| BIRTH    | NBIRTH y DBIRTH                                                                 |
| DEATH    | NDEATH y DDEATH                                                                 |
| DATA     | NDATA y DDATA                                                                   |
| CMD      | NCMD y DCMD publicados por otros hosts                                          |
| STATE    | STATE de los hosts, tal como los entrega el broker                              |
| SISTEMA  | Avisos de la app (conexión, rebirth solicitado) y mensajes que no son Sparkplug |
| ENVIADOS | Lo que publica esta app: su STATE y los NCMD de rebirth                         |

Apagando todas menos **ENVIADOS** queda solo lo que publicó la app.

### Marcas en las filas

| Marca                          | Significado                                                                                   |
| ------------------------------ | --------------------------------------------------------------------------------------------- |
| Icono de envío junto al tipo   | Mensaje publicado por esta app. El eco que devuelve el broker se descarta para no duplicarlo. |
| `cert`                         | BIRTH leído de los certificados de un broker Sparkplug Aware.                                 |
| `alias N`                      | El nombre no venía en el mensaje: se resolvió con el alias.                                   |
| `alias N sin resolver`         | Llegó solo el alias y todavía no hay BIRTH.                                                   |
| `INVÁLIDO` (fondo rayado rojo) | Tópico que no cumple con Sparkplug. No se aplicó a los datos.                                 |
| `seq X ≠ Y`                    | Salto de secuencia: llegó X y se esperaba Y.                                                  |
| `ignorado`                     | Mensaje válido que no se aplicó, por ejemplo un NDEATH con `bdSeq` viejo.                     |
| `histórico`                    | Métrica con `is_historical`: no actualiza el valor actual del árbol.                          |

## Árbol de datos

Tabla anidada con el último valor conocido de cada métrica:

```
conexión
└─ grupo
   └─ nodo
      ├─ -            métricas propias del nodo
      └─ device
         └─ métricas
```

- Los ids de grupo, nodo y device que contienen `:` se abren en ramas. Los
  devices `sala:tanque1` y `sala:tanque2` quedan los dos dentro de `sala`.
- Cada nivel tiene su icono y color (conexión, group, nodo, device, métrica,
  UDT), así una rama intermedia se reconoce como parte de un grupo, un nodo o un
  device.
- Columnas: nombre, valor o estado, tipo de dato y hora de la última
  actualización. La unidad se toma de la propiedad `engUnit`.
- Un valor que cambia se resalta un instante.
- El buscador filtra por nombre de grupo, nodo, device o métrica, y deja a la
  vista las coincidencias, sus ramas superiores y todo lo que cuelga de ellas.
- Las listas de más de 60 métricas arrancan colapsadas.

### Estado de nodos y devices

| Estado    | Cuándo                                                                                                                                                                  | Cómo se ve                                                                                                                               |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `ONLINE`  | Llegó un BIRTH o DATA en vivo.                                                                                                                                          | Etiqueta verde.                                                                                                                          |
| `OFFLINE` | Llegó su NDEATH o DDEATH. Un NDEATH apaga también los devices del nodo.                                                                                                 | Línea roja al costado, icono apagado con un punto rojo, etiqueta con la hora del DEATH y los valores en gris como último valor conocido. |
| `STALE`   | No hay confirmación en vivo: se cortó la conexión con el broker, el nodo solo se conoce por su certificado, o publicó un NBIRTH y el device todavía no mandó su DBIRTH. | Línea gris y valores atenuados.                                                                                                          |

Las ramas superiores muestran un contador `N offline`, para notar una caída
aunque la rama esté colapsada. Un nodo o device del que llegaron datos pero no
su BIRTH lleva la etiqueta `sin BIRTH`.

## UDT (templates)

Las métricas de tipo `Template` se muestran como una rama colapsable:

- La fila del UDT resume qué es: `UDT Motor · 4 miembros` para una instancia, o
  `Definición de UDT · 3 miembros` para una definición (las `_types_/…`).
- Debajo va una fila por parámetro del template, marcada como `parámetro`, y una
  por miembro, con su valor, unidad, tipo y hora.
- Un miembro que a su vez es un UDT se abre en su propia rama.
- Las instancias arrancan abiertas y las definiciones colapsadas.

Un DATA de un UDT trae solo los miembros que cambiaron. La app los combina con
los que ya conocía: los demás miembros se mantienen, cada uno con su propia hora,
y se resalta únicamente el que cambió.

En la pantalla de eventos un UDT ocupa una sola fila con el resumen; el contenido
completo se ve en el detalle.

## Tipos de datos

| Tipo                                      | Cómo se muestra                                                                                             |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Int8, Int16, Int32, Int64, UInt8 … UInt64 | Número. Los de 64 bits que no entran en un número de JavaScript se muestran como texto, sin perder dígitos. |
| Float, Double                             | Número; Float con 7 dígitos significativos.                                                                 |
| Boolean, String, Text, UUID               | Tal cual.                                                                                                   |
| DateTime                                  | Fecha y hora local con milisegundos.                                                                        |
| Bytes, File                               | Cantidad de bytes y los primeros en hexadecimal.                                                            |
| DataSet                                   | Resumen de columnas y filas; el contenido completo está en el detalle del evento.                           |
| Template                                  | Ver [UDT](#udt-templates).                                                                                  |
| Arrays de Sparkplug 3.0                   | Primeros elementos y cantidad total.                                                                        |

Si un mensaje DATA no trae el tipo de dato, se usa el declarado en el BIRTH.

## Limitaciones

- Como mucho publica su `STATE` y los `NCMD` de rebirth: no se pueden escribir
  métricas ni enviar otros comandos.
- Los eventos viven en memoria: se pierden al cerrar la app y no se exportan.
- Los nombres de métrica con `/` no se abren en carpetas.
- MQTT 3.1.1 sobre TCP o TLS. No hay WebSocket ni certificados de cliente.
- Sparkplug A (`spAv1.0`) no se decodifica.
- Los mensajes de tópico inválido no entran al árbol, aunque su contenido se
  pueda decodificar.

## Desarrollo

Requiere Node.js. El repositorio incluye un devcontainer con todo lo necesario
para correr Electron dentro del contenedor.

```bash
npm install
npm run dev        # app en modo desarrollo, con recarga en caliente del renderer
npm run typecheck
npm run lint
```

### Dentro del devcontainer

La ventana de la app no aparece en el escritorio del host sino en un escritorio
virtual al que se entra por el navegador: `http://localhost:6080`, contraseña
`noPassword`.

El contenedor define dos variables que hacen falta para que `npm run dev`
funcione ahí:

- `NO_SANDBOX=1`: el sandbox de Chromium no funciona en un contenedor sin
  privilegios.
- `CHOKIDAR_USEPOLLING=1`: con el proyecto montado desde Windows, Vite no recibe
  avisos de cambios de archivos y la recarga en caliente no funciona sin sondeo.

Los cambios en el proceso principal (`src/main`) requieren reiniciar la app.

### Empaquetado

```bash
npm run build:win
npm run build:linux
npm run build:mac
```

Estos scripts vienen de la plantilla de electron-vite y usan electron-builder.
Todavía no se probaron con este proyecto.

### Estructura

| Carpeta              | Contenido                                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------- |
| `src/shared`         | Tipos, parseo de tópicos, modelo de datos y combinación de UDT. Lo usan el proceso principal y el renderer. |
| `src/main`           | Proceso principal: ventana y guardado de conexiones.                                                        |
| `src/main/sparkplug` | Sesión MQTT (host, alias, secuencia, rebirth), decodificador de payloads y reparto de eventos a la ventana. |
| `src/preload`        | API que el renderer usa para hablar con el proceso principal.                                               |
| `src/renderer`       | Interfaz en React: conexiones, eventos y árbol de datos.                                                    |

El modelo de datos se arma aplicando los mismos eventos en los dos procesos: el
principal lo necesita para resolver alias y el renderer para dibujar el árbol.
