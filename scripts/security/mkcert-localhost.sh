#!/usr/bin/env bash
set -euo pipefail

CERT_DIR="certs"
CERT_FILE="$CERT_DIR/localhost-cert.pem"
KEY_FILE="$CERT_DIR/localhost-key.pem"

if ! command -v mkcert >/dev/null 2>&1; then
  echo "mkcert is not installed. Run ./scripts/security/mkcert-install.sh first." >&2
  exit 1
fi

mkdir -p "$CERT_DIR"

echo "📜 Issuing localhost certificate via mkcert..."
mkcert \
  -cert-file "$CERT_FILE" \
  -key-file "$KEY_FILE" \
  localhost 127.0.0.1 ::1

echo "✅ Certificates created at $CERT_FILE and $KEY_FILE."
echo "   Point Astro dev server to them via npm run dev:https"
