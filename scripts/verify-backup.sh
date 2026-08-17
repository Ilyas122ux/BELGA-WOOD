#!/usr/bin/env bash
set -Eeuo pipefail
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)/lib/common.sh"
LOG_CONTEXT="verify-backup"

archive="${1:-}"
[[ -n "${archive}" && -f "${archive}" ]] || die "Usage: verify-backup.sh <archive.tar.gz> [checksum.sha256]"
checksum="${2:-${archive}.sha256}"
require_command sha256sum
require_command tar
require_command node

if [[ -f "${checksum}" ]]; then
  (cd -- "$(dirname -- "${archive}")" && sha256sum --check --status "$(basename -- "${checksum}")") \
    || die "Somme SHA-256 invalide."
else
  log "AVERTISSEMENT: fichier de somme absent; vérification structurelle seulement."
fi

while IFS= read -r member; do
  [[ "${member}" != /* && "${member}" != ".." && "${member}" != ../* \
    && "${member}" != */../* && "${member}" != */.. ]] || die "Archive dangereuse: ${member}"
done < <(tar -tzf "${archive}")

work_root="${DATA_DIR}/.restore-work"
mkdir -p -- "${work_root}"
work="$(mktemp -d "${work_root}/verify.XXXXXX")"
trap 'rm -rf -- "${work}"' EXIT
tar -xzf "${archive}" -C "${work}"
[[ -f "${work}/data/catalogue.xlsx" ]] || die "Catalogue absent de l'archive."
validator="${CURRENT_LINK}/scripts/validate-catalogue.mjs"
[[ -f "${validator}" ]] || validator="${SCRIPT_DIR}/validate-catalogue.mjs"
node "${validator}" "${work}/data/catalogue.xlsx" >/dev/null
[[ -f "${work}/manifest.json" ]] || die "Manifest absent."
upload_count="$(find "${work}/data/uploads" -type f 2>/dev/null | wc -l | tr -d ' ')"
log "Archive valide: $(basename -- "${archive}") (${upload_count} fichier(s) uploadé(s))."
