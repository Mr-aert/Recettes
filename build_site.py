#!/usr/bin/env python3
"""Build the static GitHub Pages site and its public recipe index."""

import json
import shutil
from pathlib import Path

from server import ROOT, recipe_list


OUTPUT = ROOT / "dist"


def build():
    OUTPUT.mkdir(exist_ok=True)
    for filename in ("index.html", "styles.css", "app.js"):
        shutil.copy2(ROOT / filename, OUTPUT / filename)
    recipes = recipe_list()
    (OUTPUT / "recipes.json").write_text(
        json.dumps({"recipes": recipes}, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"Site généré dans {OUTPUT} ({len(recipes)} recettes).")


if __name__ == "__main__":
    build()
