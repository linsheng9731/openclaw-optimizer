#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js is required (>=18)."
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "Error: Node.js >=18 is required. Current: $(node -v)"
  exit 1
fi

if command -v pnpm >/dev/null 2>&1; then
  PM="pnpm"
elif command -v npm >/dev/null 2>&1; then
  PM="npm"
else
  echo "Error: pnpm or npm is required."
  exit 1
fi

echo "Using package manager: $PM"

if [ "$PM" = "pnpm" ]; then
  pnpm install
  pnpm run build
else
  npm install
  npm run build
fi

echo ""
echo "Install complete."
echo "Try:"
echo "  npm run skill-stats -- --help"
