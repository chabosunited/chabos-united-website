# CHABOS UNITED – einfache Cloudflare-Pages-Version

Diese Version wurde bewusst **ohne Datenbank, Docker, Prisma, Admin-Backend oder Cron-System** gebaut.

Die Website besteht aus normalen HTML/CSS/JavaScript-Dateien und zwei kleinen Cloudflare Pages Functions:

- `GET /api/ea` → lädt die FC-Clubs-Daten für **Chabos United / Club ID 5395290 / common-gen5** serverseitig von EA.
- `POST /api/application` → sendet Bewerbungen an einen geheimen Discord Webhook.

Dadurch bleibt die Website sehr einfach zu hosten und behält trotzdem Live-Daten.

## Struktur

```text
/
├─ index.html
├─ team.html
├─ results.html
├─ news.html
├─ interviews.html
├─ apply.html
├─ contact.html
├─ css/style.css
├─ js/
│  ├─ config.js
│  ├─ app.js
│  └─ pages.js
├─ data/
│  ├─ players.json
│  ├─ news.json
│  ├─ interviews.json
│  └─ ea-preview.json      # NUR lokale Vorschau
├─ assets/
│  ├─ branding/
│  ├─ backgrounds/
│  ├─ effects/
│  ├─ news/
│  ├─ players/
│  ├─ ui/
│  └─ source/              # alle gelieferten Originalassets
└─ functions/api/
   ├─ ea.js
   └─ application.js
```

## EA Live-Daten

Fest konfiguriert sind:

```text
Club: Chabos United
Club ID: 5395290
Platform: common-gen5
```

Die Website ruft EA **nicht direkt aus dem Browser** auf. Der Browser fragt `/api/ea` ab. Die Cloudflare Function fragt anschließend EA ab.

Der Provider versucht:

- Club Info
- Overall Stats
- Member Stats
- Member Career Stats
- League Matches
- Playoff Matches

Nicht vorhandene Werte werden nicht erfunden. Auf der Website erscheint dann `--` oder ein entsprechender Hinweis.

### Cache / EA-Ausfall

Die Function aktualisiert die EA-Daten ungefähr alle 10 Minuten. Eine gecachte Antwort bleibt länger im Cloudflare Cache. Falls EA bei einer Aktualisierung nicht erreichbar ist, wird – soweit noch vorhanden – der letzte Cache weitergegeben.

Damit ist keine PostgreSQL-Datenbank nötig.

## Spielerbilder und Darstellung bearbeiten

`data/players.json`

Beispiel:

```json
{
  "eaName": "MATSCHO",
  "displayName": "MATSCHO",
  "position": "ST",
  "role": "STÜRMER",
  "number": 19,
  "image": "/assets/players/hoodie-1.webp",
  "order": 1
}
```

`eaName` dient zum Zuordnen zum Namen aus der EA-Antwort. Die echten Leistungsdaten kommen weiterhin von EA.

## News bearbeiten

Datei:

```text
data/news.json
```

Bild in `assets/news/` legen und den Eintrag in der JSON-Datei ergänzen.

## Interviews bearbeiten

Datei:

```text
data/interviews.json
```

Keine Datenbank notwendig.

## Discord-Link ändern

In:

```text
js/config.js
```

steht:

```js
discordUrl: 'https://discord.gg/Jg5Mfyhg6'
```

Dort kann die URL jederzeit geändert werden.

# Lokal testen

Im Website-Ordner eine Konsole öffnen:

```powershell
python -m http.server 8080
```

Dann öffnen:

```text
http://localhost:8080
```

Da Cloudflare Pages Functions lokal bei einem einfachen Python-Server nicht laufen, gibt es ausschließlich für die lokale Designvorschau:

```text
http://localhost:8080/?preview=1
```

Dann werden Daten aus `data/ea-preview.json` verwendet. **Diese Datei wird im normalen Online-Betrieb nicht benutzt.**

# Online stellen – empfohlene Variante

## 1. GitHub Repository

Den Inhalt dieses Ordners in ein GitHub Repository hochladen, z. B.:

```text
chabos-united
```

Es werden keine geheimen Zugangsdaten im Repository benötigt.

## 2. Cloudflare Pages

Cloudflare Dashboard öffnen:

```text
Workers & Pages
→ Create application
→ Pages
→ Connect to Git
```

GitHub Repository auswählen.

Build-Einstellungen:

```text
Framework preset: None
Build command: leer lassen
Build output directory: .
```

Die Website benötigt keinen npm-Build.

## 3. Environment Variables

In Cloudflare Pages unter den Projekteinstellungen können optional gesetzt werden:

```text
EA_CLUB_ID=5395290
EA_PLATFORM=common-gen5
```

Diese Werte sind bereits als sichere Defaults im Code enthalten.

Für Bewerbungen muss zusätzlich als **Secret** gesetzt werden:

```text
DISCORD_APPLICATION_WEBHOOK=https://discord.com/api/webhooks/...
```

Der Webhook steht dadurch niemals im Frontend.

## 4. Deploy

Deployment starten. Cloudflare erkennt den Ordner `functions/` automatisch und veröffentlicht sowohl die statische Website als auch die beiden API-Funktionen.

Danach funktioniert:

```text
https://DEINE-SEITE.pages.dev/
https://DEINE-SEITE.pages.dev/api/ea?resource=all
```

## Eigene Domain

Später in Cloudflare Pages:

```text
Custom domains
→ Set up a custom domain
```

# GitHub Pages?

Die reine Website könnte auf GitHub Pages liegen, **aber `/api/ea` und das Bewerbungsformular würden dort nicht serverseitig laufen**. Für dieses Projekt ist Cloudflare Pages deshalb die deutlich einfachere Lösung: statische Website + kleine Functions im selben Projekt.

# Was nicht mehr benötigt wird

Für diese Version brauchst du **nicht**:

- Docker
- PostgreSQL
- Neon
- Prisma
- Datenbank-Migrationen
- Admin-Passwort-Hash
- AUTH_SECRET
- Cron-Secret
- einen separaten Next.js-Server
- einen separaten Cloudflare Worker

# Assets

Alle gelieferten Originaldateien wurden zusätzlich unter:

```text
assets/source/
```

beibehalten. Für die Website werden optimierte WebP-Versionen verwendet, damit die Ladezeit deutlich geringer bleibt.

# Wichtiger Hinweis zu EA

Die FC-Clubs-Endpunkte sind ein externer Provider von EA und können sich ändern oder zeitweise blockiert sein. Die Website behandelt fehlende Antworten deshalb defensiv und erzeugt keine erfundenen Produktivdaten.
