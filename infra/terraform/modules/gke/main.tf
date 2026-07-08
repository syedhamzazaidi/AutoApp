variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "zone" {
  type = string
}

variable "cluster_name" {
  type = string
}

variable "network_id" {
  type = string
}

variable "subnetwork_id" {
  type = string
}

variable "pods_range_name" {
  type = string
}

variable "services_range_name" {
  type = string
}

variable "labels" {
  type = map(string)
}

resource "google_container_cluster" "autopilot" {
  provider = google-beta

  name     = var.cluster_name
  location = var.region
  project  = var.project_id

  enable_autopilot = true
  networking_mode  = "VPC_NATIVE"

  network    = var.network_id
  subnetwork = var.subnetwork_id

  ip_allocation_policy {
    cluster_secondary_range_name  = var.pods_range_name
    services_secondary_range_name = var.services_range_name
  }

  release_channel {
    channel = "REGULAR"
  }

  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  # gVisor (GKE Sandbox) is enabled per-pod via runtimeClassName: gvisor in manifests.
  addons_config {
    gce_persistent_disk_csi_driver_config {
      enabled = true
    }
  }

  resource_labels = var.labels

  deletion_protection = false
}
