# Kraftstoffpreise Spanien und Italien

Die Kraftstoffpreise der Tankstellen in **Spanien** und **Italien**, aus den
offenen amtlichen Daten beider Regierungen, ohne Konto und ohne Schlüssel.
Nicht mit diesen Ministerien verbunden.

## Was du bekommst

- Die Tankstellen um dein Haus (oder in einer Gemeinde) im Reiter
  **Erkennung**: füge die hinzu, die du nutzt, jede wird ein Gerät mit ihren
  Preisen.
- Ein Gerät **Günstigster Kraftstoff**: je verfolgtem Kraftstoff der
  niedrigste Preis im Umkreis, die Tankstelle und ihre Entfernung.
- Einen Szenen-Auslöser **Kraftstoffpreis gesunken** und ein Dashboard-Widget
  **Kraftstoffpreise**.

## Voraussetzungen

- Gladys Assistant 5.3.0 oder neuer.
- Internetzugang von Gladys aus (die Quellen sind die Server der Ministerien).
- Dein Haus in Gladys verortet (**Einstellungen → Häuser**) oder eine Gemeinde
  in der Konfiguration. Bei der Installation fragt Gladys, ob die Integration
  den Standort des Hauses bekommen darf: Er dient nur dazu, Entfernungen im
  Container zu messen.

## Installation

In Gladys **Integrationen → Von GitHub installieren**, Adresse
`https://github.com/guim31/gladys-fuel-es-it`.

## Konfiguration

- **Land**: Spanien oder Italien (eins pro Installation).
- **Verfolgte Kraftstoffe**: Spanien: Super 95 und Super Plus 98, Diesel
  (Gasóleo A), Premium-Diesel, Autogas. Italien: Benzin und Diesel, SB und
  bedient getrennt, Autogas, Erdgas (pro kg). Nur die Kraftstoffe des
  gewählten Landes zählen.
- **Suchradius**: 1 bis 30 km um das erste verortete Haus in Gladys
  (standardmäßig 5 km).
- **Gemeinde** (optional): Die Tankstellen dort werden auch gelistet, und ohne
  verortetes Haus wird dort der niedrigste Preis gesucht. Groß- und
  Kleinschreibung sowie Akzente sind egal (`Alcala de Henares`, `ROMA`).
- **Sprache der Namen**: Namen der Geräte und Funktionen, einmal beim
  Hinzufügen geschrieben, Daten und Texte des Auslösers.

Öffne dann **Erkennung**: Zuerst kommt das Gerät des günstigsten Preises, dann
die Tankstellen ab der nächsten (höchstens 50), dann die der Gemeinde.

## Geräte

### Tankstelle

Eins pro hinzugefügter Tankstelle: der Preis jedes verfolgten Kraftstoffs, den
sie verkauft (€/l, €/kg für Erdgas), die letzte Preisänderung (Ortszeit des
Landes) und in Spanien die Öffnungszeiten. Verkauft eine Tankstelle einen
neuen Kraftstoff, zeigt die Erkennung **Aktualisieren**. Verlässt eine
Tankstelle die offizielle Liste (geschlossen), behält sie ihre letzten Werte,
und das Widget sagt es.

### Günstigster Kraftstoff

Je verfolgtem Kraftstoff: der niedrigste Preis im Umkreis, die Tankstelle und
ihre Entfernung in km (ohne verortetes Haus: in der Gemeinde, ohne
Entfernung). Spanische Tankstellen nur für Mitglieder (Genossenschaften)
zählen nie.

## Szenen

### Preis unter einer Schwelle

Eine normale Gladys-Szene: Auslöser **Ein Gerätewert ändert sich** auf einer
Preisfunktion, Bedingung „kleiner als 1,60“. Das geht für eine Tankstelle wie
für das Gerät des günstigsten Preises.

### Kraftstoffpreis gesunken

Der Auslöser der Integration: Ein Preis sinkt bei einer in Gladys
hinzugefügten Tankstelle oder beim Gerät des günstigsten Preises. Filter: das
Gerät und die Kraftstoffe (leer: jeder). Die folgenden Aktionen können
`{{triggerEvent.data.fuel_name}}`, `station`, `price`, `previous_price` und
`drop` (in €) lesen. Der erste Preis nach dem Hinzufügen eines Geräts wird nur
gemerkt.

## Dashboard

### Widget Kraftstoffpreise

Die Preise einer in Gladys hinzugefügten Tankstelle oder standardmäßig die des
Geräts des günstigsten Preises, eine Kachel pro Kraftstoff (höchstens sechs).
Details, per Einstellung ausblendbar: Tankstelle und Entfernung jedes
günstigsten Preises oder die Öffnungszeiten einer Tankstelle.

## Aktionen

**Offizielle Preisliste testen**: liest die Liste sofort und nennt die Zahl
der gefundenen Tankstellen und den niedrigsten Preis.

## Daten und Grenzen

- **Spanien**: REST-Dienst des Ministeriums für den ökologischen Wandel
  ([Geoportal Gasolineras](https://geoportalgasolineras.es/)), alle 30 Minuten
  aktualisiert. Die Integration liest alle 30 Minuten die Provinzen deiner
  Tankstellen und einmal am Tag die ganze Liste (12 MB, als Strom gelesen).
- **Italien**: offene Daten des Ministeriums für Unternehmen und Made in Italy
  ([MIMIT](https://www.mimit.gov.it/it/open-data/elenco-dataset/carburanti-prezzi-praticati-e-anagrafica-degli-impianti)),
  zwei Dateien am Tag mit den Preisen vom Vortag um 8:00. Die Dateien werden alle
  2 Stunden abgefragt und nur geladen, wenn sie neu sind. Keine Öffnungszeiten
  in dieser Quelle.
- Die Preise sind die, die die Tankstellen den Ministerien melden: Eine
  Tankstelle, die spät meldet, zeigt einen alten Preis (siehe letzte
  Preisänderung).
- Ein Land und ein Haus pro Installation. Ohne eigene Tankstelle entwickelt:
  Rückmeldungen willkommen.

## Fehlerbehebung

- **„Kein Suchort“**: Verorte dein Haus in Gladys oder gib eine Gemeinde ein
  und speichere die Konfiguration erneut.
- **Keine Tankstelle in der Erkennung**: Vergrößere den Radius, prüfe die
  Schreibweise der Gemeinde (ihr Name in der offiziellen Liste: `Roma`,
  `Milano`) und nutze dann **Offizielle Preisliste testen**.
- **„Die offizielle Preisliste ist gerade nicht lesbar“**: Der Server des
  Ministeriums ist ausgefallen oder langsam; die Integration versucht es alle
  30 Minuten erneut.
- Protokolle: `LOG_LEVEL=debug` zeigt jedes Lesen.

## Danksagung

Daten: Ministerio para la Transición Ecológica y el Reto Demográfico (Spanien)
und Ministero delle Imprese e del Made in Italy (Italien), offene Daten.
Angeregt durch die Home-Assistant-Integrationen der Community für diese
Quellen. Nicht mit diesen Ministerien verbunden.
