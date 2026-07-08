output "platform_service_account_email" {
  value = google_service_account.platform.email
}

output "sandbox_service_account_email" {
  value = google_service_account.sandbox.email
}

output "platform_kubernetes_service_account" {
  value = local.platform_ksa
}
