#!/usr/bin/env bash
set -Eeuo pipefail

SOURCE_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
DOMAIN="_"
HARDEN_SSH=false
ENABLE_SWAP=false
INSTALL_OCI_CLI=false
NODE_VERSION="${NODE_VERSION:-24.18.0}"

usage() {
  echo "Usage: sudo $0 [--source DIR] [--domain example.com] [--harden-ssh] [--enable-swap] [--install-oci-cli]"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source) SOURCE_DIR="$(realpath -- "$2")"; shift 2 ;;
    --domain) DOMAIN="$2"; shift 2 ;;
    --harden-ssh) HARDEN_SSH=true; shift ;;
    --enable-swap) ENABLE_SWAP=true; shift ;;
    --install-oci-cli) INSTALL_OCI_CLI=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) usage >&2; exit 2 ;;
  esac
done

[[ "${EUID}" -eq 0 ]] || { echo "Exécutez ce script avec sudo." >&2; exit 1; }
[[ -f "${SOURCE_DIR}/deploy/systemd/jad-home.service" ]] || { echo "Source invalide: ${SOURCE_DIR}" >&2; exit 1; }
[[ "${DOMAIN}" == "_" || "${DOMAIN}" =~ ^([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$ ]] || { echo "Nom de domaine invalide." >&2; exit 1; }

export DEBIAN_FRONTEND=noninteractive
# All packages below are available from Ubuntu repositories and support both target architectures.
apt-get update
apt-get install -y --no-install-recommends \
  ca-certificates curl xz-utils tar rsync jq unzip openssl acl build-essential python3 python3-venv \
  nginx certbot python3-certbot-nginx fail2ban ufw logrotate

if ! id -u jad-home >/dev/null 2>&1; then
  useradd --system --user-group --home-dir /srv/jad-home --create-home --shell /usr/sbin/nologin jad-home
fi
install -d -m 0755 -o root -g root /opt/jad-home /opt/jad-home/releases /etc/jad-home /var/www/jad-home-errors
install -d -m 0750 -o jad-home -g jad-home \
  /srv/jad-home/data /srv/jad-home/data/uploads /srv/jad-home/data/backups \
  /srv/jad-home/data/sessions /srv/jad-home/data/logs /srv/jad-home/data/.backup-work \
  /srv/jad-home/data/.restore-work /srv/jad-home/data/restore-rollback
setfacl -R -m u:www-data:rX /srv/jad-home/data/uploads
setfacl -m d:u:www-data:rX /srv/jad-home/data/uploads

machine="$(uname -m)"
case "${machine}" in
  aarch64|arm64) node_arch=arm64 ;;
  x86_64|amd64) node_arch=x64 ;;
  *) echo "Architecture non prise en charge: ${machine}" >&2; exit 1 ;;
esac
node_archive="node-v${NODE_VERSION}-linux-${node_arch}.tar.xz"
node_prefix="/opt/node-v${NODE_VERSION}-linux-${node_arch}"
if [[ ! -x "${node_prefix}/bin/node" ]]; then
  # Install the official ARM64/x64 archive only after its published SHA-256 succeeds.
  install -d -m 0755 /var/cache/jad-home-node
  cd /var/cache/jad-home-node
  curl --fail --location --remote-name "https://nodejs.org/download/release/v${NODE_VERSION}/${node_archive}"
  curl --fail --location --remote-name "https://nodejs.org/download/release/v${NODE_VERSION}/SHASUMS256.txt"
  grep " ${node_archive}$" SHASUMS256.txt | sha256sum --check --strict
  tar -xJf "${node_archive}" -C /opt
fi
for binary in node npm npx; do
  ln -sfn "${node_prefix}/bin/${binary}" "/usr/local/bin/${binary}"
done
/usr/local/bin/node --version
/usr/local/bin/npm --version

if [[ "${INSTALL_OCI_CLI}" == true ]]; then
  if [[ ! -x /opt/oci-cli/bin/oci ]]; then
    python3 -m venv /opt/oci-cli
    /opt/oci-cli/bin/pip install --upgrade pip oci-cli
  fi
  ln -sfn /opt/oci-cli/bin/oci /usr/local/bin/oci
fi

chmod 0755 "${SOURCE_DIR}"/scripts/*.sh
chmod 0644 "${SOURCE_DIR}/scripts/lib/common.sh"
install -m 0644 "${SOURCE_DIR}"/deploy/systemd/*.service "${SOURCE_DIR}"/deploy/systemd/*.timer /etc/systemd/system/
install -m 0644 "${SOURCE_DIR}/deploy/logrotate/jad-home" /etc/logrotate.d/jad-home
install -m 0644 "${SOURCE_DIR}/deploy/journald/99-jad-home.conf" /etc/systemd/journald.conf.d/99-jad-home.conf
install -m 0644 "${SOURCE_DIR}/deploy/fail2ban/jail.local" /etc/fail2ban/jail.d/jad-home.local
install -m 0644 "${SOURCE_DIR}/deploy/nginx/503.html" /var/www/jad-home-errors/503.html
install -m 0644 "${SOURCE_DIR}/deploy/nginx/security-headers.conf" /etc/nginx/snippets/jad-home-security.conf

nginx_conf=/etc/nginx/sites-available/jad-home
sed "s/__DOMAIN__/${DOMAIN}/g" "${SOURCE_DIR}/deploy/nginx/jad-home.conf" > "${nginx_conf}"
ln -sfn "${nginx_conf}" /etc/nginx/sites-enabled/jad-home
rm -f /etc/nginx/sites-enabled/default

env_file=/etc/jad-home/jad-home.env
if [[ ! -f "${env_file}" ]]; then
  install -m 0600 -o root -g root "${SOURCE_DIR}/.env.production.example" "${env_file}"
  secret="$(openssl rand -hex 32)"
  sed -i "s|REMPLACEZ_PAR_64_CARACTERES_ALEATOIRES|${secret}|" "${env_file}"
  if [[ "${DOMAIN}" != "_" ]]; then
    sed -i "s|https://example.com|https://${DOMAIN}|" "${env_file}"
    sed -i "s|admin@example.com|admin@${DOMAIN}|" "${env_file}"
  fi
fi
chmod 0600 "${env_file}"
chown root:root "${env_file}"

if [[ "${ENABLE_SWAP}" == true ]]; then
  if [[ ! -f /swapfile ]]; then
    fallocate -l 2G /swapfile
    chmod 0600 /swapfile
    mkswap /swapfile
  fi
  swapon /swapfile || true
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
nginx -t
systemctl daemon-reload
systemctl restart systemd-journald
systemctl enable --now nginx.service fail2ban.service
systemctl enable jad-home.service jad-home-backup.timer jad-home-weekly-backup.timer jad-home-monitor.timer

if [[ "${HARDEN_SSH}" == true ]]; then
  login_user="${SUDO_USER:-ubuntu}"
  [[ -s "/home/${login_user}/.ssh/authorized_keys" ]] || {
    echo "Clé SSH non confirmée pour ${login_user}; durcissement refusé." >&2
    exit 1
  }
  install -m 0644 "${SOURCE_DIR}/deploy/ssh/99-jad-home-hardening.conf" /etc/ssh/sshd_config.d/99-jad-home-hardening.conf
  sshd -t
  systemctl reload ssh.service
fi

echo
echo "Bootstrap terminé. Éditez ${env_file}, remplacez ADMIN_PASSWORD_HASH, configurez OCI, puis lancez:"
echo "  sudo bash ${SOURCE_DIR}/scripts/deploy.sh ${SOURCE_DIR}"
