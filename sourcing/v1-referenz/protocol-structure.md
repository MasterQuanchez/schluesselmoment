# Hausübergabe Protocol Structure

This document contains the complete structure extracted from the original 11-page Word document protocol template.

## Protocol Types

The app supports three protocol types:
1. **Übergabeprotokoll** - Handover protocol (tenant moving IN)
2. **Abnahmeprotokoll** - Return protocol (tenant moving OUT, Mietvertragsende)
3. **Bestandsaufnahme** - Inventory/condition assessment

## Page 1: Header & Setup

### Kontierung (Accounting Checkboxes)
**For Übergabe:**
- EnBW
- Meldebehörde
- Kaution
- An Mieter/Betreuer per E-Mail
- Scannen

**For Abnahme:**
- Adresse
- Bank
- EnBW
- Kaution
- An Mieter/Betreuer per E-Mail
- Scannen

### Protocol Metadata
- Protokoll vom: [Date]
- erstellt von: [Creator name]

### Objektkurzbeschreibung (Property Details)
| Field | Description |
|-------|-------------|
| Straße und Nr. | Street and number |
| PLZ/Ort | Postal code / City |
| Stockwerk | Floor level |
| Zimmeranzahl | Number of rooms |
| Heizungsart | Heating type |

### Property Features
- Elektro unter Putz: Ja / Nein
- Wintergarten / Balkon / Terrasse / Loggia: Ja / Nein
- Sonstiges: [Free text]

### Mieter (Tenant Information)
Up to 3 tenants can be recorded:
1. Name, Adresse alt/neu, Tel-Nr., E-Mail
2. Name, Adresse alt/neu, Tel-Nr.
3. Name, Adresse alt/neu, Tel-Nr.

### Vermieter (Landlord Information)
- Name and contact details

---

## Page 2: Küche (Kitchen)

### Standard Room Elements
| Element | Inspection Points |
|---------|-------------------|
| **Wände** | Anstrich: Neu/Alt, Putz/Tapete: Neu/Alt, welche: [text], Schäden: Ja/Nein, welche: [text] |
| **Fliesenspiegel** | Schäden: Ja/Nein, welche: [text] |
| **Decke** | Anstrich: Neu/Alt, Putz/Tapete: Neu/Alt, welche: [text], Schäden: Ja/Nein, welche: [text] |
| **Fenster** | Rollladen: Ja/Nein, Glas: einfach/doppelt verglast, Material: Kunststoff/Holz, Anstrich: Neu/Alt, Schäden: Ja/Nein, welche: [text] |
| **Tür/Rahmen** | Anstrich: Neu/Alt, Schäden: Ja/Nein, welche: [text] |
| **Fußboden** | Art: PVC/Fliesen/Laminat/Parkett, Schäden: Ja/Nein, welche: [text] |
| **Heizkörper** | Anzahl: [number], Anstrich: Neu/Alt, Schäden: Ja/Nein, welche: [text] |

### Küchengeräte vorhanden (Kitchen Appliances)
Checkboxes for:
- Backofen
- Ceranfeld
- Herd
- Kühlschrank
- Gefrierschrank
- Mikrowelle
- Dunstabzug
- Spüle
- Spülmaschine
- Theke
- Backblech
- Boiler
- Oberschränke: ___ Stück
- Unterschränke: ___ Stück

### Additional Fields
- Sonstiges: [Free text]
- Zustand: [Free text]

### Prüfungen (Inspections)
- Sauberkeit
- Stockflecken
- Silikonverfugungen ☐
- Funktion: Wasserhähne, Lichter ☐

---

## Page 3: Bad/WC/Dusche (Bathroom)

### Standard Room Elements
Same structure as kitchen for:
- Wände
- Fliesenspiegel
- Decke
- Fenster
- Tür/Rahmen
- Fußboden (Art: PVC / Fliesen)

### Heizkörper (Radiator)
- Anzahl: [number]
- Anstrich: Neu/Alt
- Art: Handtuchheizkörper / "normaler" Heizkörper / Elektroheizkörper
- Schäden: Ja/Nein

### Badeinrichtungen (Bathroom Fixtures)
- _x Waschbecken
- Dusche ☐
- Duschabtrennung/Stange ☐
- Badewanne ☐
- WC ☐
- Spiegel ☐
- _x Handtuchhaken
- _x Handtuchhalter
- Glasablage ☐
- Klopapierhalter ☐
- _x Lampen/Spots

