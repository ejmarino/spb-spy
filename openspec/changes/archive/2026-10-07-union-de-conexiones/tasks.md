# Tasks

## 1. Unión entre conexiones

- [x] 1.1 Agregar a la simulación de `src/renderer/src/views/GraphView.tsx` la fuerza de unión entre conexiones: se forma cuando la conexión arrastrada queda a menos de la distancia de unión de otra, tira de las dos como un resorte y se quita cuando el arrastre de una la estira más allá del límite (design, decisiones 1 y 2). Verificar en la app, con dos conexiones y el mouse simulado, los escenarios de "Unión entre conexiones": acercarlas despacio no las une, acercarlas rápido las deja juntas, mover una despacio lleva a la otra, un rebirth no las separa y un tirón las suelta. **Medido:** 141 unidades entre las dos en reposo, 125 tras acercarlas despacio, 51 unidas, 51 tras un rebirth y 210 tras el tirón.
- [x] 1.2 Dibujar la unión como una línea de luz entre las dos conexiones y descartarla si una desaparece (design, decisión 3). Verificar con una captura que la línea se ve con las conexiones unidas y no después del tirón.
- [x] 1.3 Documentar la unión en la sección "Visualización de datos" de `README.md` y verificar que `npm run typecheck`, `npm run lint` y `npx prettier --check src README.md` terminan sin errores.
