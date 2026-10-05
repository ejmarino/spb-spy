# Proposal

## Why

Las únicas opciones de la app (buscar actualizaciones automáticamente y el botón
de buscar) están dentro de "Acerca de", que no es donde se las espera encontrar,
y dos comportamientos que el usuario quiere ajustar están fijos en el código: la
búsqueda automática es siempre diaria y la lista de eventos conserva siempre
5.000. Hace falta un lugar propio para la configuración, donde entren estas
opciones y las que vengan.

## What Changes

- El ítem "Acerca de" del panel lateral y el título de su ventana pasan a
  llamarse "Acerca de {nombre del producto}" (hoy, "Acerca de SpbSpy"). El
  nombre sale del `productName` del paquete, no de un texto escrito a mano.
- Nuevo ítem "Configuración" en el pie del panel lateral, con ícono de
  engranaje, arriba de "Acerca de …". Abre una ventana de configuración.
- La sección de actualizaciones se muda entera de "Acerca de" a "Configuración":
  el estado de la búsqueda, el botón de buscar ahora y los de descargar e
  instalar. "Acerca de" queda solo informativa (marca, versión, sitio, entorno).
- El aviso de versión nueva del panel lateral abre "Configuración" en vez de
  "Acerca de".
- La casilla "Buscar actualizaciones automáticamente" se reemplaza por una
  periodicidad: **diaria, semanal, mensual o nunca**. Quien tenía la casilla
  activada queda en diaria; quien la tenía apagada, en nunca.
- Nueva opción **máximo de eventos en memoria**: cuántos eventos conserva la
  lista de eventos. Es un único valor global, igual que hoy; deja de estar fijo
  en el código.
- El máximo de eventos por defecto sube de 5.000 a **10.000** cuando no hay nada
  configurado.
- La configuración se guarda en el `settings.json` que ya existe y se aplica en
  el momento, sin reiniciar la app.

Fuera de alcance: un límite de eventos por conexión (se evaluó y se deja para
más adelante) y cualquier otra opción de configuración.

Supuestos tomados sin confirmación explícita, registrados en design.md:
"mensual" son 30 días, el máximo de eventos admite entre 500 y 50.000, y al
bajar el máximo la lista se recorta en el momento.

## Capabilities

### New Capabilities

- `configuracion-de-la-app`: la ventana de configuración, cómo se llega a ella,
  y que las opciones se guardan entre sesiones y se aplican sin reiniciar.
- `busqueda-de-actualizaciones`: periodicidad de la búsqueda automática,
  búsqueda manual, aviso de versión nueva y descarga e instalación a pedido.
- `historial-de-eventos`: cuántos eventos se conservan en memoria y qué pasa
  con los más viejos cuando se supera o se cambia el máximo.
- `acerca-de`: la ventana "Acerca de {nombre del producto}" y lo que muestra.

### Modified Capabilities

Ninguna. La única spec existente, `destello-de-actualizaciones`, trata de los
valores del árbol de datos y no cambia.

## Impact

- **Proceso principal**: `src/main/updater.ts` deja de ser dueño de
  `settings.json`; aparece un módulo de configuración que también lee
  `src/main/sparkplug/manager.ts` para el máximo de eventos. `src/main/index.ts`
  los conecta.
- **Compartido**: `src/shared/types.ts` (tipo de la configuración, `SpbApi`,
  `UpdateStatus` pierde `autoCheck`) y un módulo nuevo con los valores por
  defecto, la validación y el cálculo de cuándo toca buscar.
- **IPC y preload**: canales nuevos para leer, cambiar y escuchar la
  configuración; se retira `updates:set-auto-check`.
- **Renderer**: `App.tsx` (pie del panel lateral), `views/About.tsx` (pierde la
  sección de actualizaciones), vista nueva de configuración, `store.ts` (máximo
  de eventos configurable) y `assets/main.css`.
- **Build**: `electron.vite.config.ts` inyecta el nombre del producto, como ya
  hace con la versión.
- **Datos del usuario**: `settings.json` cambia de forma; el valor viejo
  `autoUpdateCheck` se migra al leerlo.
- **Memoria**: con el nuevo valor por defecto la lista de eventos ocupa
  aproximadamente el doble que hoy en cada proceso.
- **Documentación**: `README.md`, secciones "Pantalla de eventos" y
  "Actualizaciones", más una sección de configuración.
- Sin dependencias nuevas.
