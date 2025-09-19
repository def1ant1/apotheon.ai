#!/usr/bin/env bash
set -euo pipefail

if ! command -v mkcert >/dev/null 2>&1; then
  echo "mkcert is not installed. Follow https://github.com/FiloSottile/mkcert#installation for platform-specific instructions." >&2
  exit 1
fi

echo "🔐 Installing mkcert root CA into local trust stores (requires admin rights on some platforms)..."
mkcert -install

echo "✅ mkcert root CA installed."
