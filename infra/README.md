# Endian infrastructure

All GCP and Kubernetes resources for the per-project sandbox architecture are defined in this directory. Terraform provisions cloud resources; Kustomize deploys workloads to **kind** (local) or **GKE Autopilot** (prod).

## Project

GCP project ID: **`project-5be3cb47-0a28-4053-b3a`**

Used in `infra/terraform/terraform.tfvars`, `gcloud --project`, and infra scripts. Project IDs are not secrets.

## Layout

```
infra/
├── README.md
├── terraform/          # Modular GCP (GKE, Cloud SQL, AR, DNS, IAM)
├── k8s/
│   ├── base/           # Namespaces, platform, sandbox templates, NetworkPolicy
│   └── overlays/
│       ├── local/      # kind: local images, localtest.me, in-cluster Postgres
│       └── prod/       # GKE: AR images, gVisor, cert-manager, Cloud SQL proxy
└── kind/
    └── cluster-config.yaml
```

## github-deploy service account (bootstrap + CI)

One service account handles **local Terraform/bootstrap** and **GitHub Actions deploys**:

`github-deploy@project-5be3cb47-0a28-4053-b3a.iam.gserviceaccount.com`

| Scenario | Auth |
|----------|------|
| Local `terraform apply`, `pnpm infra:plan`, `pnpm infra:apply` | github-deploy JSON key **or** `gcloud auth application-default login` |
| First-time bootstrap (`scripts/infra-bootstrap.sh`) | Same as above |
| GitHub Actions deploy (`.github/workflows/deploy.yml`) | WIF impersonates **the same** github-deploy SA — no JSON keys in CI |

