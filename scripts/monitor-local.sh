#!/usr/bin/env bash
set -Eeuo pipefail
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)/lib/common.sh"
LOG_CONTEXT="monitor"

require_command curl
require_command systemctl
systemctl is-active --quiet "${SERVICE_NAME}.service" || die "Service ${SERVICE_NAME} inactif."
systemctl is-active --quiet nginx.service || die "Nginx inactif."
curl --fail --silent --show-error --max-time 5 "${HEALTH_URL}" >/dev/null || die "Health check en échec."
curl --fail --silent --show-error --max-time 10 "${READY_URL}" >/dev/null || die "Readiness en échec."

# The public monitor covers the Internet path; this local check covers data-volume pressure.
disk_usage="$(df -P "${DATA_DIR}" | awk 'NR==2 {gsub(/%/, "", $5); print $5}')"
[[ "${disk_usage}" =~ ^[0-9]+$ ]] || die "Utilisation disque illisible."
(( disk_usage < 75 )) || die "Disque à ${disk_usage}% (seuil 75%)."

latest_daily="$(find "${BACKUP_DIR}" -maxdepth 1 -type f -name 'jad-home-daily-*.tar.gz' -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -n 1 | cut -d' ' -f2-)"
if [[ -n "${latest_daily}" ]]; then
  age="$(( $(date +%s) - $(stat -c %Y "${latest_daily}") ))"
  (( age <= 129600 )) || die "Dernière sauvegarde quotidienne âgée de plus de 36 heures."
else
  die "Aucune sauvegarde quotidienne trouvée."
fi
log "Contrôles locaux réussis (disque ${disk_usage}%)."