### Prüfungen (Inspections)
- Sauberkeit
- Stockflecken
- **Kalkfilm auf Duschfliesen** (highlighted)
- Silikonverfugungen ☐
- Funktion: Wasserhähne, Duschkopf, Lichter ☐

---

## Page 4: Gäste-Bad/separates WC + Flur

### Gäste-Bad/separates WC
Same structure as main bathroom with all elements.

### Flur (Hallway)
Standard room elements:
- Wände
- Decke
- Fußboden (Art: PVC/Fliesen/Parkett/Holzdielen/Laminat/Teppich)
- Heizkörper
- Sonstiges

---

## Pages 5-6: Zimmer (Rooms)

### Erfassung der Zimmer
> "Erfassung der Zimmer links beginnend im Uhrzeigersinn"
> (Recording rooms starting from the left, clockwise)

### Zimmer 1, 2, 3 Structure
Each room includes:
| Element | Inspection Points |
|---------|-------------------|
| Wände | Anstrich: Neu/Alt, Putz/Tapete: Neu/Alt, Schäden: Ja/Nein |
| Decke | Anstrich: Neu/Alt, Putz/Tapete: Neu/Alt, Schäden: Ja/Nein |
| Fenster | Rollladen: Ja/Nein, Glas: einfach/doppelt verglast, Material: Kunststoff/Holz, Anstrich: Neu/Alt, Schäden: Ja/Nein |
| Tür/Rahmen | Anstrich: Neu/Alt, Schäden: Ja/Nein |
| Fußboden | Art: PVC/Fliesen/Parkett/Holzdielen/Laminat/Teppich, Schäden: Ja/Nein |
| Heizkörper | Anzahl, Anstrich: Neu/Alt, Schäden: Ja/Nein |
| Sonstiges | Free text |

### Additional Elements (Page 6)

#### Eingangstür (Entrance Door)
- Anstrich: Neu/Alt
- Schäden: Ja/Nein

#### Sprechanlage (Intercom)
- Vorhanden: Ja/Nein
- Funktion: Ja/Nein

#### Keller (Basement)
- Lage: 1.UG / 2.UG
- Wegbeschreibung: [text]
- Nr.: [number]
- Beschriftung: Ja/Nein
- Zustand: [text]

#### Briefkasten (Mailbox)
- Lage: [text]
- Schlüssel-Nr.: [text]
- Zustand: [text]
- Beschriftung: Ja/Nein

---

## Page 7: Balkon/Terrasse + Required Checks

### Balkon/Veranda/Terrasse/Wintergarten
| Element | Inspection Points |
|---------|-------------------|
| Wände | Anstrich: Neu/Alt, Schäden: Ja/Nein |
| Bodenbelag | PVC/Fliesen/Estrich/Holz/Beton, Schäden: Ja/Nein |
| Brüstung | Anstrich: Neu/Alt, Schäden: Ja/Nein |
| Außenlampe | Ja/Nein |
| Sonstiges | Free text |

### Folgende Prüfungen sind vorzunehmen (Required Checks)
1. In der Wohnung dürfen sich keine Restgegenstände des Mieters befinden, wie z.B. Putzzeug, Toilettenbürste, Seifen, Duschvorhänge, Rollos, Regale, Lampen, Vorhangstangen usw. - Erledigt: ☐
2. Therme: Füllschlauch vorhanden - Ja/Nein
3. Rechnung Wartung/Reinigung für die letzten 12 Monate vorgelegt - Ja/Nein
4. Baufassungen - Anzahl: [number]
5. Rauchwarmelder - Anzahl: [number]
6. Treppenhaus, Bühne, Kellerflure, Hof usw. nach Sperrmüll des Mieters kontrollieren - Erledigt: ☐

### Treppenhaus (Stairwell)
- Zustand: Alt/Neu
- Kurzinformation: [text]

### Sonstige Anmerkung zu den aufgeführten Räumen
[Large free text area]

---

## Page 8: Zählerstände & Kaution

### Zählerstände (Meter Readings)
| Meter Type | Fields |
|------------|--------|
| Gas-Zähler (2x) | Nr., Stand (m³), Ort? |
| Strom-Zähler (2x) | Nr., Stand (kWh), Ort? |
| Wasser-Zähler (3x) | Nr., Stand (m³), Ort? |
| Wärme-Zähler | Nr., Stand (kWh), Ort? |
| Heizkostenvert. (3x) | Nr., Stand, Ort? |

