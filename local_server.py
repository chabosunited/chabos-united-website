#!/usr/bin/env python3
"""Local development server for Chabos United.

Unlike ``python -m http.server``, this server also gives the local Admin Panel
permission to persist CMS changes into the project files themselves.

Endpoints (localhost only):
  GET    /api/local/content?key=players
  POST   /api/local/content
  DELETE /api/local/content
  POST   /api/local/upload
"""

from __future__ import annotations

import base64
import json
import mimetypes
import os
import re
import tempfile
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
ALLOWED_CONTENT_KEYS = {"players", "news", "interviews", "site", "partners"}
MAX_UPLOAD_BYTES = 8 * 1024 * 1024
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".avif", ".svg"}


def send_json(handler: SimpleHTTPRequestHandler, payload, status: int = 200) -> None:
    raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(raw)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(raw)


def read_json_body(handler: SimpleHTTPRequestHandler):
    try:
        length = int(handler.headers.get("Content-Length", "0"))
    except ValueError:
        length = 0
    if length <= 0 or length > MAX_UPLOAD_BYTES * 2:
        return None
    try:
        return json.loads(handler.rfile.read(length).decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None


def safe_content_key(value) -> str | None:
    key = str(value or "").strip()
    return key if key in ALLOWED_CONTENT_KEYS else None


def atomic_write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        os.replace(tmp_name, path)
    finally:
        if os.path.exists(tmp_name):
            os.unlink(tmp_name)


def safe_filename(name: str) -> str:
    name = Path(name or "image").name
    stem = re.sub(r"[^a-zA-Z0-9_-]+", "-", Path(name).stem).strip("-") or "image"
    ext = Path(name).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        ext = ".webp" if ext == "" else ""
    return stem[:80] + ext


class ChabosHandler(SimpleHTTPRequestHandler):
    server_version = "ChabosLocalCMS/2.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/local/content":
            key = safe_content_key(parse_qs(parsed.query).get("key", [""])[0])
            if not key:
                return send_json(self, {"error": "Invalid key"}, 400)
            path = DATA_DIR / f"{key}.json"
            if not path.exists():
                return send_json(self, {"data": None}, 200)
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                return send_json(self, {"error": "JSON file could not be read"}, 500)
            return send_json(self, {"data": data, "source": f"data/{key}.json"}, 200)

        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)

        if parsed.path == "/api/local/content":
            body = read_json_body(self)
            key = safe_content_key(body.get("key") if isinstance(body, dict) else None)
            if not key or not isinstance(body, dict) or "data" not in body:
                return send_json(self, {"error": "Invalid payload"}, 400)
            try:
                atomic_write_json(DATA_DIR / f"{key}.json", body["data"])
            except OSError as exc:
                return send_json(self, {"error": f"Could not write JSON: {exc}"}, 500)
            return send_json(self, {"ok": True, "key": key, "file": f"data/{key}.json"}, 200)

        if parsed.path == "/api/local/upload":
            body = read_json_body(self)
            if not isinstance(body, dict):
                return send_json(self, {"error": "Invalid upload payload"}, 400)

            folder = str(body.get("folder") or "uploads").strip().lower()
            folder = "partners" if folder == "partners" else "uploads"
            filename = safe_filename(str(body.get("filename") or "image"))
            if not filename or Path(filename).suffix.lower() not in ALLOWED_EXTENSIONS:
                return send_json(self, {"error": "Only PNG, JPG, WEBP, AVIF and SVG are allowed"}, 415)

            encoded = str(body.get("dataBase64") or "")
            try:
                raw = base64.b64decode(encoded, validate=True)
            except Exception:
                return send_json(self, {"error": "Invalid base64 file data"}, 400)

            if not raw or len(raw) > MAX_UPLOAD_BYTES:
                return send_json(self, {"error": "Maximum file size is 8 MB"}, 413)

            target_dir = ROOT / "assets" / ("partners/uploads" if folder == "partners" else "uploads")
            target_dir.mkdir(parents=True, exist_ok=True)
            target_name = f"{int(time.time() * 1000)}-{filename}"
            target = target_dir / target_name

            try:
                target.write_bytes(raw)
            except OSError as exc:
                return send_json(self, {"error": f"Could not write image: {exc}"}, 500)

            relative = target.relative_to(ROOT).as_posix()
            return send_json(self, {"ok": True, "url": relative, "file": relative}, 200)

        return send_json(self, {"error": "Unknown local endpoint"}, 404)

    def do_DELETE(self):
        parsed = urlparse(self.path)
        if parsed.path != "/api/local/content":
            return send_json(self, {"error": "Unknown local endpoint"}, 404)

        body = read_json_body(self)
        key = safe_content_key(body.get("key") if isinstance(body, dict) else None)
        if not key:
            return send_json(self, {"error": "Invalid key"}, 400)

        path = DATA_DIR / f"{key}.json"
        try:
            if path.exists():
                path.unlink()
        except OSError as exc:
            return send_json(self, {"error": f"Could not delete file: {exc}"}, 500)
        return send_json(self, {"ok": True, "key": key}, 200)

    def log_message(self, fmt, *args):
        print(f"[Chabos Local CMS] {self.address_string()} - {fmt % args}")


def main():
    host = "127.0.0.1"
    port = 5500
    print("============================================================")
    print(" CHABOS UNITED - LOCAL FILE CMS")
    print("============================================================")
    print(f" Website: http://localhost:{port}/")
    print(f" Contact: http://localhost:{port}/contact.html")
    print(" Local admin password: admin")
    print("")
    print(" CMS changes are written directly into data/*.json.")
    print(" Local image uploads are written into assets/partners/uploads")
    print(" or assets/uploads.")
    print("")
    print(" Press CTRL+C to stop.")
    print("============================================================")

    server = ThreadingHTTPServer((host, port), ChabosHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
