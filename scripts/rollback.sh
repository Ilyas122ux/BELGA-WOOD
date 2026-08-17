#!/usr/bin/env bash
set -Eeuo pipefail
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)/lib/common.sh"
LOG_CONTEXT="rollback"
require_root
require_command systemctl
[[ -L "${CURRENT_LINK}" ]] || die "Aucun déploiement courant."

current="$(readlink -f -- "${CURRENT_LINK}")"
target="${1:-}"
if [[ -n "${target}" ]]; then
  [[ "${target}" == /* ]] || target="${RELEASES_DIR}/${target}"
  target="$(realpath -- "${target}")"
else
  while IFS= read -r candidate; do
    candidate="${RELEASES_DIR}/${candidate}"
    if [[ "$(realpath -- "${candidate}")" != "${current}" ]]; then target="${candidate}"; break; fi
  done < <(find "${RELEASES_DIR}" -mindepth 1 -maxdepth 1 -type d ! -name '.staging-*' -printf '%f\n' | sort -r)
fi
[[ -n "${target}" && -d "${target}" ]] || die "Aucune version précédente disponible."
assert_under "${target}" "${RELEASES_DIR}"

runuser -u "${APP_USER}" -- env \
  APP_ROOT="${APP_ROOT}" DATA_DIR="${DATA_DIR}" CATALOGUE_PATH="${CATALOGUE_PATH}" \
  UPLOAD_DIR="${UPLOAD_DIR}" BACKUP_DIR="${BACKUP_DIR}" "${SCRIPT_DIR}/backup.sh" manual
stamp="$(date -u +'%Y%m%dT%H%M%SZ')"
link="${APP_ROOT}/.rollback-${stamp}"
ln -s -- "${target}" "${link}"
mv -Tf -- "${link}" "${CURRENT_LINK}"
if systemctl restart "${SERVICE_NAME}.service" && health_and_ready; then
  log "Rollback validé vers ${target}."
  exit 0
fi

log "Rollback invalide; remise en place de ${current}."
link="${APP_ROOT}/.rollback-revert-${stamp}"
ln -s -- "${current}" "${link}"
mv -Tf -- "${link}" "${CURRENT_LINK}"
systemctl restart "${SERVICE_NAME}.service" || true
die "Rollback annulé."
