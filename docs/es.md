# Precios de carburantes España e Italia

El precio de los carburantes en las gasolineras de **España** e **Italia**,
según los datos abiertos oficiales de ambos gobiernos, sin cuenta ni clave. Sin
relación con estos ministerios.

## Lo que obtiene

- Las gasolineras alrededor de su casa (o de un municipio) listadas en la
  pestaña **Descubrimiento**: añada las que usa, cada una se convierte en un
  dispositivo con sus precios.
- Un dispositivo **Carburante más barato**: para cada carburante seguido, el
  precio más bajo en el radio, la gasolinera y su distancia.
- Un disparador de escena **Bajada del precio de un carburante** y un widget
  **Precios de carburantes** para el panel.

## Requisitos

- Gladys Assistant 5.3.0 o posterior.
- Acceso a Internet desde Gladys (las fuentes son los servidores de los
  ministerios).
- Su casa ubicada en Gladys (**Ajustes → Casas**), o un municipio en la
  configuración. Al instalar, Gladys le pide permiso para compartir la
  ubicación de la casa con la integración: solo sirve para medir distancias,
  dentro del contenedor.

## Instalación

En Gladys, **Integraciones → Instalar desde GitHub**, dirección
`https://github.com/guim31/gladys-fuel-es-it`.

## Configuración

- **País**: España o Italia (uno por instalación).
- **Carburantes a seguir**: España: gasolina 95 y 98, Gasóleo A, Gasóleo
  Premium, GLP. Italia: gasolina y gasóleo, autoservicio y atendido por
  separado, GLP, metano (por kg). Solo se usan los carburantes del país
  elegido.
- **Radio de búsqueda**: de 1 a 30 km alrededor de la primera casa ubicada en
  Gladys (5 km por defecto).
- **Municipio** (opcional): sus gasolineras también se listan y, sin casa
  ubicada, el precio más bajo se busca allí. Mayúsculas y acentos dan igual
  (`Alcala de Henares`, `ROMA`).
- **Idioma de los nombres**: nombres de dispositivos y funciones, escritos una
  vez al añadir un dispositivo, fechas y textos del disparador.

Abra después **Descubrimiento**: primero el dispositivo del más barato, luego
las gasolineras desde la más cercana (50 como máximo) y luego las del
municipio.

## Dispositivos

### Gasolinera

Uno por gasolinera añadida: el precio de cada carburante seguido que vende
(€/l, €/kg para el metano), la última actualización de precios (hora local del
país) y el horario en España. Una gasolinera que vende un nuevo carburante
muestra **Actualizar** en Descubrimiento. Una gasolinera que sale de la lista
oficial (cerrada) conserva sus últimos valores, y el widget lo indica.

### Carburante más barato

Para cada carburante seguido: el precio más bajo en el radio, la gasolinera y
su distancia en km (sin casa ubicada: en el municipio, sin distancia). Las
gasolineras españolas de venta restringida a sus socios (cooperativas) nunca
cuentan.

## Escenas

### Precio por debajo de un umbral

Una escena normal de Gladys: disparador **Cambio de valor de un dispositivo**
sobre una función de precio, condición «menor que 1,60». Sirve para una
gasolinera y para el dispositivo del más barato.

### Bajada del precio de un carburante

El disparador de la integración: un precio baja en una gasolinera añadida en
Gladys, o en el dispositivo del más barato. Filtros: el dispositivo y los
carburantes (vacío: cualquiera). Las acciones siguientes pueden leer
`{{triggerEvent.data.fuel_name}}`, `station`, `price`, `previous_price` y
`drop` (en €). El primer precio visto tras añadir un dispositivo solo se
memoriza.

## Panel

### Widget Precios de carburantes

Los precios de una gasolinera añadida en Gladys o, por defecto, los del
dispositivo del más barato, una casilla por carburante (seis como máximo).
Detalles, que un ajuste oculta: la gasolinera y la distancia de cada precio
más bajo, o el horario de una gasolinera.

## Acciones

**Probar la lista oficial de precios**: lee la lista ahora e indica cuántas
gasolineras se encuentran y el precio más bajo.

## Datos y límites

- **España**: servicio REST del Ministerio para la Transición Ecológica
  ([Geoportal Gasolineras](https://geoportalgasolineras.es/)), actualizado cada
  30 minutos. La integración lee las provincias de sus gasolineras cada 30
  minutos, y la lista completa (12 MB, leída en flujo) una vez al día.
- **Italia**: datos abiertos del Ministerio de Empresas y del Made in Italy
  ([MIMIT](https://www.mimit.gov.it/it/open-data/elenco-dataset/carburanti-prezzi-praticati-e-anagrafica-degli-impianti)),
  dos archivos al día con los precios vigentes el día anterior a las 8:00. Se
  consultan cada 2 horas y solo se descargan si son nuevos. Sin horarios en
  esta fuente.
- Los precios son los que las gasolineras declaran a los ministerios: una
  gasolinera que declara tarde muestra un precio antiguo (vea la última
  actualización).
- Un país y una casa por instalación. Desarrollada sin gasolinera propia: se
  agradecen los comentarios.

## Solución de problemas

- **«Ningún lugar de búsqueda»**: ubique su casa en Gladys, o introduzca un
  municipio, y guarde de nuevo la configuración.
- **Ninguna gasolinera en Descubrimiento**: amplíe el radio, compruebe cómo se
  escribe el municipio (su nombre en la lista oficial: `Roma`, `Milano`) y use
  **Probar la lista oficial de precios**.
- **«No se puede leer la lista oficial de precios»**: el servidor del
  ministerio está caído o lento; la integración lo reintenta cada 30 minutos.
- Registros: `LOG_LEVEL=debug` muestra cada lectura.

## Créditos

Datos: Ministerio para la Transición Ecológica y el Reto Demográfico (España)
y Ministero delle Imprese e del Made in Italy (Italia), datos abiertos.
Inspirada en las integraciones de la comunidad de Home Assistant para estas
fuentes. Sin relación con estos ministerios.
