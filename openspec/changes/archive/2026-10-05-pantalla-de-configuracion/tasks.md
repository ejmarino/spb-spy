# Tasks

## 1. Configuración compartida y su dueño en el proceso principal

- [x] 1.1 En `src/shared/types.ts`, agregar `UpdateFrequency` y `AppSettings`, quitar `autoCheck` de `UpdateStatus`, y en `SpbApi` sumar `getSettings`, `setSettings` y `onSettings` y quitar `setAutoUpdateCheck` (design, decisiones 2 y 3). Verificar que `npm run typecheck` falla solo en los lugares que todavía usan lo retirado.
- [x] 1.2 Crear `src/shared/settings.ts` con `DEFAULT_SETTINGS`, los límites del máximo de eventos, `normalizeSettings` (incluida la migración de `autoUpdateCheck`), `validateMaxEvents`, `updateCheckDue` y `trimEvents` (design, decisiones 2, 4, 5 y 6). Verificar con un script fuera del repo: archivo vacío, basura y campos sueltos inválidos caen a los valores por defecto; `autoUpdateCheck` true/false migra a `daily`/`never` y `updateFrequency` gana si está; `updateCheckDue` en los bordes de 1, 7 y 30 días y con `never`; `validateMaxEvents` con 499, 500 y los dos bordes del tope, decimales y texto; `trimEvents` con y sin holgura.
- [x] 1.3 Crear `src/main/settings.ts` con `SettingsStore`: carga y guarda `settings.json`, aplica cambios parciales validados, mantiene `lastUpdateCheck` como estado interno, permite suscribirse, registra `settings:get` y `settings:set` y emite `settings:changed` a las ventanas (design, decisiones 1 y 3). Verificar en la app en desarrollo, desde la consola de DevTools, que `settings:set` con un valor válido reescribe `settings.json` en `userData` y que uno inválido rechaza sin tocar el archivo.
- [x] 1.4 En `src/preload/index.ts` (y `index.d.ts` si hace falta), exponer `getSettings`, `setSettings` y `onSettings` y quitar `setAutoUpdateCheck`. Verificar que `npm run typecheck:node` pasa para el preload.

## 2. Búsqueda de actualizaciones con periodicidad

- [x] 2.1 En `src/main/updater.ts`, recibir el `SettingsStore`, quitar la lectura y escritura propias del archivo, el canal `updates:set-auto-check` y `autoCheck` del estado, y decidir la búsqueda automática con `updateCheckDue` (design, decisiones 1 y 6). En `src/main/index.ts`, crear el `SettingsStore` y pasárselo. Verificar que `npm run typecheck:node` pasa y que la app arranca en desarrollo con el estado `unsupported` como antes.
- [x] 2.2 Verificar la migración contra el archivo real: con un `settings.json` de la versión anterior con `autoUpdateCheck: false`, arrancar la app y comprobar que `settings:get` devuelve `never`; repetir con `true` y con el archivo ausente (`daily`). Comprobar que después de un cambio el archivo queda sin `autoUpdateCheck` y conserva `lastUpdateCheck`.

## 3. Máximo de eventos configurable

- [x] 3.1 En `src/main/sparkplug/manager.ts`, quitar `MAX_EVENTS`, recibir el `SettingsStore`, recortar con `trimEvents` usando el máximo vigente y forzar el recorte cuando cambia la configuración (design, decisión 4). Verificar con un nodo simulado que, con el máximo en 500, `sparkplug:snapshot` nunca devuelve más de 600 eventos, y que al bajarlo de 10.000 a 500 con la lista llena el snapshot siguiente trae 500.
- [x] 3.2 En `src/renderer/src/store.ts`, quitar `MAX_EVENTS`, guardar `settings` (pedido al arrancar y actualizado con `onSettings`), agregar `setSettings`, quitar `setAutoUpdateCheck` y el `autoCheck` del estado inicial de `update`, y recortar con `trimEvents`, forzando el recorte al cambiar la configuración (design, decisión 4). Verificar que `npm run typecheck:web` falla solo en `About.tsx`, que se arregla en el grupo 4.

