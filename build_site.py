#!/usr/bin/env python3
"""Build the static GitHub Pages site and its public recipe index."""

import json
import shutil
from pathlib import Path

from server import ROOT, recipe_list


OUTPUT = ROOT / "dist"
IMAGE_EXTENSIONS = {".avif", ".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"}


def build():
    OUTPUT.mkdir(exist_ok=True)
    for filename in ("index.html", "styles.css", "app.js"):
        shutil.copy2(ROOT / filename, OUTPUT / filename)
    for path in ROOT.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in IMAGE_EXTENSIONS:
            continue
        if OUTPUT in path.parents or ".git" in path.parts:
            continue
        destination = OUTPUT / path.relative_to(ROOT)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, destination)
    recipes = recipe_list()
    (OUTPUT / "recipes.json").write_text(
        json.dumps({"recipes": recipes}, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"Site généré dans {OUTPUT} ({len(recipes)} recettes).")


if __name__ == "__main__":
    build()
