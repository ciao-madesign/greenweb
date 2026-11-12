#!/usr/bin/env bash
# Crea lo zip dell'estensione (Chrome/Edge/Brave/Firefox) in dist/.
set -euo pipefail
cd "$(dirname "$0")/.."
version=$(node -p "require('./manifest.json').version")
mkdir -p dist
out="dist/digital-footprint-counter-${version}.zip"
rm -f "$out"
zip -qr "$out" manifest.json src modules data locales dashboard methodology privacy options icons LICENSE README.md -x '*.DS_Store'
echo "$out ($(du -h "$out" | cut -f1))"
