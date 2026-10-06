# Tasks

## 1. Opciones en la configuración compartida

- [x] 1.1 En `src/shared/types.ts`, agregar `splitLevels` y `levelSeparator` a `AppSettings` (design, decisión 1). Verificar que `npm run typecheck` falla solo en los lugares que arman un `AppSettings` completo (`DEFAULT_SETTINGS`, `normalizeSettings`, `SettingsStore.set`).
- [x] 1.2 En `src/shared/settings.ts`, sumar los valores por defecto (`true` y `':'`), `validateLevelSeparator`, su uso y el control de `splitLevels` en `validateSettings`, y los dos campos en `normalizeSettings` (design, decisión 2). Verificar con un script fuera del repo: `.`, `_`, `-` y un carácter fuera del plano básico son válidos; vacío, `::`, espacio, tabulación, `/`, `+`, `#` y un número se rechazan; un `settings.json` sin los campos, o con valores inválidos en ellos, normaliza a `true` y `':'` sin alterar la periodicidad ni el máximo de eventos.
- [x] 1.3 En `src/main/settings.ts`, incluir los dos campos al aplicar un cambio en `set()`. Verificar en la app en desarrollo, desde la consola de DevTools, que `window.api.setSettings({ levelSeparator: '.' })` reescribe `settings.json` conservando el resto, y que `'/'` y `'ab'` rechazan sin tocar el archivo.

## 2. Separación configurable en el árbol

- [x] 2.1 En `src/renderer/src/tree.ts`, quitar `SEGMENT_SEPARATOR`, hacer que `segments` reciba el separador (o `null` para no partir) y que `buildTree` lo reciba como tercer argumento y lo lleve hasta `Builder.path` (design, decisión 3). Verificar con un script fuera del repo sobre un modelo armado a mano los escenarios de `specs/separacion-en-niveles`: dos tramos, grupo y nodo con tramos, ramas compartidas, un id que es comienzo de otro, tramos vacíos, id formado solo por separadores, métrica con el separador en el nombre, otro separador y `null`; y que los totales de nodos y devices no cuentan las ramas intermedias.
- [x] 2.2 En `src/renderer/src/views/TreeView.tsx`, pasar a `buildTree` el separador según `store.settings` y sumar los dos valores a las dependencias del `useMemo` (design, decisiones 3 y 4). Verificar en la app, contra un nodo simulado con devices `sala:tanque1`, `sala:tanque2`, `sala.tanque3` y `bomba`, cambiando la configuración desde la consola: el árbol se rearma en el momento sin reconectar ni perder valores; la rama `bomba` cerrada a mano sigue cerrada; y con una métrica de `sala:tanque1` elegida, el panel de comandos se cierra al deshabilitar la separación.

## 3. Interfaz de la configuración

- [x] 3.1 En `src/renderer/src/views/Settings.tsx`, agregar la sección "Árbol de datos" debajo de "Eventos" con el `Toggle` "Separar los nombres en niveles" y el campo del carácter separador, que se aplica al salir o con Enter, muestra el error de `validateLevelSeparator` y queda deshabilitado con la casilla apagada (design, decisión 5); ajustar `assets/main.css` solo si el campo lo necesita. Verificar en la app los escenarios de "Carácter separador válido" y de `specs/configuracion-de-la-app`: valores vigentes al abrir, `:` y casilla encendida la primera vez, error con `/`, `::`, vacío y espacio sin cambiar el árbol, y el campo deshabilitado mostrando el separador guardado.
- [x] 3.2 Actualizar `README.md`: en "Árbol de datos", que la separación usa el carácter configurado y se puede deshabilitar; en "Configuración", las dos opciones con sus valores por defecto, los caracteres que se rechazan, que los tramos vacíos se descartan y la advertencia sobre separadores muy comunes como `-` o `_`. Verificar que el texto coincide con los specs y que `npx prettier --check README.md` pasa.

## 4. Verificación de conjunto

- [x] 4.1 Recorrer en la app, contra un nodo simulado, lo que cruza los grupos anteriores: cambiar el separador y la casilla desde la ventana de configuración con conexiones activas y ver el árbol rearmarse detrás; reiniciar la app y comprobar que las dos opciones se conservan; comprobar que el destello y su propagación a ramas cerradas siguen funcionando sobre ramas separadas por un carácter distinto de `:`, y que la pantalla de eventos muestra los ids enteros. Dejar anotado cualquier escenario que no se cumpla.
- [x] 4.2 Verificar que `npm run typecheck`, `npm run lint` y `npx prettier --check src README.md` terminan sin errores.
