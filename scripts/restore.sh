#!/usr/bin/env bash
set -Eeuo pipefail
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)/lib/common.sh"
LOG_CONTEXT="restore"
require_root

archive="${1:-}"
[[ -n "${archive}" && -f "${archive}" ]] || die "Usage: sudo restore.sh <archive.tar.gz>"
require_command tar
require_command systemctl
ensure_runtime_directories
"${SCRIPT_DIR}/verify-backup.sh" "${archive}" "${archive}.sha256"

# Preserve a fresh safety archive before the short maintenance window.
if [[ -f "${CATALOGUE_PATH}" ]]; then
  runuser -u "${APP_USER}" -- env \
    APP_ROOT="${APP_ROOT}" DATA_DIR="${DATA_DIR}" CATALOGUE_PATH="${CATALOGUE_PATH}" \
    UPLOAD_DIR="${UPLOAD_DIR}" BACKUP_DIR="${BACKUP_DIR}" "${SCRIPT_DIR}/backup.sh" manual
fi

stamp="$(date -u +'%Y%m%dT%H%M%SZ')"
work="$(mktemp -d "${DATA_DIR}/.restore-work/restore.XXXXXX")"
rollback="${DATA_DIR}/restore-rollback/${stamp}"
mkdir -p -- "${work}/failed" "${rollback}"
tar -xzf "${archive}" -C "${work}"
chown -R "${APP_USER}:${APP_GROUP}" "${work}" "${rollback}"
expected_fingerprint="${work}/expected-fingerprint.json"
node "${CURRENT_LINK}/scripts/persistence-fingerprint.mjs" write \
  "${work}/data/catalogue.xlsx" "${work}/data/uploads" "${expected_fingerprint}"

systemctl stop "${SERVICE_NAME}.service"
# Moves stay on the same filesystem, so rollback never depends on a partial file copy.
if [[ -e "${CATALOGUE_PATH}" ]]; then mv -- "${CATALOGUE_PATH}" "${rollback}/catalogue.xlsx"; fi
if [[ -e "${UPLOAD_DIR}" ]]; then mv -- "${UPLOAD_DIR}" "${rollback}/uploads"; fi
mv -- "${work}/data/catalogue.xlsx" "${CATALOGUE_PATH}"
mv -- "${work}/data/uploads" "${UPLOAD_DIR}"
chown -R "${APP_USER}:${APP_GROUP}" "${CATALOGUE_PATH}" "${UPLOAD_DIR}"
chmod 0640 "${CATALOGUE_PATH}"

if systemctl start "${SERVICE_NAME}.service" && health_and_ready \
  && node "${CURRENT_LINK}/scripts/persistence-fingerprint.mjs" check \
    "${CATALOGUE_PATH}" "${UPLOAD_DIR}" "${expected_fingerprint}"; then
  rm -rf -- "${work}"
  log "Restauration validée. L'état précédent reste dans ${rollback}."
  exit 0
fi

log "Échec du contrôle post-restauration; retour automatique à l'état précédent."
systemctl stop "${SERVICE_NAME}.service" || true
[[ -e "${CATALOGUE_PATH}" ]] && mv -- "${CATALOGUE_PATH}" "${work}/failed/catalogue.xlsx"
[[ -e "${UPLOAD_DIR}" ]] && mv -- "${UPLOAD_DIR}" "${work}/failed/uploads"
[[ -e "${rollback}/catalogue.xlsx" ]] && mv -- "${rollback}/catalogue.xlsx" "${CATALOGUE_PATH}"
[[ -e "${rollback}/uploads" ]] && mv -- "${rollback}/uploads" "${UPLOAD_DIR}"
systemctl start "${SERVICE_NAME}.service" || true
die "Restauration annulée; archive et état restauré inchangés. Diagnostic: ${work}"
