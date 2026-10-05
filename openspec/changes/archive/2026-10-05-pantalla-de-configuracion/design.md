# Design

## Context

Motivación y alcance: ver proposal.md.

Estado actual que condiciona el diseño:

- `src/main/updater.ts` es dueño de `settings.json` (en `userData`): lo lee, lo
  guarda y define su forma (`autoUpdateCheck`, `lastUpdateCheck`). Nadie más lo
  usa.
- El máximo de eventos es la constante `MAX_EVENTS = 5_000`, repetida en
  `src/main/sparkplug/manager.ts` y en `src/renderer/src/store.ts`. Cada proceso
  guarda su propia lista y la recorta por su cuenta cuando pasa de `MAX × 1,2`.
- La periodicidad está fija: `autoCheck()` corre a los 10 s del arranque y
  después cada hora, y busca si pasó `DAY_MS` desde `lastUpdateCheck`.
- `UpdateStatus` lleva `autoCheck` mezclado con el estado de la búsqueda, y el
  renderer lo cambia con `updates:set-auto-check`.
- `About.tsx` contiene la marca escrita a mano ("SpbSpy") y toda la sección de
  actualizaciones. `App.tsx` abre ese modal con un booleano `aboutOpen`.
- El renderer ya recibe `__APP_VERSION__` por `define` de Vite.
- El proyecto no tiene tests automatizados; se verifica con `typecheck`, `lint`,
  scripts sueltos sobre funciones puras y la app en marcha.
- En desarrollo el updater queda en `unsupported`: la búsqueda real no se puede
  ejercitar sin una versión instalada y publicada.

## Goals / Non-Goals

**Goals:**

- Un único dueño de `settings.json`, que sirva al updater y al manager de
  eventos y admita más opciones sin tocar a los demás.
- Que la lógica que no se puede probar en la app en desarrollo (cuándo toca
  buscar, migración, validación) quede en funciones puras verificables aparte.
- Que el máximo de eventos se mantenga igual en los dos procesos.

**Non-Goals:**

- Límite de eventos por conexión.
- Presupuesto de memoria en bytes o por cantidad de métricas.
- Rediseñar los modales o el panel lateral más allá de lo pedido.
- Sincronizar la configuración entre varias ventanas más allá de avisar el
  cambio (la app tiene una sola).

## Decisions

### 1. Módulo de configuración en el proceso principal

`src/main/settings.ts` exporta una clase `SettingsStore` que carga
`settings.json` al construirse, expone la configuración vigente, aplica cambios
parciales (validar, guardar, avisar) y permite suscribirse a los cambios.
Registra el IPC y avisa a las ventanas. `index.ts` crea una instancia y se la
pasa al `Updater` y al `SparkplugManager`, igual que hoy le pasa el
`ConnectionStore` al manager.

`lastUpdateCheck` sigue en el mismo archivo pero es estado interno del updater,
no una opción: el `SettingsStore` lo guarda y lo expone solo al proceso
principal, y no viaja al renderer.

Alternativa descartada: dejar la configuración en el `Updater` y que el manager
se la pida. Ata el máximo de eventos a un módulo que no tiene que ver y obliga a
repetirlo con cada opción nueva.

### 2. Forma de la configuración y lógica pura en `src/shared`

En `src/shared/types.ts`:

```ts
export type UpdateFrequency = 'daily' | 'weekly' | 'monthly' | 'never'

export interface AppSettings {
  updateFrequency: UpdateFrequency
  maxEvents: number
}
```

En un módulo nuevo `src/shared/settings.ts`, sin dependencias de Electron:

- `DEFAULT_SETTINGS` (`daily`, `10_000`), `MIN_MAX_EVENTS = 500`,
  `MAX_MAX_EVENTS = 50_000`.
- `normalizeSettings(raw)`: de lo leído del archivo a un `AppSettings` válido.
  Cada campo inválido o ausente cae a su valor por defecto por separado. Acá
  vive la migración (decisión 5).
