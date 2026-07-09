#!/usr/bin/env bash
# Ensure github-deploy SA exists for local Terraform/bootstrap and CI (WIF).
# CI authenticates via Workload Identity Federation — see infra/README.md.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

GCP_PROJECT_ID="${GCP_PROJECT_ID:-project-5be3cb47-0a28-4053-b3a}"

GITHUB_DEPLOY_SA_ID="${GITHUB_DEPLOY_SA_ID:-github-deploy}"
GITHUB_DEPLOY_SA_DISPLAY_NAME="${GITHUB_DEPLOY_SA_DISPLAY_NAME:-GitHub deploy (local bootstrap + CI)}"
# Path is historical; file contains the github-deploy SA key.
GITHUB_DEPLOY_SA_KEY_PATH="${GITHUB_DEPLOY_SA_KEY_PATH:-${ROOT_DIR}/.secrets/gcp-admin-sa.json}"

GITHUB_DEPLOY_SA_EMAIL="${GITHUB_DEPLOY_SA_ID}@${GCP_PROJECT_ID}.iam.gserviceaccount.com"

BOOTSTRAP_ROLES=(
  roles/container.admin
  roles/compute.networkAdmin
  roles/cloudsql.admin
  roles/artifactregistry.admin
  roles/iam.serviceAccountAdmin
  roles/iam.serviceAccountUser
  roles/dns.admin
  roles/storage.admin
  roles/secretmanager.admin
  roles/iam.workloadIdentityPoolAdmin
  roles/resourcemanager.projectIamAdmin
  roles/serviceusage.serviceUsageAdmin
  # Local smoke of Vertex Gemini (builder agent) via this SA's JSON key / ADC
  roles/aiplatform.user
)

print_org_policy_help() {
  cat <<'EOF'

==> Service account key creation blocked by org policy

Your organization enforces iam.disableServiceAccountKeyCreation. GitHub Actions
should keep using Workload Identity Federation (no keys). For local bootstrap on
a personal org you own, you can relax this constraint.

Console (personal org):
  1. Open https://console.cloud.google.com/iam-admin/orgpolicies
  2. Select your organization (not just the project)
  3. Search: "Disable service account key creation"
  4. Edit → Override parent's policy → Enforcement: Off (or Not enforced)
  5. Save, wait ~1–2 minutes, re-run this script

gcloud (replace ORGANIZATION_ID with output of: gcloud organizations list):

  ORG_ID=123456789012

  cat > /tmp/disable-sa-key-creation.yaml <<POLICY
  constraint: constraints/iam.disableServiceAccountKeyCreation
  booleanPolicy:
    enforced: false
  POLICY

  gcloud resource-manager org-policies set-policy /tmp/disable-sa-key-creation.yaml \
    --organization="${ORG_ID}"

Alternative (project-scoped override if your org allows custom constraints):

  gcloud resource-manager org-policies disable-enforce \
    iam.disableServiceAccountKeyCreation \
    --project="${GCP_PROJECT_ID}"

If you prefer not to disable the policy, authenticate locally without a key:
  gcloud auth application-default login

EOF
}

echo "==> Validating gcloud authentication"
if ! gcloud auth print-access-token >/dev/null 2>&1; then
  echo "Run: gcloud auth login" >&2
  exit 1
fi

echo "==> Ensuring service account ${GITHUB_DEPLOY_SA_EMAIL}"
if gcloud iam service-accounts describe "${GITHUB_DEPLOY_SA_EMAIL}" \
  --project="${GCP_PROJECT_ID}" >/dev/null 2>&1; then
  echo "Service account already exists"
else
  gcloud iam service-accounts create "${GITHUB_DEPLOY_SA_ID}" \
    --project="${GCP_PROJECT_ID}" \
    --display-name="${GITHUB_DEPLOY_SA_DISPLAY_NAME}"
  echo "Created service account ${GITHUB_DEPLOY_SA_EMAIL}"
fi

echo "==> Granting bootstrap IAM roles on project ${GCP_PROJECT_ID}"
for role in "${BOOTSTRAP_ROLES[@]}"; do
  binding="$(
    gcloud projects get-iam-policy "${GCP_PROJECT_ID}" \
      --flatten="bindings[].members" \
      --filter="bindings.role:${role} AND bindings.members:serviceAccount:${GITHUB_DEPLOY_SA_EMAIL}" \
      --format="value(bindings.role)" 2>/dev/null || true
  )"
  if [[ -n "${binding}" ]]; then
    echo "  ${role} (already granted)"
  else
    gcloud projects add-iam-policy-binding "${GCP_PROJECT_ID}" \
      --member="serviceAccount:${GITHUB_DEPLOY_SA_EMAIL}" \
      --role="${role}" \
      --condition=None \
      --quiet >/dev/null
    echo "  ${role} (granted)"
  fi
done

echo "==> Creating JSON key at ${GITHUB_DEPLOY_SA_KEY_PATH}"
mkdir -p "$(dirname "${GITHUB_DEPLOY_SA_KEY_PATH}")"

if [[ -f "${GITHUB_DEPLOY_SA_KEY_PATH}" ]]; then
  echo "Key file already exists — skipping creation (delete the file to rotate)"
else
  key_err=""
  if ! key_err="$(
    gcloud iam service-accounts keys create "${GITHUB_DEPLOY_SA_KEY_PATH}" \
      --project="${GCP_PROJECT_ID}" \
      --iam-account="${GITHUB_DEPLOY_SA_EMAIL}" 2>&1
  )"; then
    if [[ "${key_err}" == *"disableServiceAccountKeyCreation"* ]] \
      || [[ "${key_err}" == *"Key creation is not allowed"* ]] \
      || [[ "${key_err}" == *"FAILED_PRECONDITION"* ]]; then
      echo "${key_err}" >&2
      print_org_policy_help
      exit 1
    fi
    echo "${key_err}" >&2
    exit 1
  fi
  chmod 600 "${GITHUB_DEPLOY_SA_KEY_PATH}"
  echo "Created key: ${GITHUB_DEPLOY_SA_KEY_PATH}"
fi

cat <<EOF

==> github-deploy service account ready

  Email:  ${GITHUB_DEPLOY_SA_EMAIL}
  Key:    ${GITHUB_DEPLOY_SA_KEY_PATH}  (github-deploy key; path kept for compatibility)

Use locally (never commit the key — .secrets/ is gitignored):

  export GOOGLE_APPLICATION_CREDENTIALS=${GITHUB_DEPLOY_SA_KEY_PATH}
  export GCP_PROJECT_ID=${GCP_PROJECT_ID}
  pnpm infra:plan
  pnpm infra:apply

CI deploys use the same SA via Workload Identity Federation (no JSON keys). See infra/README.md.

EOF
