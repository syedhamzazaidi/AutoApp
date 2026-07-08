#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TF_DIR="${ROOT_DIR}/infra/terraform"

export GCP_PROJECT_ID="${GCP_PROJECT_ID:-project-5be3cb47-0a28-4053-b3a}"
TF_STATE_BUCKET="${TF_STATE_BUCKET:-endian-tfstate-${GCP_PROJECT_ID:-project-5be3cb47-0a28-4053-b3a}}"
export TF_STATE_BUCKET

TF_STATE_LOCATION="${TF_STATE_LOCATION:-US}"
TF_STATE_PROJECT="${TF_STATE_PROJECT:-${GCP_PROJECT_ID}}"

for dir in "${HOME}/bin" "${HOME}/google-cloud-sdk/bin"; do
  if [[ -d "${dir}" ]]; then
    PATH="${dir}:${PATH}"
  fi
done
export PATH

if ! command -v terraform >/dev/null 2>&1; then
  echo "terraform not found in PATH. Install with: brew install terraform" >&2
  echo "  Also check: ~/bin, ~/google-cloud-sdk/bin" >&2
  exit 1
fi

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud not found in PATH. Install the Google Cloud SDK:" >&2
  echo "  https://cloud.google.com/sdk/docs/install" >&2
  echo "  Also check: ~/bin, ~/google-cloud-sdk/bin" >&2
  exit 1
fi

echo "==> Validating gcloud authentication"
if ! gcloud auth application-default print-access-token >/dev/null 2>&1; then
  echo "Authenticate locally (JSON keys are not required):" >&2
  echo "  gcloud auth application-default login" >&2
  exit 1
fi

echo "==> Ensuring Terraform state bucket gs://${TF_STATE_BUCKET}"
if ! gcloud storage buckets describe "gs://${TF_STATE_BUCKET}" --project="${TF_STATE_PROJECT}" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://${TF_STATE_BUCKET}" \
    --project="${TF_STATE_PROJECT}" \
    --location="${TF_STATE_LOCATION}" \
    --uniform-bucket-level-access
  gcloud storage buckets update "gs://${TF_STATE_BUCKET}" --versioning
  echo "Created state bucket gs://${TF_STATE_BUCKET}"
else
  echo "State bucket already exists"
fi

echo "==> Required github-deploy bootstrap roles (informational)"
REQUIRED_ROLES=(
  roles/container.admin
  roles/compute.networkAdmin
  roles/cloudsql.admin
  roles/artifactregistry.admin
  roles/iam.serviceAccountAdmin
  roles/iam.serviceAccountUser
  roles/dns.admin
  roles/storage.admin
  roles/secretmanager.admin
)
for role in "${REQUIRED_ROLES[@]}"; do
  echo "  - ${role}"
done

echo "==> terraform init"
terraform -chdir="${TF_DIR}" init \
  -backend-config="bucket=${TF_STATE_BUCKET}"

echo ""
echo "Bootstrap complete. Next:"
echo "  ./scripts/setup-github-deploy-sa.sh   # if github-deploy not set up yet"
echo "  cp infra/terraform/terraform.tfvars.example infra/terraform/terraform.tfvars"
echo "  pnpm infra:plan"
echo "  pnpm infra:apply"
