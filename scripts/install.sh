#!/usr/bin/env bash
set -euo pipefail

REPO="${OPENCLAW_OPTIMIZER_REPO:-linsheng9731/openclaw-optimizer}"
LATEST_API_URL="https://api.github.com/repos/${REPO}/releases/latest"
RELEASES_API_URL="https://api.github.com/repos/${REPO}/releases?per_page=20"
TMP_DIR=""

cleanup() {
  if [ -n "${TMP_DIR}" ] && [ -d "${TMP_DIR}" ]; then
    rm -rf "${TMP_DIR}"
  fi
}

trap cleanup EXIT

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

if ! command -v tar >/dev/null 2>&1; then
  echo "Error: tar is required."
  exit 1
fi

echo "Fetching latest release metadata from ${REPO}..."
LATEST_JSON=""
if LATEST_JSON="$(curl -fsSL -H "Accept: application/vnd.github+json" "${LATEST_API_URL}" 2>/dev/null)"; then
  :
fi

LATEST_TAG="$(printf "%s" "${LATEST_JSON}" | node -e 'const fs=require("node:fs");const raw=fs.readFileSync(0,"utf8");if(!raw){process.exit(0)};const data=JSON.parse(raw);process.stdout.write(data.tag_name||"");')"
if [ -z "${LATEST_TAG}" ]; then
  echo "Primary lookup failed; trying releases list..."
  RELEASES_JSON=""
  if RELEASES_JSON="$(curl -fsSL -H "Accept: application/vnd.github+json" "${RELEASES_API_URL}" 2>/dev/null)"; then
    RELEASE_PICKED="$(printf "%s" "${RELEASES_JSON}" | node -e 'const fs=require("node:fs");const raw=fs.readFileSync(0,"utf8");if(!raw){process.stdout.write("{}");process.exit(0)};const list=JSON.parse(raw);const picked=Array.isArray(list)?list.find(r=>r&&r.draft!==true&&r.prerelease!==true&&typeof r.tag_name==="string"&&r.tag_name.length>0):null;process.stdout.write(JSON.stringify(picked||{}));')"
    LATEST_TAG="$(printf "%s" "${RELEASE_PICKED}" | node -e 'const fs=require("node:fs");const raw=fs.readFileSync(0,"utf8");const data=JSON.parse(raw||"{}");process.stdout.write(data.tag_name||"");')"
    if [ -n "${LATEST_TAG}" ]; then
      LATEST_JSON="${RELEASE_PICKED}"
    fi
  fi
fi

ASSET_URL="$(printf "%s" "${LATEST_JSON}" | node -e 'const fs=require("node:fs");const raw=fs.readFileSync(0,"utf8");if(!raw){process.exit(0)};const data=JSON.parse(raw);const assets=Array.isArray(data.assets)?data.assets:[];const picked=assets.find(a=>typeof a.name==="string"&&a.name.endsWith(".tgz"));process.stdout.write(picked?.browser_download_url||"");')"
ASSET_NAME="$(printf "%s" "${LATEST_JSON}" | node -e 'const fs=require("node:fs");const raw=fs.readFileSync(0,"utf8");if(!raw){process.exit(0)};const data=JSON.parse(raw);const assets=Array.isArray(data.assets)?data.assets:[];const picked=assets.find(a=>typeof a.name==="string"&&a.name.endsWith(".tgz"));process.stdout.write(picked?.name||"");')"

if [ -z "${LATEST_TAG}" ]; then
  echo "Error: Could not resolve latest release tag via latest endpoint or releases list."
  exit 1
fi

if [ -n "${ASSET_URL}" ]; then
  echo "Installing release ${LATEST_TAG} from asset: ${ASSET_NAME}"
  npm install -g "${ASSET_URL}"
else
  echo "No .tgz asset found on release ${LATEST_TAG}; falling back to source tarball build."
  TMP_DIR="$(mktemp -d)"
  ARCHIVE_PATH="${TMP_DIR}/source.tar.gz"
  curl -fsSL -o "${ARCHIVE_PATH}" "https://codeload.github.com/${REPO}/tar.gz/refs/tags/${LATEST_TAG}"
  tar -xzf "${ARCHIVE_PATH}" -C "${TMP_DIR}"
  SRC_DIR="$(find "${TMP_DIR}" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
  if [ -z "${SRC_DIR}" ] || [ ! -d "${SRC_DIR}" ]; then
    echo "Error: Could not unpack source archive for ${LATEST_TAG}."
    exit 1
  fi
  cd "${SRC_DIR}"
  npm install
  npm run build
  npm pack >/dev/null
  BUILT_TGZ="$(find "${SRC_DIR}" -maxdepth 1 -type f -name "*.tgz" | head -n 1)"
  if [ -z "${BUILT_TGZ}" ] || [ ! -f "${BUILT_TGZ}" ]; then
    echo "Error: Failed to build release package."
    exit 1
  fi
  npm install -g "${BUILT_TGZ}"
fi

echo ""
echo "Install complete from release artifact."
echo "Try:"
echo "  openclaw-optimizer --help"
echo "  openclaw-skill-stats --help"
