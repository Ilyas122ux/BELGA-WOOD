#!/usr/bin/env bash
set -Eeuo pipefail
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)/lib/common.sh"
LOG_CONTEXT="notify"

unit="${1:-unknown-unit}"
message="JAD HOME alert: ${unit} failed on $(hostname) at $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
logger -p daemon.err -t jad-home "${message}"
if [[ -n "${OCI_NOTIFICATION_TOPIC_ID:-}" ]] && command -v oci >/dev/null 2>&1; then
  auth_args=()
  [[ "${OCI_CLI_AUTH:-instance_principal}" == "instance_principal" ]] && auth_args+=(--auth instance_principal)
  oci ons message publish "${auth_args[@]}" --topic-id "${OCI_NOTIFICATION_TOPIC_ID}" \
    --title "JAD HOME failure" --body "${message}" >/dev/null
else
  log "Notification OCI non configurée; alerte écrite dans journald uniquement."
fi
