#!/usr/bin/env bash
# scripts/setup_hosts.sh - Adds simulated phishing domains to /etc/hosts for realistic browser URL presentation

echo "========================================================================"
echo "🛡️ CTIP Demo Setup: Adding Realistic Phishing Domains to /etc/hosts"
echo "========================================================================"

DOMAINS=(
  "ycce-student-auth.xyz"
  "sbi-onlinesbi-verification.xyz"
  "github-login-authentication.net"
  "amazon-security-update.xyz"
  "google-account-verify.online"
)

for dom in "${DOMAINS[@]}"; do
  if ! grep -q "$dom" /etc/hosts; then
    echo "127.0.0.1   $dom" | sudo tee -a /etc/hosts >/dev/null
    echo "  ✅ Added mapping: 127.0.0.1 -> $dom"
  else
    echo "  ℹ️ Already mapped in /etc/hosts: $dom"
  fi
done

echo "========================================================================"
echo "✨ Success! You can now open these URLs directly in your browser:"
echo "   • http://ycce-student-auth.xyz:8088/ycce.html"
echo "   • http://sbi-onlinesbi-verification.xyz:8088/sbi.html"
echo "   • http://github-login-authentication.net:8088/github.html"
echo "   • http://amazon-security-update.xyz:8088/amazon.html"
echo "   • http://google-account-verify.online:8088/google.html"
echo "========================================================================"
