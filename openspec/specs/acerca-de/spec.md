# acerca-de Specification

## Purpose

Define la ventana "Acerca de", que identifica a la app: su nombre, su versión,
dónde encontrarla y sobre qué entorno corre.

## Requirements

### Requirement: Nombre del producto en "Acerca de"

El ítem del pie del panel lateral y el título de la ventana SHALL leerse "Acerca
de {nombre del producto}", donde el nombre es el nombre de producto con el que
se empaqueta la app. La marca dentro de la ventana SHALL mostrar ese mismo
nombre.

#### Scenario: Ítem del panel lateral

- **WHEN** la app se empaqueta con el nombre de producto "SpbSpy"
- **THEN** el ítem del panel lateral dice "Acerca de SpbSpy"

#### Scenario: Título de la ventana

- **WHEN** el usuario abre la ventana
- **THEN** su título dice "Acerca de SpbSpy" y la marca muestra "SpbSpy"

#### Scenario: Cambio del nombre de producto

- **WHEN** se cambia el nombre de producto del paquete y se vuelve a construir la app
- **THEN** el ítem, el título y la marca muestran el nombre nuevo sin tocar otro texto

### Requirement: Contenido de "Acerca de"

La ventana SHALL mostrar la marca con la descripción de la app, la versión, el
enlace al sitio y el entorno (versiones de Electron, Chromium y Node). No SHALL
incluir opciones ni acciones de actualización: esas están en la configuración.

#### Scenario: Ventana informativa

- **WHEN** el usuario abre "Acerca de SpbSpy"
- **THEN** ve la marca, la versión, el sitio y el entorno
- **AND** no ve opciones ni botones de actualización

#### Scenario: Enlace al sitio

- **WHEN** el usuario hace clic en el enlace del sitio
- **THEN** se abre en el navegador del sistema
