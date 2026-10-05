# Tasks

## 1. Cálculo de la actividad oculta

- [x] 1.1 En `src/renderer/src/tree.ts`, agregar la función pura que, dada una fila y el conjunto de filas en la lista, devuelve el instante de la última actualización (sin contar primeros valores) entre lo que cuelga de sus hijos que no están en la lista, o 0 si no hay; baja solo por contenedores sin métrica (design, decisiones 1, 3 y 4). Verificar con un script fuera del repo que arme un árbol con `buildTree` y `flattenTree` y compruebe: device colapsado, nodo colapsado, UDT colapsado, fila con hijos en la lista e hijos ocultos (caso del buscador), métricas en su primer valor (devuelve 0) y fila totalmente desplegada (devuelve 0); `npm run typecheck` y `npm run lint` sin errores.

## 2. Destello en el nombre de la fila

- [x] 2.1 En `src/renderer/src/views/TreeView.tsx`, armar junto con `rows` el conjunto de filas en la lista y pasarle a cada `TreeRow` montada el instante de la última actualización oculta (design, decisiones 2 y 4). Verificar que `npm run typecheck` pasa y que el árbol se sigue viendo y comportando igual que antes con todo desplegado.
- [x] 2.2 En `TreeRow`, poner la clase `is-fresh` en el `span` del nombre cuando ese instante cae dentro de `FLASH_MS`, con `key` igual al instante para que la animación vuelva a empezar (design, decisión 5). Verificar en la app contra un nodo simulado: con un device colapsado, al actualizarse una métrica destella el nombre del device y no el del nodo ni el de la conexión; al desplegarlo, vuelve a destellar solo el valor de la métrica.
- [x] 2.3 En `src/renderer/src/assets/main.css`, dar al nombre el destello con la animación `fresh` y el mismo relleno y radio que el valor, sin que el texto se mueva al encenderse. Verificar con capturas que el resaltado del nombre y el de un valor tienen el mismo color y forma, que los nombres no se desplazan respecto de la versión actual y que las filas offline, stale y seleccionada se ven como antes.
- [x] 2.4 Actualizar la sección "Árbol de datos" del `README.md`: el destello se propaga a la primera fila visible cuando la métrica está oculta por colapso o por el buscador, vale para los UDT colapsados y no hay destello con el primer valor (BIRTH). Verificar que el texto coincide con el spec y que `npx prettier --check README.md` pasa.

## 3. Verificación de conjunto

- [x] 3.1 Recorrer en la app, contra un nodo simulado, los escenarios de `specs/destello-de-actualizaciones/spec.md`: nodo y conexión colapsados, fila `-`, rama intermedia de un id con `:`, UDT colapsado y desplegado, device de más de 60 métricas sin desplegar, buscador (métrica oculta por el filtro, métrica que coincide, device que coincide), BIRTH y rebirth sin destello, métrica desplegada fuera de pantalla, reinicio del destello con actualizaciones seguidas y apagado a los 1,2 s. Verificar que cada escenario se cumple y dejar anotado cualquiera que no.
- [x] 3.2 Medir con un árbol grande simulado (por ejemplo 20 devices de 1.000 métricas, con la conexión colapsada y actualizaciones continuas) que la interfaz sigue fluida al hacer scroll y al desplegar ramas. Si no, aplicar la mitigación del design (guardar el resultado por ítem y versión del store) y volver a medir.
- [x] 3.3 Verificar que `npm run typecheck`, `npm run lint` y `npx prettier --check src README.md` terminan sin errores.