- `validateMaxEvents(value)`: devuelve el mensaje de error o nada. Lo usan el
  campo del renderer y el proceso principal, como ya se hace con
  `validateConnection` en `src/shared/connection.ts`.
- `updateCheckDue(frequency, lastCheck, now)`: `false` si es `never`; si no,
  `now - lastCheck >= intervalo`, con 1, 7 y 30 días.
- `trimEvents(events, max, force)`: la regla de recorte (decisión 4).

Así la periodicidad y la migración se verifican con un script, sin depender de
una app instalada.

### 3. IPC

| Canal              | Sentido         | Contenido                                 |
| ------------------ | --------------- | ----------------------------------------- |
| `settings:get`     | renderer → main | devuelve `AppSettings`                    |
| `settings:set`     | renderer → main | recibe un parcial, devuelve `AppSettings` |
| `settings:changed` | main → renderer | `AppSettings` después de cada cambio      |

`settings:set` valida en el proceso principal y rechaza (throw) un valor
inválido, como `connections:save`. Se retira `updates:set-auto-check` y
`UpdateStatus` pierde `autoCheck`: el estado de la búsqueda y la configuración
dejan de viajar juntos. `SpbApi` y el preload suman `getSettings`,
`setSettings` y `onSettings`, y pierden `setAutoUpdateCheck`.

Alternativa descartada: meter la configuración en el `Snapshot`. El snapshot es
de datos Sparkplug y se pide una vez; la configuración cambia y tiene su propio
aviso.

### 4. Recorte de eventos con máximo variable

Cada proceso sigue recortando su propia lista con la regla de hoy, pero leyendo
el máximo de la configuración: al agregar eventos, si la lista pasa de
`max × 1,2`, queda en los últimos `max`. Se agrega el recorte forzado: cuando
llega un cambio de configuración, si la lista tiene más de `max`, queda en los
últimos `max` en el momento (sin la holgura). La regla es una sola función en
`src/shared/settings.ts` que usan los dos.

- En el manager, suscrito al `SettingsStore`.
- En el store del renderer, que guarda `settings` (pedido al arrancar y
  actualizado con `settings:changed`) y notifica a los componentes.

El renderer arranca con `DEFAULT_SETTINGS` hasta que llega la respuesta de
`settings:get`. Si el snapshot trae más eventos que el máximo real, se recorta
al conocerlo; no se pierde nada que el proceso principal conserve.

La pausa de la pantalla de eventos trabaja sobre una copia (`frozen`), así que
el recorte no la toca hasta reanudar.

Alternativa descartada: una sola lista en el proceso principal y que el renderer
la pida. Cambia el flujo de lotes por IPC, que no es parte de este cambio.

### 5. Migración de `autoUpdateCheck`

`normalizeSettings` resuelve la periodicidad así: si el archivo trae
`updateFrequency` válido, se usa; si no, y trae `autoUpdateCheck === false`,
es `never`; en cualquier otro caso, `daily`. El archivo se reescribe con la
forma nueva (sin `autoUpdateCheck`) la primera vez que se guarda algo, lo que
ocurre a más tardar en la primera búsqueda.

Volver a una versión anterior de la app: no encuentra `autoUpdateCheck` y usa su
valor por defecto (activada, diaria). Quien había elegido "Nunca" vuelve a tener
búsqueda diaria. Se acepta: es una vuelta atrás manual y la búsqueda no descarga
nada sola.

### 6. Periodicidad sobre el reloj que ya existe

Se conservan la espera de 10 s al arrancar y la revisión cada hora. Solo cambia
la condición: `updateCheckDue(settings.updateFrequency, lastUpdateCheck, now)`
en lugar de comparar con `DAY_MS`. Un cambio de periodicidad no dispara una
búsqueda en el acto: la toma la revisión siguiente, a lo sumo una hora después.

"Mensual" son 30 días fijos desde la última búsqueda, no "el mismo día del mes":
el resto de la lógica ya trabaja con intervalos desde `lastUpdateCheck`.

Alternativa descartada: evaluar en el momento del cambio. Buscar apenas se toca
un selector sorprende, y para buscar ya está el botón al lado.

