#!/usr/bin/env bash
set -euo pipefail

REPO="${OPENCLAW_OPTIMIZER_REPO:-linsheng9731/openclaw-optimizer}"
LATEST_API_URL="https://api.github.com/repos/${REPO}/releases/latest"

if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js is required (>=18)."
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "Error: Node.js >=18 is required. Current: $(node -v)"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is required."
  exit 1
fi

echo "Fetching latest release metadata from ${REPO}..."
LATEST_JSON="$(curl -fsSL -H "Accept: application/vnd.github+json" "${LATEST_API_URL}")"
LATEST_TAG="$(printf "%s" "${LATEST_JSON}" | node -e 'const fs=require("node:fs");const raw=fs.readFileSync(0,"utf8");const data=JSON.parse(raw);process.stdout.write(data.tag_name||"");')"
ASSET_URL="$(printf "%s" "${LATEST_JSON}" | node -e 'const fs=require("node:fs");const raw=fs.readFileSync(0,"utf8");const data=JSON.parse(raw);const assets=Array.isArray(data.assets)?data.assets:[];const picked=assets.find(a=>typeof a.name==="string"&&a.name.endsWith(".tgz"));process.stdout.write(picked?.browser_download_url||"");')"
ASSET_NAME="$(printf "%s" "${LATEST_JSON}" | node -e 'const fs=require("node:fs");const raw=fs.readFileSync(0,"utf8");const data=JSON.parse(raw);const assets=Array.isArray(data.assets)?data.assets:[];const picked=assets.find(a=>typeof a.name==="string"&&a.name.endsWith(".tgz"));process.stdout.write(picked?.name||"");')"

if [ -z "${LATEST_TAG}" ]; then
  echo "Error: Could not resolve latest release tag."
  exit 1
fi

if [ -z "${ASSET_URL}" ]; then
  echo "Error: Latest release ${LATEST_TAG} has no .tgz asset."
  echo "Please upload npm pack artifact (e.g. openclaw-optimizer-<version>.tgz) to the release."
  exit 1
fi

echo "Installing release ${LATEST_TAG} from asset: ${ASSET_NAME}"
npm install -g "${ASSET_URL}"

echo ""
echo "Install complete from release artifact."
echo "Try:"
echo "  openclaw-optimizer --help"
