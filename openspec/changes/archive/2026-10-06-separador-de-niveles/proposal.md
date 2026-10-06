# Proposal

## Why

El árbol de datos abre en ramas los ids de grupo, nodo y device que contienen
`:`, pero esa regla está fija en el código: quien nombra sus equipos con otro
carácter (`.`, `_`, `-`) no obtiene ramas, y quien usa `:` como parte del nombre
no puede evitarlas. Además la regla no está escrita en ningún spec, y la va a
compartir la visualización en grafo que viene después de este cambio.

## What Changes

- Nueva sección "Árbol de datos" en la ventana de configuración, con dos
  opciones:
  - **Separar los nombres en niveles**: casilla que habilita o deshabilita la
    separación. Habilitada por defecto, para que quien actualiza no note ningún
    cambio.
  - **Carácter separador**: el carácter que parte los ids. Por defecto, `:`.
- El separador es exactamente un carácter. Se rechazan, con un mensaje en el
  campo, el valor vacío, más de un carácter, el espacio en blanco y los
  caracteres `/`, `+` y `#` (Sparkplug no los admite en un id, así que nunca
  partirían nada).
- Con la separación deshabilitada, cada id de grupo, nodo o device se muestra
  entero, como un solo nivel. El separador elegido se conserva para cuando se
  vuelva a habilitar.
- La regla de separación queda escrita por primera vez en un spec, incluido lo
  que hoy ya hace el árbol: los tramos vacíos se descartan (`a::b` da `a` y
  `b`), los ids que comparten tramos iniciales comparten rama, y los tramos
  intermedios no son nodos ni devices.
- El cambio de cualquiera de las dos opciones rearma el árbol en el momento, sin
  reconectar.

Fuera de alcance:

- La visualización de datos en grafo. Es el cambio siguiente y va a consumir
  esta misma regla.
- Separar en niveles los nombres de las métricas.
- Un separador distinto por conexión, o de más de un carácter.
- La pantalla de eventos, que sigue mostrando los ids enteros.

## Capabilities

### New Capabilities

- `separacion-en-niveles`: cómo los ids de grupo, nodo y device se parten en
  niveles según la configuración, y qué pasa con el árbol de datos cuando esa
  configuración cambia.

### Modified Capabilities

- `configuracion-de-la-app`: el requisito "Opciones de la configuración" suma la
  sección del árbol de datos con sus dos opciones y sus valores por defecto.

## Impact

- **Compartido**: `src/shared/types.ts` (dos campos nuevos en `AppSettings`) y
  `src/shared/settings.ts` (valores por defecto, validación del separador y
  normalización de lo guardado).
- **Proceso principal**: `src/main/settings.ts`, que arma la configuración campo
  por campo al aplicar un cambio.
- **Renderer**: `src/renderer/src/tree.ts` (`buildTree` recibe el separador en
  vez de usar la constante), `views/TreeView.tsx` (le pasa la configuración y
  rearma el árbol cuando cambia), `views/Settings.tsx` (sección nueva) y
  `assets/main.css` si el campo lo necesita.
- **Datos del usuario**: `settings.json` suma dos valores; si faltan o no son
  válidos rigen los valores por defecto.
- **Documentación**: `README.md`, secciones "Árbol de datos" y "Configuración".
- Sin dependencias nuevas, sin canales de IPC nuevos.