Runtime workloads use separate least-privilege SAs (`platform-runtime-*`, `sandbox-runtime-*`) — see [Runtime vs bootstrap](#runtime-vs-bootstrap).

### Create the SA and local key

From a machine authenticated to GCP (`gcloud auth login`):

```bash
export GCP_PROJECT_ID=project-5be3cb47-0a28-4053-b3a
./scripts/setup-github-deploy-sa.sh
```

Optional overrides:

```bash
export GITHUB_DEPLOY_SA_ID=github-deploy                    # default
export GITHUB_DEPLOY_SA_KEY_PATH=.secrets/gcp-admin-sa.json   # default; gitignored (contains github-deploy key)
```

The script is idempotent: it creates the SA if missing, grants bootstrap roles, and writes a JSON key to `.secrets/gcp-admin-sa.json` (skipped if the file already exists).

### Use the key locally

```bash
export GOOGLE_APPLICATION_CREDENTIALS=.secrets/gcp-admin-sa.json
export GCP_PROJECT_ID=project-5be3cb47-0a28-4053-b3a
pnpm infra:plan
pnpm infra:apply
```

**Never commit** the key file. `.secrets/` is in `.gitignore`. The filename `gcp-admin-sa.json` is kept for compatibility; the key inside is for **github-deploy**.

### If org policy blocks key creation

Many orgs enforce `iam.disableServiceAccountKeyCreation`. CI should use WIF (already configured). For a **personal org you own**, you can relax the constraint to allow a local key:

**Console**

1. Open [Organization policies](https://console.cloud.google.com/iam-admin/orgpolicies)
2. Select your **organization** (not only the project)
3. Search: **Disable service account key creation**
4. Edit → override parent → **Enforcement: Off** (Not enforced)
5. Save, wait ~1–2 minutes, re-run `./scripts/setup-github-deploy-sa.sh`

**gcloud**

```bash
ORG_ID=$(gcloud organizations list --format='value(name)' | head -1)

cat > /tmp/disable-sa-key-creation.yaml <<EOF
constraint: constraints/iam.disableServiceAccountKeyCreation
booleanPolicy:
  enforced: false
EOF

gcloud resource-manager org-policies set-policy /tmp/disable-sa-key-creation.yaml \
  --organization="${ORG_ID}"
```

If you prefer not to change org policy, use Application Default Credentials instead:

```bash
gcloud auth application-default login
```

### Required IAM roles (bootstrap)

Granted by `./scripts/setup-github-deploy-sa.sh` on the target project:

| Role | Purpose |
|------|---------|
| `roles/container.admin` | GKE cluster create/manage |
| `roles/compute.networkAdmin` | VPC, subnets, firewall rules |
| `roles/cloudsql.admin` | Platform Postgres |
| `roles/artifactregistry.admin` | Container image registry |
| `roles/iam.serviceAccountAdmin` | Workload Identity service accounts |
| `roles/iam.serviceAccountUser` | Bind SAs to GKE workloads |
| `roles/dns.admin` | Wildcard preview DNS |
| `roles/storage.admin` | Terraform remote state bucket |
| `roles/secretmanager.admin` | Runtime secrets (OpenRouter, Supabase, DB password) |

`orgpolicy.policyAdmin` is **not** granted on github-deploy — only your user account needs that to change org policies.

### Runtime vs bootstrap

**github-deploy** is for Terraform, local/manual deploy, and CI only. The platform pod uses a separate least-privilege SA (`platform-runtime-<env>@`) via GKE Workload Identity with `roles/container.developer` to provision sandbox resources in `endian-sandboxes` only. Sandbox pods use `sandbox-runtime-<env>@` with minimal privileges (Artifact Registry reader).

## GitHub Actions auth (no SA keys)

Many GCP organizations enforce `iam.disableServiceAccountKeyCreation`, which blocks downloading service account JSON keys. That is expected — **Workload Identity Federation (WIF)** lets GitHub Actions impersonate **github-deploy** without long-lived credentials.

### Why keys are blocked

Org policy constraint `iam.disableServiceAccountKeyCreation` prevents creating or uploading SA keys. **CI uses WIF instead** (see below). For local bootstrap on a personal org, you can disable the constraint or use `gcloud auth application-default login` — see [github-deploy service account](#github-deploy-service-account-bootstrap--ci).

### One-time setup

Run these steps **once** from a machine already authenticated to GCP. Create github-deploy first with `./scripts/setup-github-deploy-sa.sh` (roles only — no key required for WIF).

**Option A — gcloud**

```bash
export GCP_PROJECT_ID=project-5be3cb47-0a28-4053-b3a
export GITHUB_REPO=your-org/endian   # owner/repo exactly as GitHub shows it
export POOL_ID=github-actions
export PROVIDER_ID=github
export DEPLOY_SA=github-deploy

# 1. Create Workload Identity Pool + OIDC provider (GitHub issuer)
gcloud iam workload-identity-pools create "$POOL_ID" \
  --project="$GCP_PROJECT_ID" \
  --location=global \
  --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" \
  --project="$GCP_PROJECT_ID" \
  --location=global \
  --workload-identity-pool="$POOL_ID" \
  --display-name="GitHub" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository == \"${GITHUB_REPO}\""

# 2. Allow GitHub repo to impersonate github-deploy (roles already granted by setup script)
PROJECT_NUMBER=$(gcloud projects describe "$GCP_PROJECT_ID" --format='value(projectNumber)')

gcloud iam service-accounts add-iam-policy-binding \
  "${DEPLOY_SA}@${GCP_PROJECT_ID}.iam.gserviceaccount.com" \
  --project="$GCP_PROJECT_ID" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository/${GITHUB_REPO}"
```

**Option B — Terraform module**

Set `github_repository` in `infra/terraform/terraform.tfvars` (see `terraform.tfvars.example`), then apply locally once before enabling the deploy workflow:

```bash
./scripts/setup-github-deploy-sa.sh   # ensure github-deploy exists
pnpm infra:plan
pnpm infra:apply

terraform -chdir=infra/terraform output github_workload_identity_provider
terraform -chdir=infra/terraform output github_ci_service_account_email
# → github-deploy@project-5be3cb47-0a28-4053-b3a.iam.gserviceaccount.com
```

Module source: `infra/terraform/modules/wif/` (binds WIF to the existing github-deploy SA).

### GitHub repository secrets

Configure these in **Settings → Secrets and variables → Actions**:

| Secret | Value |
|--------|--------|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Full provider name: `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-actions/providers/github` |
| `GCP_SERVICE_ACCOUNT` | `github-deploy@PROJECT_ID.iam.gserviceaccount.com` |
| `GCP_PROJECT_ID` | GCP project ID (unchanged) |
| `TF_STATE_BUCKET` | GCS bucket for Terraform remote state (unchanged) |

Remove `GCP_SA_KEY` if it was previously configured — it is no longer used.

The deploy workflow (`.github/workflows/deploy.yml`) requests an OIDC token (`id-token: write`) and passes the provider + SA to `google-github-actions/auth@v2`.

## Bootstrap sequence

Install Terraform first:

```bash
brew install terraform
```

`GCP_PROJECT_ID` defaults to `project-5be3cb47-0a28-4053-b3a` in infra scripts when unset. `TF_STATE_BUCKET` is auto-derived as `endian-tfstate-<GCP_PROJECT_ID>` when unset — you do not need to export it for the default project.

Full copy-paste bootstrap for **`project-5be3cb47-0a28-4053-b3a`**:

```bash
# Prerequisites: gcloud CLI, Terraform (brew install terraform), pnpm
brew install terraform
gcloud auth application-default login

export GCP_PROJECT_ID=project-5be3cb47-0a28-4053-b3a

# 1. Create github-deploy SA + local key (or skip and use ADC from gcloud auth above)
./scripts/setup-github-deploy-sa.sh
export GOOGLE_APPLICATION_CREDENTIALS=.secrets/gcp-admin-sa.json

# 2. Configure variables
cp infra/terraform/terraform.tfvars.example infra/terraform/terraform.tfvars
# Edit: project_id, region, domain, environment

# 3. One-time remote state bucket + terraform init (GCS backend: bucket only)
# TF_STATE_BUCKET defaults to endian-tfstate-project-5be3cb47-0a28-4053-b3a
./scripts/infra-bootstrap.sh
# Then complete GitHub Actions auth — see "GitHub Actions auth (no SA keys)" above

# 4. Plan + apply GCP + deploy prod overlay
pnpm infra:plan
pnpm infra:apply

# 5. Build and push images (after apps/sandbox Dockerfiles exist)
pnpm infra:deploy
```

## Local development (kind)

Same K8s code path as prod — sandboxes always run in the cluster.

```bash
pnpm dev:cluster   # kind cluster + ingress + local overlay
pnpm dev:images    # build and load platform/sandbox images into kind
pnpm dev           # platform on host with KUBECONFIG → kind
```

Preview URLs locally: `{projectId}.preview.localtest.me`  
Platform URL locally: `http://platform.localtest.me`

### Minimum requirements

- Docker, kind, kubectl
- 8 Gi+ RAM recommended for concurrent sandbox pods
- `/etc/hosts` not required — `localtest.me` resolves to 127.0.0.1

## Prod overlay rendering

Terraform outputs feed the prod Kustomize overlay via `scripts/render-kustomize-prod.sh`:

- `artifact_registry_url` → image references
- `cloud_sql_connection_name` → Cloud SQL Auth Proxy sidecar
- `preview_domain` / `platform_domain` → Ingress hosts
- `platform_service_account_email` → Workload Identity annotations

Re-run after every `terraform apply` before `kubectl apply -k infra/k8s/overlays/prod`.

## Post-apply manual steps

1. **DNS (hybrid Cloudflare + Google Cloud DNS)**: Keep apex/www on Cloudflare pointing to GitHub Pages. Do **not** change root NS away from Cloudflare. After `terraform apply`, add **NS records** at Cloudflare (DNS only, not full delegation):
   - Label `platform` → each of the 4 nameservers from `terraform output platform_dns_name_servers`
   - Label `preview` → each of the 4 nameservers from `terraform output preview_dns_name_servers`
   Then update Cloud DNS A records (`platform.<domain>`, `*.` in the preview zone) with the ingress load balancer IP after first deploy.
2. **Secrets**: Populate `platform-secrets` in `endian-platform` (or wire External Secrets from Secret Manager). DB password is auto-stored in Secret Manager as `endian-platform-db-password`. Prod `DATABASE_URL` uses the Cloud SQL unix socket (`?host=/cloudsql/<connection_name>`); run `./scripts/sync-platform-db-secret.sh` after apply to patch the live secret without committing the password.
3. **cert-manager**: Install cert-manager in the cluster; provide Cloud DNS solver credentials for `ClusterIssuer` `letsencrypt-prod`.
4. **gVisor**: GKE Autopilot supports `runtimeClassName: gvisor` on sandbox pods (enabled in prod template).

## Sandbox provisioner reference

Per-project resources are created from `infra/k8s/base/sandbox/deployment-template.yaml`:

- Label: `endian.io/project-id=<uuid>`
- PVC (10 Gi), Secret (`VITE_*` only), Deployment, Service
- Local overlay patch: `overlays/local/sandbox-deployment-patch.yaml` (no gVisor, `imagePullPolicy: Never`)

## Destroy

```bash
terraform -chdir=infra/terraform destroy
./scripts/kind-down.sh
```

Delete the state bucket separately if no longer needed.
