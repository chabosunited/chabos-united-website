#!/usr/bin/env python3
"""Pull the current public Cloudflare CMS overrides into local data/*.json files."""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
ORIGIN = "https://chabosunited.pages.dev"
KEYS = ("players", "news", "interviews", "site", "partners")


def main():
    print("Chabos United - Cloudflare CMS -> lokale Projektdateien")
    print(f"Quelle: {ORIGIN}")
    print()

    changed = 0
    for key in KEYS:
        url = f"{ORIGIN}/api/content?key={urllib.parse.quote(key)}"
        try:
            req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "ChabosUnitedLocalSync/1.0"})
            with urllib.request.urlopen(req, timeout=12) as response:
                payload = json.load(response)
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                print(f"- {key}: kein CMS Override vorhanden, lokale Datei bleibt unverändert")
                continue
            print(f"- {key}: HTTP Fehler {exc.code}")
            continue
        except Exception as exc:
            print(f"- {key}: Fehler: {exc}")
            continue

        if "data" not in payload:
            print(f"- {key}: ungültige Antwort")
            continue

        path = DATA_DIR / f"{key}.json"
        path.write_text(json.dumps(payload["data"], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"+ {key}: {path.relative_to(ROOT)} aktualisiert")
        changed += 1

    print()
    print(f"Fertig. {changed} Datei(en) aktualisiert.")


if __name__ == "__main__":
    main()
