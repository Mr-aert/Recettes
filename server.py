#!/usr/bin/env python3
"""Serve a live, dependency-free browser for the Markdown recipes."""

import hashlib
import json
import subprocess
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit


ROOT = Path(__file__).resolve().parent
POLL_INTERVAL_MS = 2000


def recipe_added_dates():
    result = subprocess.run(
        ["git", "log", "--reverse", "--find-renames", "--diff-filter=AR",
         "--format=%ct", "--name-status", "-z"],
        cwd=ROOT,
        check=True,
        capture_output=True,
    )
    added_dates = {}
    timestamp = None
    entries = result.stdout.split(b"\0")
    index = 0
    while index < len(entries):
        entry = entries[index].strip()
        index += 1
        if not entry:
            continue
        if entry.isdigit():
            timestamp = int(entry)
            continue
        status = entry.decode("utf-8")
        if status == "A":
            path = entries[index].decode("utf-8")
            index += 1
            added_dates[path] = timestamp
        elif status.startswith("R"):
            previous_path = entries[index].decode("utf-8")
            path = entries[index + 1].decode("utf-8")
            index += 2
            added_dates[path] = added_dates.pop(previous_path, timestamp)
    return added_dates


def recipe_list():
    recipes = []
    added_dates = recipe_added_dates()
    for path in ROOT.rglob("*.md"):
        relative = path.relative_to(ROOT)
        if relative == Path("README.md") or not path.is_file():
            continue
        try:
            path.resolve().relative_to(ROOT)
        except ValueError:
            continue
        parts = relative.parts
        try:
            stat = path.stat()
            content = path.read_text(encoding="utf-8")
        except (OSError, UnicodeError) as error:
            raise RuntimeError(f"Impossible de lire {relative}: {error}") from error
        title = path.stem.replace("_", " ").strip()
        recipes.append({
            "path": relative.as_posix(),
            "title": title,
            "category": parts[0] if len(parts) > 1 else "Autres",
            "subcategory": parts[-2] if len(parts) > 2 else "",
            "modified": stat.st_mtime_ns,
            "added": added_dates.get(relative.as_posix(), int(stat.st_mtime)),
            "size": stat.st_size,
            "digest": hashlib.sha256(content.encode("utf-8")).hexdigest(),
            "content": content,
        })
    return sorted(recipes, key=lambda recipe: (recipe["category"].casefold(),
                                                recipe["title"].casefold()))


class RecipeHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def _send_json(self, data, status=200):
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        request = urlsplit(self.path)
        if request.path == "/api/recipes":
            try:
                recipes = recipe_list()
            except RuntimeError as error:
                self._send_json({"error": str(error)}, status=500)
                return
            self._send_json({"pollInterval": POLL_INTERVAL_MS, "recipes": recipes})
            return
        if request.path == "/api/recipe":
            relative = parse_qs(request.query).get("path", [""])[0]
            candidate = (ROOT / relative).resolve()
            try:
                candidate.relative_to(ROOT)
            except ValueError:
                self._send_json({"error": "Chemin invalide."}, status=400)
                return
            if candidate.suffix.lower() != ".md" or not candidate.is_file():
                self._send_json({"error": "Recette introuvable."}, status=404)
                return
            try:
                content = candidate.read_text(encoding="utf-8")
            except (OSError, UnicodeError):
                self._send_json({"error": "Impossible de lire cette recette."}, status=500)
                return
            self._send_json({"content": content})
            return
        if request.path == "/":
            self.path = "/index.html"
        else:
            self.path = request.path
        super().do_GET()


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 8000), RecipeHandler)
    print("Recettes disponibles sur http://127.0.0.1:8000")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nArrêt du serveur.")
    finally:
        server.server_close()
