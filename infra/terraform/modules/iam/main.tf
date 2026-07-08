variable "project_id" {
  type = string
}

variable "environment" {
  type = string
}

variable "platform_namespace" {
  type = string
}

variable "sandboxes_namespace" {
  type = string
}

variable "gke_cluster_name" {
  type = string
}

variable "gke_location" {
  type = string
}

variable "labels" {
  type = map(string)
}

locals {
  platform_sa_id = "platform-runtime-${var.environment}"
  sandbox_sa_id  = "sandbox-runtime-${var.environment}"
  platform_ksa   = "platform-provisioner"
}

resource "google_service_account" "platform" {
  project      = var.project_id
  account_id   = local.platform_sa_id
  display_name = "Endian platform runtime (${var.environment})"
}

resource "google_service_account" "sandbox" {
  project      = var.project_id
  account_id   = local.sandbox_sa_id
  display_name = "Endian sandbox runtime (${var.environment})"
}

# Platform SA: create/manage sandbox resources in endian-sandboxes namespace only.
resource "google_project_iam_member" "platform_container_developer" {
  project = var.project_id
  role    = "roles/container.developer"
  member  = "serviceAccount:${google_service_account.platform.email}"
}

resource "google_project_iam_member" "platform_cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.platform.email}"
}

resource "google_project_iam_member" "platform_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.platform.email}"
}

# Sandbox SA: minimal — Artifact Registry reader for image pulls (if using WI on sandbox pods).
resource "google_project_iam_member" "sandbox_artifact_reader" {
  project = var.project_id
  role    = "roles/artifactregistry.reader"
  member  = "serviceAccount:${google_service_account.sandbox.email}"
}

# Workload Identity: platform KSA -> platform GCP SA
resource "google_service_account_iam_member" "platform_workload_identity" {
  service_account_id = google_service_account.platform.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[${var.platform_namespace}/${local.platform_ksa}]"
}

# Workload Identity: sandbox KSA -> sandbox GCP SA (optional per-pod identity)
resource "google_service_account_iam_member" "sandbox_workload_identity" {
  service_account_id = google_service_account.sandbox.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[${var.sandboxes_namespace}/sandbox-runtime]"
}
