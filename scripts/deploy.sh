#!/usr/bin/env bash
set -Eeuo pipefail
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)/lib/common.sh"
LOG_CONTEXT="deploy"
require_root
require_command npm
require_command rsync
require_command systemctl

source_dir="$(realpath -- "${1:-$(cd -- "${SCRIPT_DIR}/.." && pwd -P)}")"
[[ -f "${source_dir}/package-lock.json" && -f "${source_dir}/server/storage/jad-home-catalogue.xlsx" ]] \
  || die "Source JAD HOME invalide: ${source_dir}"
install -d -m 0755 -o root -g root "${APP_ROOT}" "${RELEASES_DIR}"
ensure_runtime_directories

if [[ -f "${CATALOGUE_PATH}" ]]; then
  # Releases never contain mutable production data; the existing data is backed up in place.
  runuser -u "${APP_USER}" -- env \
    APP_ROOT="${APP_ROOT}" DATA_DIR="${DATA_DIR}" CATALOGUE_PATH="${CATALOGUE_PATH}" \
    UPLOAD_DIR="${UPLOAD_DIR}" BACKUP_DIR="${BACKUP_DIR}" "${SCRIPT_DIR}/backup.sh" manual
else
  cp -- "${source_dir}/server/storage/jad-home-catalogue.xlsx" "${CATALOGUE_PATH}"
  rsync -a -- "${source_dir}/server/storage/uploads/" "${UPLOAD_DIR}/"
  chown -R "${APP_USER}:${APP_GROUP}" "${CATALOGUE_PATH}" "${UPLOAD_DIR}"
  chmod 0640 "${CATALOGUE_PATH}"
fi

stamp="$(date -u +'%Y%m%dT%H%M%SZ')"
staging="${RELEASES_DIR}/.staging-${stamp}"
release="${RELEASES_DIR}/${stamp}"
assert_under "${staging}" "${RELEASES_DIR}"
trap 'if [[ -n "${staging:-}" && -d "${staging}" ]]; then rm -rf -- "${staging}"; fi' EXIT
install -d -m 0755 -o "${APP_USER}" -g "${APP_GROUP}" "${staging}"
rsync -a --delete \
  --exclude '.git/' --exclude '.env' --exclude 'node_modules/' --exclude 'dist/' \
  --exclude 'server/storage/' --exclude '*.log' -- "${source_dir}/" "${staging}/"
chown -R "${APP_USER}:${APP_GROUP}" "${staging}"
chmod 0755 "${staging}"/scripts/*.sh
chmod 0644 "${staging}/scripts/lib/common.sh"
if command -v setfacl >/dev/null 2>&1; then
  setfacl -R -m u:www-data:rX "${UPLOAD_DIR}"
  setfacl -m d:u:www-data:rX "${UPLOAD_DIR}"
fi

run_app() { runuser -u "${APP_USER}" -- bash -lc "cd \"${staging}\" && $*"; }
run_app "npm ci --include=dev"
run_app "npm run typecheck"
run_app "npm run lint"
run_app "npm test"
run_app "npm run build"
run_app "npm prune --omit=dev"
node "${staging}/scripts/validate-catalogue.mjs" "${CATALOGUE_PATH}" >/dev/null

mv -- "${staging}" "${release}"
staging=""
runuser -u "${APP_USER}" -- env \
  APP_ROOT="${APP_ROOT}" CURRENT_LINK="${release}" DATA_DIR="${DATA_DIR}" \
  CATALOGUE_PATH="${CATALOGUE_PATH}" UPLOAD_DIR="${UPLOAD_DIR}" BACKUP_DIR="${BACKUP_DIR}" \
  "${release}/scripts/backup.sh" daily
previous=""
[[ -L "${CURRENT_LINK}" ]] && previous="$(readlink -f -- "${CURRENT_LINK}")"
fingerprint="${DATA_DIR}/.deploy-fingerprint-${stamp}.json"
# Stop writes for the few seconds needed to prove data equality across the symlink switch.
systemctl stop "${SERVICE_NAME}.service" || true
node "${release}/scripts/persistence-fingerprint.mjs" write "${CATALOGUE_PATH}" "${UPLOAD_DIR}" "${fingerprint}"
next_link="${APP_ROOT}/.current-${stamp}"
ln -s -- "${release}" "${next_link}"
mv -Tf -- "${next_link}" "${CURRENT_LINK}"

if systemctl start "${SERVICE_NAME}.service" && health_and_ready \
  && node "${release}/scripts/persistence-fingerprint.mjs" check "${CATALOGUE_PATH}" "${UPLOAD_DIR}" "${fingerprint}"; then
  rm -f -- "${fingerprint}"
  systemctl enable --now jad-home-backup.timer jad-home-weekly-backup.timer jad-home-monitor.timer
  log "Déploiement validé: ${release}"
else
  log "Échec post-déploiement; rollback automatique."
  if [[ -n "${previous}" && -d "${previous}" ]]; then
    rollback_link="${APP_ROOT}/.rollback-${stamp}"
    ln -s -- "${previous}" "${rollback_link}"
    mv -Tf -- "${rollback_link}" "${CURRENT_LINK}"
    systemctl restart "${SERVICE_NAME}.service" || true
    health_and_ready || true
  else
    systemctl stop "${SERVICE_NAME}.service" || true
  fi
  rm -f -- "${fingerprint}"
  die "Le nouvel exécutable n'a pas passé les contrôles; données persistantes préservées."
fi

current="$(readlink -f -- "${CURRENT_LINK}")"
mapfile -t old_releases < <(find "${RELEASES_DIR}" -mindepth 1 -maxdepth 1 -type d ! -name '.staging-*' -printf '%f\n' | sort -r | tail -n +6)
for old in "${old_releases[@]}"; do
  candidate="${RELEASES_DIR}/${old}"
  [[ "$(realpath -m -- "${candidate}")" == "${current}" ]] && continue
  assert_under "${candidate}" "${RELEASES_DIR}"
  rm -rf -- "${candidate}"
done
