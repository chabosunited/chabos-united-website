# Chabos United Website — GitHub Pages + Cloudflare Pages

Diese Version ist so angepasst, dass **dieselbe Codebasis gleichzeitig auf GitHub Pages und Cloudflare Pages** funktioniert.

## Live-Daten

- Club: **Chabos United**
- EA Club ID: **5395290**
- Platform: **common-gen5**
- Cloudflare API: `/api/ea?resource=all`

Auf Cloudflare Pages laufen die Dateien unter `functions/api/` direkt als Pages Functions.
GitHub Pages kann keine Server-Funktionen ausführen. Deshalb erkennt `js/config.js` automatisch `github.io` und verwendet dann:

`https://chabos-united-website.pages.dev/api/ea?resource=all`

Dadurch funktionieren auf GitHub Pages trotzdem die EA-Livedaten.

## Was für die Doppel-Kompatibilität geändert wurde

- Alle CSS-, JS-, Bild-, JSON- und internen Seitenpfade sind relativ.
- Keine Root-Pfade wie `/assets/...`, die unter einem GitHub-Projektpfad kaputtgehen.
- `_redirects` wurde entfernt, damit Cloudflare nicht in einen Pretty-URL-Redirect-Loop gerät.
- `.nojekyll` wurde für GitHub Pages hinzugefügt.
- GitHub Pages verwendet Cloudflare automatisch als EA-/Bewerbungs-Backend.
- `functions/api/application.js` besitzt CORS-Unterstützung für das Bewerbungsformular auf GitHub Pages.
- EA-Request-Header enthalten den funktionierenden EA.com-Origin/Referer-Fix.
- Player-Mapping erfolgt nur noch über exakte `eaNames`; kein zufälliges `members[i]`-Fallback mehr.

## GitHub hochladen

Den **Inhalt dieses Ordners** in das Repository `chabosunited/chabos-united-website` hochladen und vorhandene Dateien überschreiben.

Wichtig: Eine eventuell noch vorhandene `_redirects` im Repository löschen.

Danach unter GitHub:

1. Repository → **Settings**
2. **Pages**
3. Source: `Deploy from a branch`
4. Branch: `main`
5. Folder: `/ (root)`
6. Save

GitHub-Version:

`https://chabosunited.github.io/chabos-united-website/`

## Cloudflare Pages

GitHub-Repository weiterhin mit Cloudflare Pages verbunden lassen.

Build-Einstellungen:

- Framework: `None`
- Build command: `exit 0`
- Build output directory: `.`
- Production branch: `main`

Optional unter **Variables and Secrets**:

- `EA_CLUB_ID=5395290`
- `EA_PLATFORM=common-gen5`

Cloudflare-Version:

`https://chabos-united-website.pages.dev/`

EA-Test:

`https://chabos-united-website.pages.dev/api/ea?resource=all`

## Discord-Bewerbungen

In Cloudflare unter **Settings → Variables and Secrets** als Secret setzen:

`DISCORD_APPLICATION_WEBHOOK=https://discord.com/api/webhooks/...`

Das Secret niemals in GitHub eintragen.

Auf GitHub Pages wird das Bewerbungsformular automatisch an die Cloudflare-Function gesendet.

## Spieler mit EA verknüpfen

Datei: `data/players.json`

Beispiel:

```json
{
  "eaNames": ["MATSCHO63"],
  "displayName": "MATSCHO",
  "position": "ST",
  "role": "STÜRMER",
  "number": 19,
  "image": "assets/players/hoodie-1.webp",
  "order": 1
}
```

`displayName` ist der Name auf der Website. `eaNames` enthält den exakten EA-Namen.
Wenn kein exakter EA-Treffer existiert, zeigt die Website `--` statt Statistiken eines anderen Spielers.

## Wichtige Dateien

- `index.html` — Homepage
- `css/style.css` — komplettes Design
- `js/config.js` — Host-/API-Erkennung
- `js/app.js` — Homepage + EA-Daten
- `js/pages.js` — Team, Results, News, Interviews, Apply
- `data/players.json` — Spielerdarstellung
- `data/news.json` — News
- `data/interviews.json` — Interviews
- `functions/api/ea.js` — EA Proxy/Cache für Cloudflare
- `functions/api/application.js` — Discord-Bewerbungen

## Hinweis zu GitHub Pages

GitHub Pages zeigt die Seiten mit `.html`-URLs, zum Beispiel:

- `team.html`
- `results.html`
- `news.html`

Cloudflare kann dieselben Dateien zusätzlich als Pretty URLs darstellen. Die internen Links verwenden bewusst `.html`, damit beide Hosts mit identischem Code funktionieren.
