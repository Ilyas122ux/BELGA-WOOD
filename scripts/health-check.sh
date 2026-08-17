#!/usr/bin/env bash
set -Eeuo pipefail
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)/lib/common.sh"
LOG_CONTEXT="health-check"
require_command curl

health_and_ready || die "Les endpoints health/readiness ne répondent pas correctement."
log "Application saine et prête."
