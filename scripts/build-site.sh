#!/usr/bin/env bash
# Crea site/index.html (pagina completa per GitHub Pages) da site/page.html e copia le anteprime.
set -euo pipefail
cd "$(dirname "$0")/.."
cp docs/screenshots/*.png site/img/
cp icons/leaf-green-48.png site/img/leaf.png
# Zip dell'estensione con nome stabile: il link per chi usa Chrome, Edge o Brave non dipende da una release.
mkdir -p site/download
bash scripts/package.sh >/dev/null
cp "dist/greenweb-$(node -p "require('./manifest.json').version").zip" site/download/greenweb.zip
{
  echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
  cat site/page.html
  echo '</body></html>'
} > site/index.html
echo "site/index.html pronto"
