#!/usr/bin/env bash
# One-time setup for headless screenshots of Math RPG.
# Reuses the system Firefox; only needs Python 3 + network access.
set -euo pipefail
cd "$(dirname "$0")"

GECKO_VER="v0.37.0"
GECKO_URL="https://github.com/mozilla/geckodriver/releases/download/${GECKO_VER}/geckodriver-${GECKO_VER}-linux64.tar.gz"

echo "==> creating venv + installing selenium"
python3 -m venv venv
./venv/bin/pip install --quiet --upgrade pip selenium

if [ ! -x ./geckodriver ]; then
  echo "==> fetching geckodriver ${GECKO_VER}"
  python3 -c "import urllib.request; urllib.request.urlretrieve('${GECKO_URL}','gd.tar.gz')"
  tar xzf gd.tar.gz && rm -f gd.tar.gz
fi

echo "==> done. capture screens with:"
echo "    .verify/venv/bin/python .verify/shots.py"
