#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -n "${TWA_DIR:-}" ]]; then
  TWA_WORKDIR="$TWA_DIR"
elif [[ -d "$ROOT_DIR/android-twa" ]]; then
  TWA_WORKDIR="$ROOT_DIR/android-twa"
elif [[ -d "$ROOT_DIR/.android-twa" ]]; then
  TWA_WORKDIR="$ROOT_DIR/.android-twa"
elif [[ -d "$ROOT_DIR/.twa-new" ]]; then
  TWA_WORKDIR="$ROOT_DIR/.twa-new"
elif [[ -d "$ROOT_DIR/.twa-build" ]]; then
  TWA_WORKDIR="$ROOT_DIR/.twa-build"
else
  TWA_WORKDIR="$ROOT_DIR/android-twa"
fi

MANIFEST_PATH="$TWA_WORKDIR/twa-manifest.json"
OUTPUT_DIR="${OUTPUT_DIR:-$ROOT_DIR/android-artifacts}"
LOCAL_HOME="${LOCAL_HOME:-$TWA_WORKDIR/.home}"
LOCAL_GRADLE="${LOCAL_GRADLE:-$TWA_WORKDIR/.gradle}"
SKIP_VERSION_UPGRADE="${SKIP_VERSION_UPGRADE:-1}"
PROJECT_NAME="${PROJECT_NAME:-}"

log() {
  printf '[android-build] %s\n' "$1"
}

fail() {
  printf '[android-build] ERROR: %s\n' "$1" >&2
  exit 1
}

command -v bubblewrap >/dev/null 2>&1 || fail "bubblewrap CLI nao encontrado. Instale com: npm i -g @bubblewrap/cli"

mkdir -p "$OUTPUT_DIR" "$LOCAL_HOME" "$LOCAL_GRADLE"

if [[ ! -f "$MANIFEST_PATH" ]]; then
  cat >&2 <<EOF
[android-build] ERROR: nao encontrei $MANIFEST_PATH

Inicialize o projeto TWA primeiro, por exemplo:
  mkdir -p "$ROOT_DIR/android-twa"
  bubblewrap init --manifest=https://shalon-saude.vercel.app/manifest.webmanifest --directory="$ROOT_DIR/android-twa"
EOF
  exit 1
fi

if [[ -z "${BUBBLEWRAP_KEYSTORE_PASSWORD:-}" ]]; then
  read -r -s -p "Keystore password: " BUBBLEWRAP_KEYSTORE_PASSWORD
  echo
fi

if [[ -z "${BUBBLEWRAP_KEY_PASSWORD:-}" ]]; then
  read -r -s -p "Key password: " BUBBLEWRAP_KEY_PASSWORD
  echo
fi

export BUBBLEWRAP_KEYSTORE_PASSWORD
export BUBBLEWRAP_KEY_PASSWORD

pushd "$TWA_WORKDIR" >/dev/null
export HOME="$LOCAL_HOME"
export GRADLE_USER_HOME="$LOCAL_GRADLE"

if [[ -z "$PROJECT_NAME" ]]; then
  PROJECT_NAME="$(basename "$TWA_WORKDIR" | sed -E 's/^[.]+//; s/[^A-Za-z0-9_-]+/-/g')"
  [[ -n "$PROJECT_NAME" ]] || PROJECT_NAME="android-twa"
fi

log "TWA dir: $TWA_WORKDIR"
log "Atualizando projeto Android a partir do twa-manifest.json"
if [[ "$SKIP_VERSION_UPGRADE" == "1" ]]; then
  bubblewrap update --manifest=./twa-manifest.json --skipVersionUpgrade
else
  bubblewrap update --manifest=./twa-manifest.json
fi

# Diretórios iniciados por "." quebram o nome default do projeto no Gradle.
# Garantimos um rootProject.name valido antes do build.
if [[ -f settings.gradle ]]; then
  if grep -q '^rootProject\.name' settings.gradle; then
    sed -i -E "s/^rootProject\\.name.*/rootProject.name = '$PROJECT_NAME'/" settings.gradle
  else
    tmp_settings="$(mktemp)"
    {
      printf "rootProject.name = '%s'\n" "$PROJECT_NAME"
      cat settings.gradle
    } >"$tmp_settings"
    mv "$tmp_settings" settings.gradle
  fi
fi

log "Gerando APK e AAB"
bubblewrap build --manifest=./twa-manifest.json

[[ -f app-release-signed.apk ]] || fail "APK nao foi gerado"
[[ -f app-release-bundle.aab ]] || fail "AAB nao foi gerado"

cp -f app-release-signed.apk "$OUTPUT_DIR/app-release-signed.apk"
cp -f app-release-bundle.aab "$OUTPUT_DIR/app-release-bundle.aab"
if [[ -f app-release-signed.apk.idsig ]]; then
  cp -f app-release-signed.apk.idsig "$OUTPUT_DIR/app-release-signed.apk.idsig"
fi
popd >/dev/null

log "Arquivos gerados:"
log "APK: $OUTPUT_DIR/app-release-signed.apk"
log "AAB: $OUTPUT_DIR/app-release-bundle.aab"
