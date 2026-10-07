# Proposal

## Why

Hoy nada le dice al usuario cuánto tráfico recibe cada conexión. El uso esperado
son decenas de mensajes por segundo, pero un nodo en loop, una suscripción
amplia en una planta grande o la tormenta de BIRTH de una reconexión pueden
multiplicar eso sin aviso, y la única forma de notarlo es ver la lista de
eventos correr. El objetivo es que el caudal esté a la vista y que, de paso, se
sepa con números qué carga aguanta la app.

## What Changes

- Cada conexión conectada muestra en el panel lateral, debajo de su nombre, su
  caudal: mensajes por segundo, métricas por segundo y kB por segundo. Si hubo
  saltos de secuencia desde que se conectó, muestra también cuántos.
- Se mide la app bajo carga con un generador de mensajes Sparkplug. El
  generador queda fuera del repositorio; los números quedan en `design.md`.

El alcance original incluía tres optimizaciones del renderer (dibujo con un
único cuadro pendiente, aviso de pantalla atrasada y filas incrementales en la
pantalla de eventos). La medición mostró que el problema que venían a resolver
aparece recién a unas 200 veces el uso esperado, así que se descartaron. El
razonamiento y los números están en `design.md`.

Fuera de alcance: el agrupamiento de 100 ms del proceso principal (no cambia),
cualquier límite de cuadros por segundo, el clonado de los eventos completos
entre procesos y el modelo duplicado en ambos procesos.

## Capabilities

### New Capabilities

- `estadisticas-de-conexion`: caudal de cada conexión (mensajes, métricas y
  kB por segundo, saltos de secuencia) a la vista en el panel lateral: qué se
  cuenta, cómo se promedia y cuándo se muestra.
- `ritmo-de-pantalla`: cómo se refleja en pantalla lo que llega cuando el
  caudal es alto: se dibuja agrupado y agrupar no pierde datos. Es
  comportamiento que la app ya tenía; la medición lo confirmó y este spec lo
  deja escrito por primera vez.

### Modified Capabilities

Ninguna.

## Impact

- Proceso principal: `src/main/sparkplug/session.ts` (contadores),
  `src/main/sparkplug/manager.ts` (muestreo y envío periódico).
- Puente: `src/preload/index.ts` y `src/shared/types.ts` (canal
  `sparkplug:stats` y tipo `ConnectionStats`). El canal de lotes de eventos no
  cambia.
- Renderer: `src/renderer/src/store.ts` (estadísticas por conexión),
  `src/renderer/src/App.tsx` y `assets/main.css` (panel lateral),
  `src/renderer/src/format.ts` (formato compacto).
- `README.md`: sección Conexiones.
- Sin dependencias nuevas. Sin cambios en la configuración guardada.
