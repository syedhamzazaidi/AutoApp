variable "project_id" {
  description = "GCP project ID for all resources."
  type        = string
}

variable "region" {
  description = "GCP region (e.g. us-central1)."
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "GCP zone for zonal GKE Autopilot cluster (free management tier)."
  type        = string
  default     = "us-central1-a"
}

variable "environment" {
  description = "Environment label (e.g. prod, staging)."
  type        = string
  default     = "prod"
}

variable "domain" {
  description = "Root domain for platform and preview subdomains (e.g. example.com)."
  type        = string
}

variable "preview_subdomain" {
  description = "Subdomain prefix for per-project preview hosts ({projectId}.preview.<domain>)."
  type        = string
  default     = "preview"
}

variable "ingress_ip" {
  description = "Ingress load balancer IP for Cloud DNS A records."
  type        = string
  default     = "0.0.0.0"
}

variable "cluster_name" {
  description = "GKE Autopilot cluster name."
  type        = string
  default     = "endian-autopilot"
}

variable "artifact_registry_id" {
  description = "Artifact Registry repository ID for platform and sandbox images."
  type        = string
  default     = "endian"
}

variable "cloud_sql_tier" {
  description = "Cloud SQL machine tier for platform Postgres."
  type        = string
  default     = "db-f1-micro"
}

variable "cloud_sql_disk_size_gb" {
  description = "Cloud SQL disk size in GiB."
  type        = number
  default     = 10
}

variable "vpc_name" {
  description = "VPC network name."
  type        = string
  default     = "endian-vpc"
}

variable "subnet_name" {
  description = "Primary subnet name for GKE and private services."
  type        = string
  default     = "endian-subnet"
}

variable "subnet_cidr" {
  description = "Primary subnet CIDR."
  type        = string
  default     = "10.10.0.0/20"
}

variable "pods_range_name" {
  description = "Secondary range name for pod IPs."
  type        = string
  default     = "pods"
}

variable "pods_cidr" {
  description = "Secondary CIDR for pod IPs."
  type        = string
  default     = "10.20.0.0/16"
}

variable "services_range_name" {
  description = "Secondary range name for service IPs."
  type        = string
  default     = "services"
}

variable "services_cidr" {
  description = "Secondary CIDR for service IPs."
  type        = string
  default     = "10.30.0.0/20"
}

variable "platform_namespace" {
  description = "Kubernetes namespace for the control plane."
  type        = string
  default     = "endian-platform"
}

variable "sandboxes_namespace" {
  description = "Kubernetes namespace for per-project sandbox workloads."
  type        = string
  default     = "endian-sandboxes"
}

variable "github_repository" {
  description = "GitHub repo (owner/name) for Workload Identity Federation. Empty skips WIF resources."
  type        = string
  default     = ""
}

variable "labels" {
  description = "Common resource labels."
  type        = map(string)
  default = {
    managed-by = "terraform"
    app        = "endian"
  }
}

variable "enable_google_dns" {
  description = "When false, skip Google Cloud DNS zones/records (use Cloudflare-only A/CNAME to ingress_ip). Existing zones are not destroyed until you remove them from state or set this back to true and run destroy on the module."
  type        = bool
  default     = false
}

