output "platform_zone_name" {
  value = google_dns_managed_zone.platform.name
}

output "preview_zone_name" {
  value = google_dns_managed_zone.preview.name
}

output "platform_name_servers" {
  value = google_dns_managed_zone.platform.name_servers
}

output "preview_name_servers" {
  value = google_dns_managed_zone.preview.name_servers
}

output "platform_domain" {
  value = var.platform_domain
}

output "preview_domain" {
  value = var.preview_domain
}