> "Der Mieter bestätigt ausdrücklich, dass er o.g. Zählerstände gemeinsam mit dem Verwalter/Vermieter abgelesen hat."

### Kaution (Deposit)

#### For Übergabe:
- Kaution bereits eingegangen/erhalten: Ja/Nein
- Wenn ja: Bar / Sparbuch / Bürgschaft / Überweisung
- Wenn nein: Eingang bis [date]

#### For Abnahme:
- Art der Kaution: [text]
- Betrag: [amount]
- Die Kaution wird auf folgende Bankverbindung ausgezahlt:
  - IBAN: [text]
  - BIC: [text]
  - Kontoinhaber: [text]
- Folgender Gesamt-/Teilbetrag wird zurückgehalten: [amount]
- Grund: [text]

> "Der Vermieter behält sich vor, vorerst weitere Beträge zurückzuhalten."

---

## Page 9: Schlüssel & Mängel

### Schlüssel (Keys)
| Key Type | Nr. | Anzahl |
|----------|-----|--------|
| Wohnungstürschlüssel | | |
| Haustürschlüssel | | |
| Zimmertürenschlüssel | | |
| Kellerschlüssel | | |
| Briefkastenschlüssel | | |
| [Additional rows] | | |

> "Hiermit bestätigt der Mieter, dass sich außer den hier festgehaltenen Schlüsseln keine weiteren Schlüssel in seinem Besitz befinden oder befanden."

### Mängel (Defects)
> "Folgende Mängel werden bis zum __________ vom Mieter beseitigt:"

[Large free text area for listing defects]

### Ausschluss des deklaratorischen Schuldanerkenntnisses
> "Es wird ausdrücklich darauf hingewiesen, dass sich der Vermieter bzw. Verwalter vorbehält, Mängel und Schäden, die erst nach der Abnahme bekannt werden, gegenüber dem ausscheidenden Mieter geltend zu machen."

### Signatures
- Stuttgart, [date]
- Vermieter/in: ____________
- Mieter/in: ____________ (multiple lines for multiple tenants)

---

## Pages 10-11: Meldung des Wohnungsgebers

### Meldung des Wohnungsgebers nach §19 Meldegesetz (BMG)

**AN:** Landeshauptstadt Stuttgart, Amt für öffentliche Ordnung - Meldestelle -

**TELEFAX Übertragungsnummer:** 0711-216 98601

#### Fields
- Datum: [date]
- Eigentümer: [name]
- Wohnungsgeber (vertreten durch): [name]
- Adresse: [text]
- Wohnung: [text]
- Lage: [text]

#### Person Table
| Einzug | Auszug |
|--------|--------|
| Name(n), Vorname(n) | Name(n), Vorname(n) |
| [rows for entries] | [rows for entries] |

- Einzug am: [date]
- Auszug zum: [date]

> "Wir bestätigen den Ein- bzw. Auszug der oben genannten Person(en) in die oben bezeichnete Wohnung und dass wir als Wohnungsgeber oder als beauftragte Person diese Bescheinigung ausstellen dürfen."

> "Mit freundlichen Grüßen"

[Signature line]

---

## Data Model Summary

### Property Configuration
```
PropertyConfig {
  address: string
  postalCode: string
  city: string
  floor: string
  roomCount: number
  heatingType: string
  hasElektroUnterPutz: boolean
  hasBalcony: boolean
  hasTerrace: boolean
  hasWintergarten: boolean
  hasLoggia: boolean
  hasKitchen: boolean
  hasBathtub: boolean
  hasShower: boolean
  hasGuestWC: boolean
  hasBasement: boolean
}
```

### Room Types
1. Küche (Kitchen) - with appliances
2. Bad/WC/Dusche (Bathroom) - with fixtures
3. Gäste-Bad/separates WC (Guest bathroom)
4. Flur (Hallway)
5. Zimmer 1-n (Rooms)
6. Balkon/Terrasse/Wintergarten
7. Keller (Basement)
8. Eingangstür (Entry door)
9. Treppenhaus (Stairwell)

### Standard Room Inspection Points
- Wände (Walls): condition, paint age, wallpaper type, damages
- Decke (Ceiling): condition, paint age, damages
- Fenster (Windows): blinds, glass type, material, condition, damages
- Tür/Rahmen (Door/Frame): condition, damages
- Fußboden (Floor): type, condition, damages
- Heizkörper (Radiator): count, condition, damages

