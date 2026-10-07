# Proposal

## Why

En la visualización de datos cada conexión es un grafo suelto y todas se
rechazan entre sí, así que no hay forma de dejar dos juntas para mirarlas como
un conjunto: al soltarlas vuelven a separarse.

## What Changes

- Dos conexiones se pueden unir: si el usuario lleva una rápido con el mouse
  hasta casi tocar otra, quedan pegadas, con un lazo de luz entre las dos.
- Acercarlas despacio no las une: la otra se aparta, como hasta ahora.
- Unidas, al mover una despacio la otra la acompaña con todo su grafo.
- Un tirón rápido de una de las dos las suelta y vuelven a rechazarse.
- Solo ese tirón las separa: un rebirth o el reacomodo del grafo no rompen la
  unión.

Fuera de alcance: unir otros elementos que no sean conexiones, guardar las
uniones entre sesiones y una forma de unir o soltar que no sea con el mouse.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `visualizacion-de-datos`: se agrega el requisito de la unión entre
  conexiones. Los requisitos existentes no cambian.

## Impact

- **Renderer**: `src/renderer/src/views/GraphView.tsx`, con una fuerza más en la
  simulación y el dibujo del lazo.
- **Documentación**: `README.md`, sección "Visualización de datos".
- Sin dependencias nuevas ni cambios fuera de la vista.
