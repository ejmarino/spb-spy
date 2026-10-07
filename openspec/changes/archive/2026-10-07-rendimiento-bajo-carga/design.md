# Design

## Context

Ver `proposal.md` para la motivación. Lo que sigue es lo que hay hoy y condiciona
el diseño.

```
 broker
   |  1 por mensaje
   v
 MAIN      session.onMessage: decodifica, resuelve alias
           manager.push: aplica al modelo, guarda en recent[]
           junta en pending[] ---- timer de 100 ms (FLUSH_MS) ----+
                                                                  |
   +--------------------------------------------------------------+
   |  IPC "sparkplug:batch": SpEvent[]
   v
 RENDERER  store.apply: aplica cada evento a su copia del modelo
           notify(): version++ y aviso sincronico a los componentes
             +-- TreeView:   filas visibles (lista virtual)
             +-- EventsView: buildRows recorre store.events entero
```

- El agrupamiento ya existe: `FLUSH_MS = 100` en `manager.ts` da como máximo 10
  lotes por segundo, y cada lote dispara un render. El destello se decide por
  redibujo y no por mensaje (`now - metric.updatedAt < FLASH_MS` en
  `TreeView.tsx`).
- La sesión ya detecta los saltos de secuencia en `checkSequence` y descarta el
  eco de lo que publica la app en `isEcho`.
- El panel lateral mide 216 px. No hay framework de tests: la verificación es
  `npm run typecheck`, `npm run lint` y manejar la app con Playwright.
- En el devcontainer el reloj de pared salta unos 3,3 s cada 30 s respecto del
  monotónico (WSL2).

## Goals / Non-Goals

**Goals:**

- Que el caudal de cada conexión esté a la vista con un costo despreciable,
  también bajo carga.
- Tener números de qué carga aguanta la app, para decidir con ellos y no con
  una lectura del código.

**Non-Goals:**

- Cambiar `FLUSH_MS` o el contenido del canal `sparkplug:batch`.
- Reducir el trabajo del proceso principal o el volumen que cruza el IPC.
- Optimizar el renderer: ver «Descartado tras la medición».

## Decisions

### 1. Contadores en la sesión, promedio en el manager

`SparkplugSession` suma tres contadores simples y uno acumulado:

- mensajes y bytes en `onMessage`, después del descarte de eco y solo si el
  mensaje no es `sent`;
- métricas en `decode`, con `decoded.metrics.length`, solo si el evento no es
  `sent`;
- saltos en `checkSequence`, cuando marca `seqExpected`. Se pone en cero en
  `start()`, que es la conexión pedida por el usuario; las reconexiones
  automáticas pasan por `open()` y no la tocan.

El manager, con un timer de 1 s, toma y pone en cero los tres contadores de cada
sesión y guarda, para las conectadas, las últimas 5 muestras junto con el tiempo
transcurrido real de cada una (reloj monotónico, porque el timer se atrasa
justamente bajo carga). El caudal es la suma de las muestras dividida por la
suma de los tiempos, así que da bien desde el primer segundo. Las muestras de
una sesión se descartan cuando deja de estar conectada, se edita o se borra.

Se manda por un canal nuevo, `sparkplug:stats`, un array con una entrada por
conexión conectada: id, mensajes/s, métricas/s, bytes/s y saltos. Si el array
es igual al último enviado no se manda, para que una app en reposo no se
redibuje una vez por segundo.

*Alternativas:* contar en el renderer a partir de los lotes: no ve los bytes de
lo que no decodifica bien y deja de contar justo cuando el renderer está
saturado. Sumar las estadísticas al lote de eventos: cambia la forma de
`sparkplug:batch` y ata dos ritmos distintos.

### 2. Caudal en el panel lateral

Cada `li` de `.sidebar-connections` pasa a tener dos renglones: el actual y,
solo si la conexión está en estado `connected`, uno con el caudal en letra
chica, color atenuado y números tabulares: `120 msg/s · 3,4k mét/s · 85 kB/s`.
Una conexión conectada de la que todavía no llegaron estadísticas muestra ceros.
Los tres valores son elementos separados con `flex-wrap`, de modo que si no
entran en una línea baja un valor entero. Los saltos van en un cuarto elemento
con el ícono de advertencia que ya usa el árbol. El formato de los números vive
en `format.ts`.

El `title` del renglón explica cada valor, que es el promedio de los últimos
5 s, y que los saltos de secuencia pueden indicar mensajes perdidos o un nodo
que numera mal.

### 3. Generador de carga y medición

Un script fuera del repositorio, con un broker `aedes` en el mismo proceso y
nodos simulados con `mqtt` y `sparkplug-payload`. Parámetros: nodos, devices
por nodo, métricas por mensaje, mensajes por segundo, y un modo que manda todos
los BIRTH juntos.

Se mide con Playwright sobre la app compilada, con tiempos tomados con
`performance.now()`:

- el mayor intervalo entre dos cuadros del renderer durante la carga;
- el tiempo de vaciado: cuánto tarda en aparecer en el árbol una marca que se
  publica apenas el generador corta. Es el atraso acumulado.

Los resultados están en «Mediciones».

## Descartado tras la medición

