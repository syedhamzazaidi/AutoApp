output "project_id" {
  description = "GCP project ID."
  value       = var.project_id
}

output "region" {
  description = "GCP region."
  value       = var.region
}

output "zone" {
  description = "GCP zone for the zonal Autopilot cluster."
  value       = var.zone
}

output "gke_cluster_name" {
  description = "GKE Autopilot cluster name."
  value       = module.gke.cluster_name
}

output "gke_location" {
  description = "GKE cluster location (zone)."
  value       = module.gke.location
}

output "artifact_registry_url" {
  description = "Artifact Registry base URL for Docker images."
  value       = module.artifact_registry.repository_url
}

output "artifact_registry_repository" {
  description = "Artifact Registry repository ID."
  value       = module.artifact_registry.repository_id
}

output "cloud_sql_connection_name" {
  description = "Cloud SQL instance connection name for the Auth Proxy sidecar."
  value       = module.cloud_sql.connection_name
}

output "cloud_sql_instance_name" {
  description = "Cloud SQL instance name."
  value       = module.cloud_sql.instance_name
}

output "cloud_sql_database_name" {
  description = "Platform Postgres database name."
  value       = module.cloud_sql.database_name
}

output "preview_domain" {
  description = "Wildcard preview host suffix (e.g. preview.example.com)."
  value       = local.preview_domain
}

output "platform_domain" {
  description = "Platform ingress host (e.g. platform.example.com)."
  value       = local.platform_domain
}

output "platform_dns_zone_name" {
  description = "Cloud DNS managed zone name for platform subdomain."
  value       = var.enable_google_dns ? module.dns[0].platform_zone_name : null
}

output "platform_dns_name_servers" {
  description = "NS records to add at Cloudflare for label 'platform'."
  value       = var.enable_google_dns ? module.dns[0].platform_name_servers : null
}

output "preview_dns_zone_name" {
  description = "Cloud DNS managed zone name for preview subdomain."
  value       = var.enable_google_dns ? module.dns[0].preview_zone_name : null
}

output "preview_dns_name_servers" {
  description = "NS records to add at Cloudflare for label 'preview'."
  value       = var.enable_google_dns ? module.dns[0].preview_name_servers : null
}

output "platform_service_account_email" {
  description = "GCP SA email for platform provisioner (Workload Identity)."
  value       = module.iam.platform_service_account_email
}

output "sandbox_service_account_email" {
  description = "GCP SA email for sandbox pods (minimal privileges)."
  value       = module.iam.sandbox_service_account_email
}

output "platform_kubernetes_service_account" {
  description = "Kubernetes SA name for platform Workload Identity binding."
  value       = module.iam.platform_kubernetes_service_account
}

output "network_name" {
  description = "VPC network name."
  value       = module.network.network_name
}

output "subnet_name" {
  description = "Primary subnet name."
  value       = module.network.subnet_name
}

output "github_workload_identity_provider" {
  description = "WIF provider for GCP_WORKLOAD_IDENTITY_PROVIDER GitHub secret (empty if github_repository unset)."
  value       = length(module.github_wif) > 0 ? module.github_wif[0].workload_identity_provider : ""
}

output "github_ci_service_account_email" {
  description = "github-deploy SA email for GCP_SERVICE_ACCOUNT GitHub secret (empty if github_repository unset)."
  value       = length(module.github_wif) > 0 ? module.github_wif[0].service_account_email : ""
}
