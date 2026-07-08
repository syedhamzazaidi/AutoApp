#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TF_DIR="${ROOT_DIR}/infra/terraform"
OVERLAY_DIR="${ROOT_DIR}/infra/k8s/overlays/prod"

APPLY_TERRAFORM="${APPLY_TERRAFORM:-true}"
DEPLOY_K8S="${DEPLOY_K8S:-true}"

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

if [[ "${APPLY_TERRAFORM}" == "true" ]]; then
  echo "==> terraform apply"
  terraform -chdir="${TF_DIR}" apply -auto-approve
fi

echo "==> render prod kustomize from terraform outputs"
"${ROOT_DIR}/scripts/render-kustomize-prod.sh"

if [[ "${DEPLOY_K8S}" == "true" ]]; then
  CLUSTER_NAME="$(terraform -chdir="${TF_DIR}" output -raw gke_cluster_name)"
  CLUSTER_LOCATION="$(terraform -chdir="${TF_DIR}" output -raw gke_location)"
  PROJECT_ID="$(terraform -chdir="${TF_DIR}" output -raw project_id)"

  echo "==> gcloud container clusters get-credentials ${CLUSTER_NAME}"
  gcloud container clusters get-credentials "${CLUSTER_NAME}" \
    --zone "${CLUSTER_LOCATION}" \
    --project "${PROJECT_ID}"

  echo "==> kubectl apply -k overlays/prod"
  kubectl apply -k "${OVERLAY_DIR}"
fi

echo "infra-apply finished"