### 7. Nombre del producto por `define`

`electron.vite.config.ts` agrega `__APP_NAME__` con el `productName` de
`package.json`, junto a `__APP_VERSION__`, y `env.d.ts` lo declara. Lo usan el
ítem del panel lateral, el título del modal y la marca de "Acerca de".

Alternativa descartada: `app.getName()` por IPC. Suma un canal y una espera para
un texto que se conoce al construir.

### 8. Interfaz

- `App.tsx`: el booleano `aboutOpen` pasa a un estado `modal: 'about' |
'settings' | null`. En el pie del panel lateral, de arriba hacia abajo: aviso
  de versión nueva (si hay), "Configuración" (ícono `Settings` de lucide-react,
  el engranaje) y "Acerca de {nombre}". El aviso abre `settings`.
- `views/Settings.tsx`: modal nuevo con el mismo armazón que `About`
  (`modal-backdrop`, `modal`, `modal-header`, `modal-body`) y dos secciones con
  título:
  - **Actualizaciones**: selector de periodicidad (`Field` + `select`), y debajo
    la fila de mensaje de estado y botón de acción y el aviso de error. Se mudan
    tal cual `updateMessage` y `UpdateAction` desde `About.tsx`; el botón de
    buscar pasa a decir "Buscar ahora".
  - **Eventos**: campo numérico "Máximo de eventos en memoria" (`Field` con
    `hint` y `error`), con el texto tipeado en estado local y aplicado al salir
    del campo o con Enter. Con un valor inválido se muestra el error y no se
    llama a `setSettings`.
- El selector de periodicidad se aplica al cambiar. Queda habilitado aunque la
  copia no se actualice (`unsupported`), como hoy la casilla.
- `About.tsx` pierde la sección de actualizaciones y sus imports.
- `main.css`: las clases `about-updates`, `about-update-row` y
  `about-update-message` se renombran a `settings-*` y se agrega el estilo de
  sección del modal de configuración.

El campo se aplica al confirmar y no con cada tecla porque pasar por "1" o "15"
camino a "15000" recortaría el historial sin vuelta atrás.

## Risks / Trade-offs

- [El nuevo valor por defecto duplica la memoria de la lista de eventos en los
  dos procesos, y con el tope del rango crece en proporción] → el `hint` del
  campo avisa que más eventos es más memoria; el README lo explica. El límite
  sigue contando eventos, no bytes.
- [Con listas grandes, el filtrado de la pantalla de eventos recorre todo con
  cada lote] → el tope del rango quedó en 50.000 y no en los 100.000 pensados
  al principio. Medido con 500 mensajes por segundo de 3 métricas y un BIRTH de
  500 cada 2.000 mensajes: con 100.000 la lista filtrada en vivo cae a unos 7
  cuadros por segundo y el renderer acumula atraso (18 s para volver a
  responder); con 50.000 se mantiene en unos 35 cuadros por segundo y con
  25.000 no se nota. La recarga de la ventana tarda 3 s, 1,5 s y 0,7 s. El heap
  con 50.000 fue de unos 50 MB en el principal y 230 MB en el renderer.
- [El máximo queda desfasado entre procesos un instante después de un cambio] →
  el cambio se aplica en el principal y se avisa en la misma llamada; el
  desfase es de un mensaje de IPC y solo afecta cuántos eventos viejos se ven.
- [La periodicidad no se puede probar de punta a punta en desarrollo] → la
  condición es una función pura verificada con un script; la búsqueda real se
  prueba en el instalador, como se hizo al agregar las actualizaciones.
- [Bajar el máximo descarta eventos sin confirmación] → es lo que pide la
  opción y el `hint` lo dice; el árbol de datos no se ve afectado.

## Migration Plan

- No hay pasos manuales. La configuración vieja se migra al leerla (decisión 5).
- Vuelta atrás: reinstalar la versión anterior. El archivo nuevo se lee sin
  error; se pierde la elección de "Nunca" (decisión 5) y el máximo vuelve a ser
  el fijo de esa versión.
