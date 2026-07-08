#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TF_DIR="${ROOT_DIR}/infra/terraform"
NAMESPACE="${NAMESPACE:-endian-platform}"
SECRET_NAME="${SECRET_NAME:-platform-secrets}"
SM_SECRET="${SM_SECRET:-endian-platform-db-password}"

for dir in "${HOME}/bin" "${HOME}/google-cloud-sdk/bin"; do
  if [[ -d "${dir}" ]]; then
    PATH="${dir}:${PATH}"
  fi
done
export PATH

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud is required" >&2
  exit 1
fi

if ! command -v kubectl >/dev/null 2>&1; then
  echo "kubectl is required" >&2
  exit 1
fi

PROJECT_ID="$(terraform -chdir="${TF_DIR}" output -raw project_id)"
CLOUD_SQL="$(terraform -chdir="${TF_DIR}" output -raw cloud_sql_connection_name)"

PASS="$(gcloud secrets versions access latest --secret="${SM_SECRET}" --project="${PROJECT_ID}")"
ENCODED_PASS="$(
  python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.stdin.read().strip(), safe=''))" <<<"${PASS}"
)"
DATABASE_URL="postgresql://endian:${ENCODED_PASS}@/endian?host=/cloudsql/${CLOUD_SQL}"

echo "Patching ${SECRET_NAME}.DATABASE_URL in ${NAMESPACE} (Cloud SQL unix socket, private IP proxy)"
kubectl patch secret "${SECRET_NAME}" -n "${NAMESPACE}" \
  -p "{\"stringData\":{\"DATABASE_URL\":\"${DATABASE_URL}\"}}"
