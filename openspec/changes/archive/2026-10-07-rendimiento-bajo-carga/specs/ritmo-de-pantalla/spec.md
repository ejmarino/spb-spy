# Spec Delta

## Purpose

Define cómo la app refleja en pantalla lo que recibe cuando el caudal es alto:
agrupa lo que llega para redibujar un número acotado de veces por segundo, sin
perder nada de lo recibido.

## ADDED Requirements

### Requirement: Lo recibido se dibuja agrupado

La app SHALL reflejar en pantalla los mensajes recibidos en grupos y no uno por
uno: por mensajes recibidos SHALL redibujar como máximo unas 10 veces por
segundo, sea cual sea el caudal.

#### Scenario: Ráfaga de mensajes

- **WHEN** llegan 500 mensajes en un segundo
- **THEN** la pantalla se redibuja unas 10 veces en ese segundo, no 500

#### Scenario: Caudal bajo

- **WHEN** llega un único mensaje
- **THEN** su efecto se ve en pantalla en menos de medio segundo

### Requirement: Agrupar no pierde datos

Agrupar SHALL NOT descartar nada de lo recibido: el árbol SHALL mostrar el
último valor de cada métrica, la cuenta de actualizaciones de cada métrica
SHALL incluir todas las recibidas y la lista de eventos SHALL incluir todos los
mensajes, dentro del máximo del historial.

#### Scenario: Varias actualizaciones de una métrica en un mismo grupo

- **WHEN** una métrica recibe 5 valores entre dos redibujos
- **THEN** el árbol muestra el último de los 5
- **AND** su cuenta de actualizaciones sube en 5
- **AND** su valor destella una sola vez

#### Scenario: Eventos de un mismo grupo

- **WHEN** llegan 200 mensajes entre dos redibujos
- **THEN** la lista de eventos muestra los 200, en orden de llegada
