# Spec Delta

## ADDED Requirements

### Requirement: Unión entre conexiones

Cuando el usuario lleva una conexión con el mouse hasta casi tocar otra, lo
bastante rápido como para vencer el rechazo entre las dos, ambas SHALL quedar
unidas, y la vista SHALL mostrar la unión con una línea de luz entre ellas.
Unidas, SHALL mantenerse juntas aunque el grafo se reacomode. La unión SHALL
soltarse solo cuando el usuario arrastra una de las dos tan rápido que la otra
no llega a seguirla.

#### Scenario: Acercarlas rápido

- **WHEN** el usuario arrastra rápido una conexión hasta casi tocar otra y la suelta
- **THEN** las dos quedan juntas, con una línea de luz entre ellas

#### Scenario: Acercarlas despacio

- **WHEN** el usuario arrastra despacio una conexión hacia otra
- **THEN** la otra se aparta y no quedan unidas

#### Scenario: Mover una despacio

- **WHEN** dos conexiones están unidas y el usuario arrastra una despacio
- **THEN** la otra la acompaña con su grafo y siguen unidas

#### Scenario: Tirón

- **WHEN** dos conexiones están unidas y el usuario arrastra una de un tirón
- **THEN** la unión se suelta, la línea de luz desaparece y vuelven a rechazarse

#### Scenario: El grafo se reacomoda

- **WHEN** dos conexiones están unidas y llega un rebirth o aparece un device nuevo
- **THEN** siguen unidas

#### Scenario: Conexión borrada

- **WHEN** el usuario borra una de dos conexiones unidas
- **THEN** la unión desaparece con ella
