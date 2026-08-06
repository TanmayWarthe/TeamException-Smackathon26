#!/bin/bash
# Starts a local server hosting the cloned phishing site on http://localhost:8088
PORT=8088
DIR="$(cd "$(dirname "$0")/../demo/phishing_site" && pwd)"

# Kill any existing process on PORT 8088 if running
if command -v fuser >/dev/null 2>&1; then
    fuser -k ${PORT}/tcp >/dev/null 2>&1 || true
fi

cd "$DIR" || exit 1
echo "🎣 Hosting realistic cloned campus portal on: http://localhost:${PORT}"
python3 -m http.server ${PORT}
