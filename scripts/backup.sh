#!/usr/bin/env bash
set -Eeuo pipefail
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)/lib/common.sh"
LOG_CONTEXT="backup"

kind="${1:-daily}"
[[ "${kind}" =~ ^(daily|weekly|manual)$ ]] || die "Type attendu: daily, weekly ou manual."
require_command tar
require_command sha256sum
require_command cp
require_command node
[[ -f "${CATALOGUE_PATH}" ]] || die "Catalogue absent: ${CATALOGUE_PATH}"
ensure_runtime_directories

# Work only below the persistent data volume, then publish the archive with one atomic rename.
stamp="$(date -u +'%Y%m%dT%H%M%SZ')"
archive="${BACKUP_DIR}/jad-home-${kind}-${stamp}.tar.gz"
work="$(mktemp -d "${DATA_DIR}/.backup-work/run.XXXXXX")"
cleanup() {
  status=$?
  rm -rf -- "${work}"
  rm -f -- "${archive}.partial"
  if (( status != 0 )); then
    log "ÉCHEC de la sauvegarde ${kind} (code ${status})."
  fi
  exit "${status}"
}
trap cleanup EXIT
mkdir -p -- "${work}/data/uploads"
cp --preserve=mode,timestamps -- "${CATALOGUE_PATH}" "${work}/data/catalogue.xlsx"
cp -a -- "${UPLOAD_DIR}/." "${work}/data/uploads/"

validator="${CURRENT_LINK}/scripts/validate-catalogue.mjs"
[[ -f "${validator}" ]] || validator="${SCRIPT_DIR}/validate-catalogue.mjs"
node "${validator}" "${work}/data/catalogue.xlsx" >/dev/null
upload_count="$(find "${work}/data/uploads" -type f | wc -l | tr -d ' ')"
catalogue_sha="$(sha256sum "${work}/data/catalogue.xlsx" | awk '{print $1}')"
printf '{\n  "schema": 1,\n  "created_at": "%s",\n  "kind": "%s",\n  "catalogue_sha256": "%s",\n  "upload_files": %s\n}\n' \
  "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "${kind}" "${catalogue_sha}" "${upload_count}" > "${work}/manifest.json"

tar -czf "${archive}.partial" -C "${work}" manifest.json data
mv -- "${archive}.partial" "${archive}"
(cd -- "${BACKUP_DIR}" && sha256sum "$(basename -- "${archive}")" > "$(basename -- "${archive}").sha256")
"${SCRIPT_DIR}/verify-backup.sh" "${archive}" "${archive}.sha256"

keep=14
[[ "${kind}" == "weekly" ]] && keep=8
mapfile -t old_archives < <(find "${BACKUP_DIR}" -maxdepth 1 -type f -name "jad-home-${kind}-*.tar.gz" -printf '%f\n' | sort -r | tail -n "+$((keep + 1))")
for old in "${old_archives[@]}"; do
  [[ -n "${old}" ]] || continue
  rm -f -- "${BACKUP_DIR}/${old}" "${BACKUP_DIR}/${old}.sha256"
done

if [[ "${kind}" == "weekly" ]]; then
  # Instance principals avoid API keys on disk; each remote archive travels with its checksum.
  [[ -n "${OCI_BACKUP_BUCKET:-}" ]] || die "Sauvegarde locale créée mais OCI_BACKUP_BUCKET n'est pas configuré."
  require_command oci
  require_command jq
  auth_args=()
  [[ "${OCI_CLI_AUTH:-instance_principal}" == "instance_principal" ]] && auth_args+=(--auth instance_principal)
  namespace_args=()
  [[ -n "${OCI_NAMESPACE:-}" ]] && namespace_args+=(--namespace-name "${OCI_NAMESPACE}")
  object_name="weekly/${stamp}/$(basename -- "${archive}")"
  checksum_name="${object_name}.sha256"
  oci os object put "${auth_args[@]}" "${namespace_args[@]}" --bucket-name "${OCI_BACKUP_BUCKET}" \
    --name "${object_name}" --file "${archive}" --force >/dev/null
  oci os object put "${auth_args[@]}" "${namespace_args[@]}" --bucket-name "${OCI_BACKUP_BUCKET}" \
    --name "${checksum_name}" --file "${archive}.sha256" --force >/dev/null
  oci os object head "${auth_args[@]}" "${namespace_args[@]}" --bucket-name "${OCI_BACKUP_BUCKET}" \
    --name "${object_name}" >/dev/null
  mapfile -t remote_old < <(oci os object list "${auth_args[@]}" "${namespace_args[@]}" \
    --bucket-name "${OCI_BACKUP_BUCKET}" --prefix weekly/ --all \
    | jq -r '[.data[] | select(.name | endswith(".tar.gz"))] | sort_by(."time-created") | reverse | .[8:][]?.name')
  for object in "${remote_old[@]}"; do
    if [[ -n "${object}" ]]; then
      oci os object delete "${auth_args[@]}" "${namespace_args[@]}" \
        --bucket-name "${OCI_BACKUP_BUCKET}" --name "${object}" --force >/dev/null
      oci os object delete "${auth_args[@]}" "${namespace_args[@]}" \
        --bucket-name "${OCI_BACKUP_BUCKET}" --name "${object}.sha256" --force >/dev/null || true
    fi
  done
  log "Copie distante confirmée: ${object_name}"
fi

log "Sauvegarde terminée: ${archive}"
