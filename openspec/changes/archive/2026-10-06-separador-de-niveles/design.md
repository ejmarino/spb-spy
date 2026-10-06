# Design

## Context

Motivación y alcance: ver proposal.md. Comportamiento esperado: ver specs.

Estado actual que condiciona el diseño:

- La separación vive en un solo lugar: `segments()` en
  `src/renderer/src/tree.ts`, con la constante `SEGMENT_SEPARATOR = ':'`. La usa
  `Builder.path()`, que `buildTree` llama para el grupo, el nodo y cada device.
  Las métricas pasan por `Builder.child()` y no se parten.
- `buildTree(connections, model)` es una función pura; `TreeView.tsx` la llama
  dentro de un `useMemo` que depende de `active`, `connections` y
  `store.structure`.
- La clave de cada fila se arma con la clave del padre más el tramo, así que
  cambia cuando cambia la forma de la rama. `TreeView` guarda con esas claves
  qué ramas abrió o cerró el usuario (`overrides`) y la métrica elegida para
  mandarle un comando (`selectedKey`).
- La configuración ya tiene su camino completo: `AppSettings` en
  `src/shared/types.ts`, valores por defecto, validación y normalización en
  `src/shared/settings.ts`, `SettingsStore` en el proceso principal y
  `store.settings` en el renderer, que se actualiza con `onSettings` y avisa a
  los componentes. `SettingsStore.set()` rearma la configuración nombrando cada
  campo.
- El proyecto no tiene tests automatizados; se verifica con `typecheck`, `lint`,
  scripts sueltos sobre funciones puras y la app en marcha.

## Goals / Non-Goals

**Goals:**

- Que la regla de separación siga en un solo lugar y sea una función pura de
  los datos y la configuración, para que la visualización en grafo la reciba ya
  resuelta sin repetirla.
- Que la validación del separador sea la misma en el campo y en el proceso
  principal.

**Non-Goals:**

- Conservar la métrica elegida o las ramas abiertas cuando la rama cambia de
  forma.
- Que el proceso principal use la separación: el modelo de datos y los eventos
  siguen trabajando con los ids enteros.

## Decisions

### 1. Dos campos en `AppSettings`

`splitLevels: boolean` y `levelSeparator: string`, con `true` y `':'` por
defecto. Van separados para que deshabilitar no pierda el separador elegido.

Alternativa descartada: un solo campo donde el texto vacío signifique
"deshabilitado". Ahorra un campo pero pierde el separador al deshabilitar y
obliga a que el vacío sea a la vez un valor válido y un error del campo.

### 2. Validación en `src/shared/settings.ts`

`validateLevelSeparator(value)` devuelve el motivo del rechazo o `null`, igual
que `validateMaxEvents`. Es válido un texto de exactamente un carácter (contado
por puntos de código, para que un carácter fuera del plano básico cuente como
uno) que no sea espacio en blanco ni `/`, `+` o `#`. `validateSettings` la suma,
junto con el control de que `splitLevels` sea un booleano, y `normalizeSettings`
cae a los valores por defecto con lo que falte o no sirva. `SettingsStore.set()`
incorpora los dos campos.

Los archivos `settings.json` anteriores no tienen estos valores: quedan con la
separación habilitada y `:`, que es el comportamiento de hoy. No hace falta
migración.

### 3. `buildTree` recibe el separador

`buildTree(connections, model, separator)`, donde `separator` es el carácter o
`null` si la separación está deshabilitada. `segments(id, separator)` devuelve
`[id]` cuando es `null`. Se retira la constante `SEGMENT_SEPARATOR`.

`TreeView` calcula el argumento a partir de `store.settings` y suma los dos
valores a las dependencias del `useMemo`. Como `store.settings` cambia por
`onSettings` y eso avisa a los componentes, el árbol se rearma solo.

Alternativa descartada: que `tree.ts` lea `store.settings` por su cuenta.
Dejaría de ser pura y habría que subir `store.structure` a mano para invalidar
el `useMemo`.

### 4. Lo guardado por clave no se toca

Al cambiar la regla, las claves de las ramas que cambian de forma dejan de
existir. No se limpia nada: las entradas viejas de `overrides` quedan sin
efecto y esas ramas vuelven a su estado por defecto; si la métrica elegida ya
no se encuentra, el panel de comandos se cierra, que es lo que ya pasa cuando
una métrica desaparece del árbol. Las ramas cuya forma no cambia conservan su
clave y, con ella, su estado.

### 5. Interfaz

Sección nueva "Árbol de datos" en `Settings.tsx`, debajo de "Eventos":

- El componente `Toggle` existente para "Separar los nombres en niveles", que
  aplica el cambio al instante.
- Un campo corto para el carácter separador, con el mismo patrón que
  `MaxEventsField`: borrador local, se aplica al salir del campo o con Enter, y
  muestra el error de `validateLevelSeparator`. Queda deshabilitado con la
  casilla apagada. No lleva `maxLength`, para que pegar o tipear de más muestre
  el motivo en vez de recortar en silencio.

El borrador no se recorta con `trim()`: un espacio tiene que llegar a la
validación para que se informe como inválido.

## Risks / Trade-offs

- [Un separador muy común en los ids, como `-` o `_`, parte nombres que no eran
  jerarquías y llena el árbol de ramas de un solo hijo] → Es una elección del
  usuario y se revierte en el momento; el README lo advierte.
- [Al cambiar el separador se cierran o abren ramas que el usuario había
  acomodado] → Solo afecta a las ramas que cambian de forma; el resto conserva
  su estado. Se documenta en el spec.
- [Un separador de un carácter no cubre convenciones como `::` o `->`] →
  Decisión tomada; con `:` y los tramos vacíos descartados, `a::b` ya da `a` y
  `b`.
