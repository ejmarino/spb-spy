# Design

## Context

Motivación y alcance: ver proposal.md. Comportamiento esperado: ver specs.

`flattenTree` en `tree.ts` arma la lista de filas visibles. Sin texto recorre
el árbol respetando `isOpen`, que combina lo que el usuario abrió o cerró
(`overrides`, un mapa por clave) con `defaultOpen`. Con texto hace otro
recorrido que no mira `isOpen`: parte el texto por espacios, exige que el
nombre de la fila contenga todas las palabras, y deja la coincidencia, sus
ancestros y todo lo que cuelga de ella. En `TreeView`, mientras hay texto,
`isOpen` devuelve siempre `true`, el chevrón de cada fila cambia el mapa pero
nada lo lee, y Expandir y Colapsar todo quedan deshabilitados. El destello de
lo que no está en la lista (`hiddenUpdateAt`) se calcula sobre el conjunto de
filas listadas, sea cual sea la razón por la que una fila falta.

El cuadro de eventos ya tiene chips encendibles (`.chip`, `.is-off`) para los
tipos de mensaje; el estado apagado se dibuja tachado.

## Goals / Non-Goals

**Goals:**

- Un solo recorrido para buscar que también respete lo abierto y lo cerrado,
  en vez de dos modos que no se hablan.
- Que con herencia el resultado sea el árbol de siempre, recortado; y que sin
  herencia sea una lista.

**Non-Goals:**

- Buscar contra el camino completo o contra valores.
- Resaltar el texto coincidente dentro del nombre.

## Decisions

### 1. Cada fila tiene un papel en el resultado, y el papel decide su estado inicial

Con texto, `flattenTree` hace dos pasadas. La primera marca el papel de cada
fila: **coincidencia**, **ancestro** de alguna coincidencia, **descendiente**
de una coincidencia, o ninguno. Con herencia, la segunda recorre el árbol como
lo hace sin texto: muestra las filas con papel y baja a los hijos de una fila
solo si está abierta. Abierta es, en orden, lo que el usuario decidió en la
memoria del resultado, o si no el estado por papel:

```
  ancestro       abierto            (si no, no se ve la coincidencia)
  coincidencia   abierta
  descendiente   defaultOpen        (las reglas normales del arbol)
```

Sin herencia, la segunda pasada solo lista las coincidencias en el orden del
árbol, sin abrir nada: la fila se dibuja sin sangría ni chevrón, porque es una
línea suelta y no un nodo de un árbol. Lo que cuelga de ella no está en la
lista, así que su nombre destella cuando algo de abajo se actualiza, por el
mismo mecanismo que una rama colapsada.

Alternativa descartada: que sin herencia la coincidencia apareciera cerrada,
con su camino arriba y un chevrón para abrirla. Para buscar una métrica
repetida en treinta devices el camino repite treinta veces lo mismo, y el
usuario pidió exactamente la línea y nada más.

### 2. El texto se traduce a una función de coincidencia antes de recorrer

`flattenTree` recibe, en vez del texto, un `matcher: (label) => boolean` o
`null` cuando no hay búsqueda. `TreeView` lo arma según el modo: contiene parte
el texto por espacios y pide todas las palabras en minúsculas, como hoy; regex
construye una sola `RegExp` con la bandera `i` y la reutiliza. Si la regex no
compila, el matcher es `null` y el árbol se muestra entero, y el error de la
excepción se guarda para mostrarlo en el cuadro. Construir la regex una vez por
texto evita compilarla por fila.

### 3. La memoria del resultado es otro mapa

`TreeView` guarda dos mapas por clave: `overrides`, el del árbol sin texto, y
`searchOverrides`, el del resultado. Con texto, el chevrón y Expandir y
Colapsar todo escriben en el segundo; sin texto, en el primero. El segundo se
vacía cuando el texto pasa a vacío y cuando cambia el alcance. Sin herencia no
hay nada que plegar: Expandir y Colapsar todo se deshabilitan. Cambiar de modo
de texto no vacía la memoria: refinar una regex es refinar el texto.

Alternativa descartada: un solo mapa. Cerrar una rama en un resultado la
dejaría cerrada al borrar el texto, que nadie pidió.

### 4. Colapsar todo deja las conexiones, como sin texto

Expandir todo pone en la memoria del resultado todas las filas con hijos del
árbol en abierto; Colapsar todo, en cerrado. Es la misma regla que `setAll`
usa hoy, aplicada al otro mapa: quedan las conexiones cerradas, con el chevrón
que avisa que debajo hay resultados.

### 5. Chips de opción sin tachado, y el cuadro inválido en rojo

Las dos opciones son botones `.chip` con una variante `.chip-option` que apaga
el tachado: un tachado dice "excluido", y acá apagado solo dice "no". Van
dentro de la barra, pegados al cuadro de búsqueda, y el `title` de cada uno
explica el modo. El cuadro gana una clase `is-invalid` que pinta el borde con
`--red` y lleva el mensaje de la excepción en el `title`.

Las opciones son estado de `TreeView`, que sigue montada al cambiar de pantalla
igual que el texto del cuadro, así se recuerdan mientras la app está abierta.

## Risks / Trade-offs

- [Debajo de una coincidencia ya no se abre todo: una lista de más de 60
  métricas arranca colapsada] → Es la regla del árbol, y el chevrón la abre en
  un clic; el destello avisa si hay actividad.
- [Sin herencia, treinta líneas `temp` iguales no dicen de qué device son] → Es
  lo pedido: la línea exacta. El camino se ve encendiendo la herencia; mostrar
  el camino en la línea queda como posible paso siguiente.
- [Una regex como `.*` o vacía coincide con todo] → Es lo que dice: el árbol
  entero, con las reglas del alcance. No se trata distinto.
- [Una regex costosa sobre miles de filas se evalúa en cada rearmado] → El
  rearmado ya ocurre solo cuando cambia la forma del árbol, el texto o lo
  abierto; la regex se compila una vez por texto.
