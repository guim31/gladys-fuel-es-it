# Prix des carburants Espagne et Italie

Le prix des carburants dans les stations d’**Espagne** et d’**Italie**, d’après
les données ouvertes officielles des deux gouvernements, sans compte ni clé.
Sans lien avec ces ministères.

## Ce que vous obtenez

- Les stations autour de votre maison (ou dans une commune) listées dans
  l’onglet **Découverte** : ajoutez celles que vous utilisez, chacune devient un
  appareil avec ses prix.
- Un appareil **Carburant le moins cher** : pour chaque carburant suivi, le
  prix le plus bas dans le rayon, la station et sa distance.
- Un déclencheur de scène **Baisse du prix d’un carburant** et un widget
  **Prix des carburants** pour le tableau de bord.

## Prérequis

- Gladys Assistant 5.3.0 ou plus récent.
- Un accès à Internet depuis Gladys (les sources sont les serveurs des
  ministères).
- Votre maison placée dans Gladys (**Paramètres → Maisons**), ou une commune
  dans la configuration. À l’installation, Gladys demande votre accord pour
  partager la position de la maison avec l’intégration : elle ne sert qu’à
  mesurer des distances, dans le conteneur.

## Installation

Dans Gladys, **Intégrations → Installer depuis GitHub**, adresse
`https://github.com/guim31/gladys-fuel-es-it`.

## Configuration

- **Pays** : Espagne ou Italie (un par installation).
- **Carburants à suivre** : Espagne : sans plomb 95 et 98, gazole (Gasóleo A),
  gazole premium, GPL. Italie : essence et gazole, libre-service et servi
  séparés, GPL, méthane (au kg). Seuls les carburants du pays choisi sont
  utilisés.
- **Rayon de recherche** : 1 à 30 km autour de la première maison placée dans
  Gladys (5 km par défaut).
- **Commune** (facultatif) : ses stations sont aussi listées, et sans maison
  placée le prix le plus bas y est cherché. Majuscules et accents sans
  importance (`Alcala de Henares`, `ROMA`).
- **Langue des noms** : noms des appareils et fonctionnalités, écrits une fois
  à l’ajout d’un appareil, dates et textes du déclencheur.

Ouvrez ensuite **Découverte** : l’appareil du moins cher vient en premier, puis
les stations de la plus proche (50 au plus), puis celles de la commune.

## Appareils

### Station

Un par station ajoutée : le prix de chaque carburant suivi qu’elle vend (€/l,
€/kg pour le méthane), la dernière mise à jour des prix (heure locale du pays)
et les horaires en Espagne. Une station qui vend un nouveau carburant affiche
**Mettre à jour** dans Découverte. Une station qui sort de la liste officielle
(fermée) garde ses dernières valeurs, et le widget le signale.

### Carburant le moins cher

Pour chaque carburant suivi : le prix le plus bas dans le rayon, la station et
sa distance en km (sans maison placée : dans la commune, sans distance). Les
stations espagnoles réservées à leurs membres (coopératives) ne comptent
jamais.

## Scènes

### Prix sous un seuil

Une scène Gladys ordinaire : déclencheur **Changement de valeur d’un appareil**
sur une fonctionnalité de prix, condition « inférieur à 1,60 ». Cela marche
pour une station comme pour l’appareil du moins cher.

### Baisse du prix d’un carburant

Le déclencheur de l’intégration : un prix baisse sur une station ajoutée dans
Gladys, ou sur l’appareil du moins cher. Filtres : l’appareil et les
carburants (vide : n’importe lequel). Les actions suivantes peuvent lire
`{{triggerEvent.data.fuel_name}}`, `station`, `price`, `previous_price` et
`drop` (en €). Le premier prix vu après l’ajout d’un appareil est seulement
mémorisé.

## Tableau de bord

### Widget Prix des carburants

Les prix d’une station ajoutée dans Gladys, ou par défaut ceux de l’appareil
du moins cher, une tuile par carburant (six au plus). Détails, masquables par
un réglage : la station et la distance de chaque prix le plus bas, ou les
horaires d’une station.

## Actions

**Tester la liste officielle des prix** : lit la liste tout de suite, et donne
le nombre de stations trouvées et le prix le plus bas.

## Données et limites

- **Espagne** : service REST du ministère de la Transition écologique
  ([Geoportal Gasolineras](https://geoportalgasolineras.es/)), mis à jour toutes
  les 30 minutes. L’intégration lit les provinces de vos stations toutes les
  30 minutes, et la liste complète (12 Mo, lue au fil de l’eau) une fois par
  jour.
- **Italie** : données ouvertes du ministère des Entreprises et du Made in
  Italy
  ([MIMIT](https://www.mimit.gov.it/it/open-data/elenco-dataset/carburanti-prezzi-praticati-e-anagrafica-degli-impianti)),
  deux fichiers par jour avec les prix en vigueur la veille à 8 h. Ils sont
  demandés toutes les 2 heures et téléchargés seulement s’ils sont nouveaux.
  Pas d’horaires dans cette source.
- Les prix sont ceux que les stations déclarent aux ministères : une station en
  retard sur sa déclaration montre un ancien prix (voir la dernière mise à
  jour).
- Un pays et une maison par installation. Développée sans station à soi :
  retours bienvenus.

## Dépannage

- **« Aucun lieu de recherche »** : placez votre maison dans Gladys, ou
  saisissez une commune, puis enregistrez à nouveau la configuration.
- **Aucune station dans Découverte** : élargissez le rayon, vérifiez
  l’orthographe de la commune (son nom dans la liste officielle : `Roma`,
  `Milano`), puis lancez **Tester la liste officielle des prix**.
- **« La liste officielle des prix est illisible »** : le serveur du ministère
  est en panne ou lent ; l’intégration réessaie toutes les 30 minutes.
- Journaux : `LOG_LEVEL=debug` montre chaque lecture.

## Crédits

Données : Ministerio para la Transición Ecológica y el Reto Demográfico
(Espagne) et Ministero delle Imprese e del Made in Italy (Italie), données
ouvertes. Inspirée des intégrations Home Assistant de la communauté pour ces
sources. Sans lien avec ces ministères.
