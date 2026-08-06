#!/bin/bash
# Starts a local server hosting the cloned phishing site on http://localhost:8088
PORT=8088
DIR="$(cd "$(dirname "$0")/../demo/phishing_site" && pwd)"

# Check if port is already running
if command -v fuser >/dev/null 2>&1; then
    fuser -k ${PORT}/tcp >/dev/null 2>&1
elif command -v kill >/dev/null 2>&1; then
    PID=$(ss -tulpn 2>/dev/null | grep ":${PORT} " | grep -o 'pid=[0-9]*' | cut -d= -f2)
    if [ -n "$PID" ]; then
        kill -9 "$PID" 2>/dev/null
    fi
fi

cd "$DIR" || exit 1
echo "🎣 Hosting realistic cloned campus portal on: http://localhost:${PORT}"
python3 -m http.server ${PORT}

