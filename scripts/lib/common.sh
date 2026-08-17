#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
APP_ROOT="${APP_ROOT:-/opt/jad-home}"
RELEASES_DIR="${RELEASES_DIR:-${APP_ROOT}/releases}"
CURRENT_LINK="${CURRENT_LINK:-${APP_ROOT}/current}"
DATA_DIR="${DATA_DIR:-/srv/jad-home/data}"
CATALOGUE_PATH="${CATALOGUE_PATH:-${DATA_DIR}/jad-home-catalogue.xlsx}"
UPLOAD_DIR="${UPLOAD_DIR:-${DATA_DIR}/uploads}"
BACKUP_DIR="${BACKUP_DIR:-${DATA_DIR}/backups}"
SESSION_DIR="${SESSION_DIR:-${DATA_DIR}/sessions}"
LOG_DIR="${LOG_DIR:-${DATA_DIR}/logs}"
SERVICE_NAME="${SERVICE_NAME:-jad-home}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:4000/api/health}"
READY_URL="${READY_URL:-http://127.0.0.1:4000/api/ready}"
APP_USER="${APP_USER:-jad-home}"
APP_GROUP="${APP_GROUP:-jad-home}"

log() {
  printf '%s [%s] %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "${LOG_CONTEXT:-jad-home}" "$*"
}

die() {
  log "ERREUR: $*" >&2
  exit 1
}

require_root() {
  [[ "${EUID}" -eq 0 ]] || die "Cette commande doit être exécutée avec sudo/root."
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Commande requise absente: $1"
}

resolved_path() {
  realpath -m -- "$1"
}

assert_under() {
  local candidate root
  candidate="$(resolved_path "$1")"
  root="$(resolved_path "$2")"
  [[ "${candidate}" == "${root}/"* && "${candidate}" != "${root}" ]] || die "Chemin refusé hors de ${root}: ${candidate}"
}

ensure_runtime_directories() {
  local -a runtime_paths
  runtime_paths=(
    "${DATA_DIR}" "$(dirname -- "${CATALOGUE_PATH}")" "${UPLOAD_DIR}"
    "${BACKUP_DIR}" "${SESSION_DIR}" "${LOG_DIR}" "${DATA_DIR}/.backup-work"
    "${DATA_DIR}/.restore-work" "${DATA_DIR}/restore-rollback"
  )
  if [[ "${EUID}" -eq 0 ]]; then
    install -d -m 0750 -o "${APP_USER}" -g "${APP_GROUP}" "${runtime_paths[@]}"
  else
    mkdir -p -- "${runtime_paths[@]}"
  fi
}

wait_for_url() {
  local url="$1" attempts="${2:-30}" delay="${3:-2}"
  local i
  for ((i=1; i<=attempts; i++)); do
    if curl --fail --silent --show-error --max-time 5 "${url}" >/dev/null; then
      return 0
    fi
    sleep "${delay}"
  done
  return 1
}

health_and_ready() {
  wait_for_url "${HEALTH_URL}" 30 2 && wait_for_url "${READY_URL}" 10 2
}
