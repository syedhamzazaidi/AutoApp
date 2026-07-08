variable "project_id" {
  type = string
}

variable "platform_domain" {
  type        = string
  description = "Delegated subdomain zone for the platform builder (e.g. platform.example.com)."
}

variable "preview_domain" {
  type        = string
  description = "Delegated subdomain zone for sandbox previews (e.g. preview.example.com)."
}

variable "environment" {
  type = string
}

variable "labels" {
  type = map(string)
}

variable "ingress_ip" {
  type        = string
  description = "Ingress load balancer IP for A records (placeholder until known)."
  default     = "0.0.0.0"
}

# Subdomain delegation zone: platform.<root-domain>
# Delegate at Cloudflare with NS records for label "platform".
resource "google_dns_managed_zone" "platform" {
  name        = "endian-platform-${replace(var.platform_domain, ".", "-")}-${var.environment}"
  project     = var.project_id
  dns_name    = "${var.platform_domain}."
  description = "Platform builder DNS (${var.environment})"

  labels = var.labels
}

# Subdomain delegation zone: preview.<root-domain>
# Delegate at Cloudflare with NS records for label "preview".
resource "google_dns_managed_zone" "preview" {
  name        = "endian-preview-${replace(var.preview_domain, ".", "-")}-${var.environment}"
  project     = var.project_id
  dns_name    = "${var.preview_domain}."
  description = "Sandbox preview DNS (${var.environment})"

  labels = var.labels
}

resource "google_dns_record_set" "platform_apex" {
  name         = "${var.platform_domain}."
  managed_zone = google_dns_managed_zone.platform.name
  project      = var.project_id
  type         = "A"
  ttl          = 300
  rrdatas      = [var.ingress_ip]
}

# Wildcard in the preview zone matches {projectId}.preview.<root-domain>.
resource "google_dns_record_set" "preview_wildcard" {
  name         = "*.${var.preview_domain}."
  managed_zone = google_dns_managed_zone.preview.name
  project      = var.project_id
  type         = "A"
  ttl          = 300
  rrdatas      = [var.ingress_ip]
}
