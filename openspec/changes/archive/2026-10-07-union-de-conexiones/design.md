# Design

## Context

Motivación y alcance: ver proposal.md. Comportamiento esperado: ver specs.

La vista acomoda los elementos con una simulación de `d3-force`. Las conexiones
son las raíces de grafos sueltos: se rechazan por la repulsión y la colisión, y
al arrastrar un elemento se lo fija al puntero mientras la simulación sigue
caliente.

## Goals / Non-Goals

**Goals:**

- Que unir y soltar salgan del mismo gesto de arrastre, sin teclas ni botones.

**Non-Goals:**

- Uniones entre elementos que no sean conexiones.
- Guardar las uniones entre sesiones.

## Decisions

### 1. Un resorte que se rompe

La unión es una fuerza más de la simulación: un resorte entre las dos
conexiones, con un largo de reposo apenas mayor que la distancia a la que las
deja la colisión. No hace falta medir la velocidad del mouse:

- **Formarla**: mientras se arrastra una conexión, si queda a menos de cierta
  distancia de otra, se unen. Esa distancia es menor que la que impone la
  colisión, así que solo se alcanza cuando el arrastre le gana a la colisión,
  que aparta a la otra en pocas pasadas: es decir, acercándola rápido.
- **Seguirla**: la conexión arrastrada está fija al puntero y la otra la sigue
  por el resorte, con un atraso que crece con la velocidad.
- **Soltarla**: si ese atraso estira el resorte más allá de un límite, la unión
  se quita. Como el atraso depende de la velocidad, despacio acompaña y de un
  tirón se suelta.

Alternativa descartada: medir la velocidad del puntero para decidir. Agrega
estado y umbrales en píxeles por segundo que dependen del zoom; el resorte da el
mismo resultado con la física que ya está.

### 2. Solo el arrastre la rompe

El límite de estiramiento se mira únicamente mientras el usuario arrastra una de
las dos conexiones. Si no, la repulsión entre dos grafos grandes al recalentarse
la simulación podría soltar la unión sola.

### 3. Estado y dibujo

Las uniones se guardan por par de claves de conexión, junto al resto del estado
del grafo; si una de las dos desaparece, la unión se descarta. Se dibujan como
una línea clara entre las dos conexiones, debajo de los elementos.

## Risks / Trade-offs

- [Qué tan rápido es "rápido" depende de las constantes y del mouse de cada
  uno] → Distancia para unir, largo, límite y fuerza quedan como constantes
  juntas en `GraphView.tsx`. Se calibraron con el mouse simulado.
- [Al soltar dos conexiones unidas lejos del centro, el par vuelve en parte
  hacia el centro por las fuerzas del grafo] → Es el comportamiento del resto
  del grafo: nada queda fijo donde se lo suelta.