El alcance original tenía tres optimizaciones del renderer, pensadas a partir
de leer el código: un único cuadro pendiente en el store (para que los lotes no
encolen renders), un aviso de pantalla atrasada, y filas incrementales en la
pantalla de eventos (para que `buildRows` no recorra el historial en cada
lote). La medición de referencia se hizo antes de implementarlas, como estaba
previsto, y mostró que el mecanismo existe pero la escala no: el atraso que
crece con el tiempo aparece recién a 10.000 msg/s con el buscador y el máximo
en 50.000, unas 200 veces el uso esperado. A 2.000 msg/s ningún caso se atrasa
y la tormenta de 200 BIRTH se absorbe en menos de 300 ms.

Se descartaron las tres. Si alguna vez hacen falta, el diseño sigue valiendo:
el camino es separar «aplicar datos» de «dibujar» en `store.ts` con un único
`requestAnimationFrame` pendiente, y mantener las filas de `EventsView` en el
lugar agregando solo los eventos con id mayor al último procesado y recortando
del principio por id.

## Risks / Trade-offs

- [El promedio de 5 s esconde picos de menos de un segundo] → aceptado: el
  número sirve para notar un caudal sostenido, no una ráfaga.
- [Los saltos de secuencia no prueban saturación: también los causa un nodo que
  numera mal] → el `title` lo dice; la cuenta es una pista, no un diagnóstico.
- [El renglón de caudal puede no entrar en 216 px] → baja de a un valor entero;
  revisado a 1440x768 con `199,9k mét/s` y `3,7 MB/s`.
- [Los números de la medición son del devcontainer, sin GPU] → en otra máquina
  los valores absolutos cambian; lo que importa es dónde empieza a crecer el
  atraso, y eso quedó muy por encima del uso esperado.

## Open Questions

- ¿Conviene dejar el generador de carga dentro del repositorio como
  herramienta de desarrollo? Sumaría `aedes` como dependencia de desarrollo.
  Hoy vive en una carpeta temporal y se pierde con la sesión.

## Mediciones

Medido en el devcontainer (WSL2, sin GPU), con la app compilada, un broker
`aedes` local y 100 devices simulados que publican DDATA de 5 métricas. El
«vaciado» es lo que tarda en verse en pantalla una marca publicada apenas corta
el generador: mide el atraso acumulado. El piso es de unos 105 ms (los 100 ms
de agrupamiento más un cuadro).

### Referencia: commit `553c823`, antes de este change

Los seis casos previstos:

| Caso | Carga | Vaciado | Mayor intervalo entre cuadros |
|---|---|---|---|
| Referencia, árbol | 50 msg/s, 10 s | 104 ms | 20 ms |
| Árbol | 2.000 msg/s, 20 s | 105 ms | 32 ms |
| Eventos | 2.000 msg/s, 20 s | 104 ms | 38 ms |
| Eventos con buscador | 2.000 msg/s, 20 s | 104 ms | 105 ms |
| Eventos, máximo en 50.000 | 2.000 msg/s, 40 s | 111 ms | 78 ms |
| 200 nodos con BIRTH a la vez | 1.200 mensajes, 50.000 métricas | 285 ms | 168 ms |

Ninguno se atrasa. Como no aparecía el problema, se subió la carga hasta
encontrarlo:

| Caso | Carga | Vaciado | Mayor intervalo entre cuadros |
|---|---|---|---|
| Árbol | 10.000 msg/s, 20 s | 105 ms | 46 ms |
| Eventos | 10.000 msg/s, 20 s | 119 ms | 94 ms |
| Eventos con buscador, máximo en 50.000 | 10.000 msg/s, 20 s | 2,0 s | 213 ms |
| Eventos con buscador, máximo en 50.000 | 10.000 msg/s, 60 s | 9,6 s | 242 ms |
| Eventos, máximo en 50.000 | 10.000 msg/s de 50 métricas, 30 s | 14,8 s | 968 ms |

A 10.000 msg/s la app no pierde nada: una métrica que recibió 1.000 valores en
10 s muestra 1.001 actualizaciones.

### Lectura

- El diagnóstico acertó el mecanismo y erró la escala. El atraso que crece con
  la duración existe (2,0 s a los 20 s, 9,6 s a los 60 s) y aparece donde se
  esperaba, en la pantalla de eventos con historial grande. Pero recién a
  10.000 msg/s con el buscador y el máximo en 50.000, o a 500.000 métricas por
  segundo: unas 200 veces el uso esperado.
- El árbol no se atrasa en ningún caso medido.
- La tormenta de BIRTH no es un problema: 50.000 métricas de golpe se ven en
  menos de 300 ms.

### Con las estadísticas

Las estadísticas se verificaron con el generador a 20 msg/s de 5 métricas
(19,99 msg/s y 99,99 mét/s medidos), con un DDATA de 500 métricas, un UDT de
10 miembros, un mensaje que no es Sparkplug, un rebirth publicado por la app, y
con un salto de secuencia seguido de una reconexión automática y de una manual.
No se repitió la medición de carga: el muestreo es un timer de 1 s que lee
cuatro números por conexión y no toca el camino de los lotes.
