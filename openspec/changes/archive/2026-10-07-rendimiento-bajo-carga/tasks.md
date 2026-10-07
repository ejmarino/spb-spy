# Tasks

## 1. Generador de carga y medición de referencia

- [x] 1.1 Escribir, fuera del repositorio, el generador de carga del punto 3 de `design.md` (broker `aedes` en el mismo proceso, nodos simulados, parámetros de nodos, devices, métricas por mensaje y mensajes por segundo, modo de BIRTH simultáneos). Verificar conectando la app a mano y viendo en el árbol los nodos simulados con valores que cambian.
- [x] 1.2 Escribir el script de medición con Playwright (mayor intervalo entre cuadros y tiempo de vaciado, con `performance.now()`). Verificar que dos corridas seguidas del caso de 50 msg/s dan resultados parecidos.
- [x] 1.3 Medir la versión anterior (commit `553c823`, compilada desde un clon) en los seis casos de `design.md` y anotar los resultados en una sección «Mediciones» de `design.md`. Si los números contradicen el diagnóstico, detenerse y avisar antes de seguir.

## 2. Estadísticas en el proceso principal

- [x] 2.1 Agregar el tipo de las estadísticas de una conexión y el canal `sparkplug:stats` en `src/shared/types.ts` (`SpbApi.onStats`) y `src/preload/index.ts`. Verificar con `npm run typecheck`.
- [x] 2.2 Contar en `SparkplugSession` mensajes, bytes, métricas y saltos según la decisión 1 de `design.md`, con un método que entrega y pone en cero los contadores de caudal. Verificar con `npm run typecheck`.
- [x] 2.3 En `SparkplugManager`, muestrear cada segundo las sesiones conectadas, promediar las últimas 5 muestras por tiempo real transcurrido, mandar el array por `sparkplug:stats` solo si cambió, descartar las muestras de una sesión que deja de estar conectada y cortar el timer en `shutdown`. Verificar con el generador a 20 msg/s de 5 métricas que el canal entrega cerca de 20 mensajes/s y 100 métricas/s, y que al cortar el generador los valores llegan a cero a los 5 s y el canal deja de emitir.
- [x] 2.4 Verificar los escenarios de «Qué cuenta como tráfico recibido»: un DDATA de 500 métricas suma 1 mensaje y 500 métricas, un mensaje que no es Sparkplug suma mensaje y bytes, y un pedido de rebirth desde la app no cambia el caudal.

## 3. Caudal en el panel lateral

- [x] 3.1 Guardar en el store del renderer las estadísticas por conexión que llegan por `onStats`, y borrarlas cuando se borra la conexión. Verificar con `npm run typecheck`.
- [x] 3.2 Agregar a `format.ts` el formato compacto de los valores (sufijo `k`, un decimal por debajo de 10, kB a MB). Verificar los ejemplos del spec: 3.420 da `3,4k`, 0,2 da `0,2`, 2.500 kB da `2,5 MB/s`.
- [x] 3.3 Mostrar el renglón de caudal debajo de cada conexión conectada en `App.tsx`, con sus estilos en `main.css` y el `title` explicativo. Verificar con una captura a 1440x768 que entra en el panel sin cortar valores, con una conexión con tráfico, una conectada sin tráfico (ceros) y una desconectada (sin renglón).
- [x] 3.4 Mostrar la cuenta de saltos con aspecto de advertencia cuando es mayor que cero. Verificar haciendo que el generador saltee un `seq`: aparece `1 salto`, se conserva tras una reconexión automática y vuelve a cero al desconectar y conectar a mano.
- [x] 3.5 Documentar el caudal del panel lateral en la sección Conexiones del `README.md` y verificar que describe lo que se ve en la app.

## 4. Cierre

- [x] 4.1 Dejar los artefactos del change coherentes con el alcance final: propuesta, spec `ritmo-de-pantalla` reducido a lo que la app ya hace y la medición confirmó, diseño con la sección «Descartado tras la medición». Verificar con `openspec validate rendimiento-bajo-carga --strict`.
- [x] 4.2 Correr `npm run typecheck` y `npm run lint` sobre todo el proyecto y dejarlos sin errores.
