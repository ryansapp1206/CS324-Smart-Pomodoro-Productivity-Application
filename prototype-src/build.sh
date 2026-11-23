#!/usr/bin/env bash
# Builds the single-file prototype from src/.
# Usage: ./prototype-src/build.sh   →   writes docs/index.html (the page GitHub Pages serves)
set -euo pipefail
cd "$(dirname "$0")"

# Order matters: later files use things defined in earlier ones.
SCRIPTS=(
  src/js/01-core.js
  src/js/02-copy.js
  src/js/03-theme-engine.js
  src/themes/01-boring.js
  src/themes/02-brainrot.js
  src/js/04-shop.js
  src/js/05-data.js
  src/js/06-app.js
  src/js/07-actions.js
  src/js/08-components.js
  src/js/09-screens-auth.js
  src/js/10-screens-main.js
  src/js/11-render.js
  src/js/12-prototype.js
)
STYLES=(src/styles/prototype.css src/styles/app.css)

python3 - "${#STYLES[@]}" "${STYLES[@]}" "${SCRIPTS[@]}" <<'PY'
import sys
count = int(sys.argv[1])
styles, scripts = sys.argv[2:2 + count], sys.argv[2 + count:]

def bundle(paths):
    parts = []
    for path in paths:
        parts.append(f"/* ---------- {path} ---------- */\n" + open(path, encoding="utf-8").read().rstrip() + "\n")
    return "\n".join(parts)

html = open("src/index.template.html", encoding="utf-8").read()
html = html.replace("/*__STYLES__*/", bundle(styles)).replace("/*__SCRIPTS__*/", bundle(scripts))
open("../docs/index.html", "w", encoding="utf-8").write(html)
PY
echo "Built docs/index.html"
