output "workload_identity_provider" {
  description = "Full WIF provider resource name for the GCP_WORKLOAD_IDENTITY_PROVIDER GitHub secret."
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "service_account_email" {
  description = "github-deploy SA email for the GCP_SERVICE_ACCOUNT GitHub secret."
  value       = data.google_service_account.deploy.email
}

output "pool_name" {
  description = "Full workload identity pool resource name."
  value       = google_iam_workload_identity_pool.github.name
}
