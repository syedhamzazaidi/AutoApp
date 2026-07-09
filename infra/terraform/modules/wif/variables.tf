variable "project_id" {
  description = "GCP project ID."
  type        = string
}

variable "github_repository" {
  description = "GitHub repository allowed to impersonate the CI SA (owner/repo)."
  type        = string
}

variable "pool_id" {
  description = "Workload Identity Pool ID for GitHub Actions."
  type        = string
  default     = "github-actions"
}

variable "provider_id" {
  description = "Workload Identity Provider ID within the pool."
  type        = string
  default     = "github"
}

variable "service_account_id" {
  description = "Existing deploy SA short name (created by scripts/setup-github-deploy-sa.sh)."
  type        = string
  default     = "github-deploy"
}

variable "roles" {
  description = "Project IAM roles granted to the github-deploy service account."
  type        = set(string)
  default = [
    "roles/container.admin",
    "roles/compute.networkAdmin",
    "roles/cloudsql.admin",
    "roles/artifactregistry.admin",
    "roles/iam.serviceAccountAdmin",
    "roles/iam.serviceAccountUser",
    "roles/dns.admin",
    "roles/storage.admin",
    "roles/secretmanager.admin",
    # Local / CI smoke of Vertex Gemini (builder agent) via github-deploy ADC key
    "roles/aiplatform.user",
  ]
}