## 4. Interfaz

- [x] 4.1 En `electron.vite.config.ts`, definir `__APP_NAME__` con el `productName` de `package.json`, y declararlo en `src/renderer/src/env.d.ts` (design, decisión 7). Verificar que el renderer lo muestra con el valor "SpbSpy".
- [x] 4.2 Crear `src/renderer/src/views/Settings.tsx` con las secciones "Actualizaciones" (selector de periodicidad, mensaje de estado, botón "Buscar ahora" o las acciones de descarga e instalación, aviso de error) y "Eventos" (campo del máximo aplicado al salir o con Enter, con error de rango), moviendo `updateMessage` y `UpdateAction` desde `About.tsx` (design, decisión 8). Verificar en la app: el selector y el campo muestran los valores vigentes; 50 y 1,5 muestran el error y no cambian el máximo; tipear "15" sin confirmar no recorta la lista.
- [x] 4.3 En `src/renderer/src/views/About.tsx`, quitar la sección de actualizaciones y usar `__APP_NAME__` en el título ("Acerca de SpbSpy") y en la marca. Verificar en la app que la ventana muestra marca, versión, sitio y entorno, y ningún control de actualización.
- [x] 4.4 En `src/renderer/src/App.tsx`, reemplazar `aboutOpen` por el estado del modal abierto, agregar el ítem "Configuración" con el ícono de engranaje arriba de "Acerca de {nombre}", y hacer que el aviso de versión nueva abra la configuración (design, decisión 8). Verificar en la app el orden y los textos del pie del panel lateral y que cada ítem abre y cierra su ventana.
- [x] 4.5 En `src/renderer/src/assets/main.css`, renombrar las clases de la sección de actualizaciones a `settings-*` y dar estilo a las secciones y al campo del modal de configuración. Verificar con capturas que la ventana de configuración se ve alineada con "Acerca de" y el formulario de conexión, y que "Acerca de" no quedó con huecos.

## 5. Documentación

- [x] 5.1 Actualizar `README.md`: en "Pantalla de eventos", el máximo configurable con 10.000 por defecto; en "Actualizaciones", que las opciones están en "Configuración", la periodicidad (diaria, semanal, mensual de 30 días, nunca) y "Buscar ahora"; agregar la sección "Configuración" al índice con el rango del máximo y la advertencia de memoria. Verificar que el texto coincide con los specs y que `npx prettier --check README.md` pasa.

## 6. Verificación de conjunto

- [x] 6.1 Recorrer en la app, contra un nodo simulado, los escenarios de `specs/configuracion-de-la-app`, `specs/historial-de-eventos` y `specs/acerca-de`: persistencia tras reiniciar, cambio con conexiones activas sin perder el árbol, bajar y subir el máximo, lista en pausa, dos conexiones compartiendo el máximo. Dejar anotado cualquier escenario que no se cumpla.
- [x] 6.2 Medir con el máximo en el tope del rango (100.000 al planificar) y tráfico sostenido (incluidos BIRTHs grandes) la memoria de los dos procesos y la fluidez de la pantalla de eventos al filtrar y hacer scroll, y el tiempo de carga del snapshot al recargar la ventana. Si no es fluido, bajar el tope del rango en `src/shared/settings.ts`, el spec y el README, y volver a medir.
- [ ] 6.3 En un instalador de prueba con una versión publicada, recorrer los escenarios de `specs/busqueda-de-actualizaciones` que no se pueden ejercitar en desarrollo: "Buscar ahora" con la periodicidad en nunca, versión nueva con el aviso del panel lateral abriendo la configuración, descarga y reinicio. Si no hay release disponible para probar, dejarlo anotado como pendiente. **Pendiente:** en el devcontainer no hay una instalación de una versión publicada; la lógica de periodicidad se verificó con el script de funciones puras y la interfaz con la app sin empaquetar.
- [x] 6.4 Verificar que `npm run typecheck`, `npm run lint` y `npx prettier --check src README.md` terminan sin errores.
