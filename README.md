# Chabos United Website — Cloudflare Pages + GitHub Pages + Admin CMS

Diese Version verwendet dieselbe statische Website auf Cloudflare Pages und GitHub Pages. Cloudflare stellt zusätzlich EA-Proxy, Admin-CMS und optionale Bild-Uploads bereit.

## Live-Adressen

- Cloudflare: `https://chabosunited.pages.dev/`
- GitHub Pages: `https://chabosunited.github.io/chabos-united-website/`
- EA API Test: `https://chabosunited.pages.dev/api/ea?resource=all`

`js/config.js` erkennt GitHub Pages automatisch und verwendet dort `https://chabosunited.pages.dev` als Backend.

## EA Club

- Club: Chabos United
- Club ID: `5395290`
- Platform: `common-gen5`

Cloudflare Variables:

- `EA_CLUB_ID=5395290`
- `EA_PLATFORM=common-gen5`

## Admin Panel

Das Admin Panel ist nicht in der Navigation verlinkt.

1. `contact.html` öffnen.
2. Unten links auf `© 2026 CHABOS UNITED.` klicken.
3. Admin-Passwort eingeben.
4. Danach öffnet sich `admin.html`.

Der Trigger existiert nur auf der Kontaktseite.

### Cloudflare Secrets

Unter **Workers & Pages → chabosunited → Settings → Variables and Secrets**:

- `ADMIN_PASSWORD` — Secret
- `ADMIN_SESSION_SECRET` — Secret, mindestens etwa 32 zufällige Zeichen

### Cloudflare KV

KV Namespace erstellen und als Binding an das Pages-Projekt hängen:

- Binding name: `CHABOS_CMS`

Darin werden online gespeichert:

- Spieler / Team
- Player-Card-Werte
- News
- Interviews
- Website-Texte und Links
- Social Links
- Partner
- Partner-Logo-URLs

Die statischen JSON-Dateien in `data/` bleiben Fallback.

### Cloudflare R2 für Uploads

Optional. Für direkte Online-Bild-Uploads einen R2 Bucket als Binding verbinden:

- Binding name: `CHABOS_MEDIA`

Ohne R2 können weiterhin externe Bild-URLs oder vorhandene Asset-Pfade eingetragen werden.

## Player Card Werte

Im Admin Panel unter **TEAM → Spieler bearbeiten** gibt es jetzt:

- PAC
- SHO
- PAS
- DRI
- DEF
- PHY

Diese Werte werden als `cardStats` im Spieler-Datensatz gespeichert. Ein manueller Wert hat Priorität. Bleibt ein Feld leer, versucht die Website weiterhin einen passenden EA-Wert; wenn keiner vorhanden ist, erscheint `--`.

Beispiel:

```json
{
  "displayName": "MATSCHO63",
  "cardStats": {
    "pac": 90,
    "sho": 88,
    "pas": 83,
    "dri": 91,
    "def": 45,
    "phy": 82
  }
}
```

## Partner Logos

Unter **PARTNER** kann jeder Partner besitzen:

- Name
- Untertitel
- Partner-Webseite
- Logo-Pfad oder externe Bild-URL
- direkten Logo-Upload

Auf der Website wird ein vorhandenes Logo automatisch proportional in die Partnerleiste eingepasst (`object-fit: contain`). Fehlt ein Logo, wird weiterhin der Text angezeigt.

### Lokale Partner-Uploads

Beim lokalen File-CMS werden Partner-Logos gespeichert unter:

`assets/partners/uploads/`

Andere lokale Admin-Bild-Uploads landen unter:

`assets/uploads/`

## Wichtig: lokales Speichern direkt in den Code

Der alte Preview-Modus hat Änderungen nur in `localStorage` gespeichert. Diese Version enthält deshalb einen eigenen lokalen Server.

### Start

Unter Windows:

1. Projektordner öffnen.
2. `start_server.bat` doppelklicken.
3. Website: `http://localhost:5500/`
4. Kontaktseite: `http://localhost:5500/contact.html`
5. Lokales Admin-Passwort: `admin`

**Nicht VS Code Live Server verwenden**, wenn Änderungen direkt in Projektdateien geschrieben werden sollen.

Der Server schreibt Admin-Änderungen sofort in:

- `data/players.json`
- `data/news.json`
- `data/interviews.json`
- `data/site.json`
- `data/partners.json`

Damit sind die Änderungen echte Dateien in deinem Projekt und nicht nur Browser-Daten.

### Warum das online anders ist

Eine deployte Cloudflare-/GitHub-Website kann aus Sicherheits- und Hostinggründen nicht direkt Dateien auf deinem PC verändern. Online speichert das Admin Panel daher in KV/R2. Lokal kann der mitgelieferte `local_server.py` dagegen direkt in den Projektordner schreiben.

## GitHub Pages

GitHub Pages besitzt selbst kein Backend. EA- und CMS-Anfragen werden über `https://chabosunited.pages.dev` ausgeführt.

## Cloudflare Pages Build

Für dieses statische Projekt:

- Framework: None
- Production branch: `main`
- Build command: leer bzw. `exit 0`
- Output directory: `.` / Projektroot

## Wichtige Dateien

- `index.html` — Homepage
- `admin.html` — Admin Dashboard
- `contact.html` — geheimer Admin-Login-Trigger
- `css/style.css` — Website Design
- `css/admin.css` — Admin Design
- `js/config.js` — Host-/Backend-Erkennung
- `js/global.js` — Socials, Partner und globale CMS-Einstellungen
- `js/app.js` — Homepage + EA-Daten + Player Cards
- `js/pages.js` — Unterseiten
- `js/admin.js` — Admin CRUD + lokale Dateispeicherung
- `local_server.py` — lokaler Schreibserver
- `start_server.bat` — startet den lokalen Schreibserver
- `functions/api/admin.js` — Admin Login + KV-Schreibzugriffe
- `functions/api/content.js` — öffentliche CMS-Lese-API
- `functions/api/media.js` — R2 Upload/Media-Ausgabe

## Online-CMS Änderungen in lokale JSON-Dateien übernehmen

Wenn du Änderungen im **online** Admin Panel auf `chabosunited.pages.dev` vorgenommen hast, kann Cloudflare aus technischen Gründen nicht direkt auf deinen PC schreiben.

Dafür liegt zusätzlich bei:

`sync_cms_to_local.bat`

Doppelklick darauf lädt die aktuellen öffentlichen CMS-Daten von Cloudflare und schreibt sie in die lokalen `data/*.json` Dateien. So kannst du den Online-CMS-Stand anschließend mit GitHub committen.
