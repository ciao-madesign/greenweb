#!/usr/bin/env bash
# Crea site/index.html (pagina completa per GitHub Pages) da site/page.html e copia le anteprime.
set -euo pipefail
cd "$(dirname "$0")/.."
cp docs/screenshots/*.png site/img/
cp icons/leaf-green-48.png site/img/leaf.png
{
  echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
  cat site/page.html
  echo '</body></html>'
} > site/index.html
echo "site/index.html pronto"
