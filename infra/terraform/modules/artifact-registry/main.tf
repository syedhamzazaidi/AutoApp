variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "repository_id" {
  type = string
}

variable "labels" {
  type = map(string)
}

resource "google_artifact_registry_repository" "docker" {
  project       = var.project_id
  location      = var.region
  repository_id = var.repository_id
  description   = "Endian platform and sandbox container images"
  format        = "DOCKER"

  labels = var.labels
}
