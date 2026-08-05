#!/bin/bash
# Starts a local server hosting the cloned phishing site on http://localhost:8088
cd "$(dirname "$0")/../demo/phishing_site"
echo "🎣 Hosting realistic cloned campus portal on: http://localhost:8088"
python3 -m http.server 8088
