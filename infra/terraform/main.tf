locals {
  platform_domain = "platform.${var.domain}"
  preview_domain  = "${var.preview_subdomain}.${var.domain}"
}

module "project" {
  source = "./modules/project"

  project_id = var.project_id
  labels     = var.labels
}

module "network" {
  source = "./modules/network"

  project_id          = var.project_id
  region              = var.region
  vpc_name            = var.vpc_name
  subnet_name         = var.subnet_name
  subnet_cidr         = var.subnet_cidr
  pods_range_name     = var.pods_range_name
  pods_cidr           = var.pods_cidr
  services_range_name = var.services_range_name
  services_cidr       = var.services_cidr
  labels              = var.labels

  depends_on = [module.project]
}

module "artifact_registry" {
  source = "./modules/artifact-registry"

  project_id    = var.project_id
  region        = var.region
  repository_id = var.artifact_registry_id
  labels        = var.labels

  depends_on = [module.project]
}

module "cloud_sql" {
  source = "./modules/cloud-sql"

  project_id   = var.project_id
  region       = var.region
  environment  = var.environment
  tier         = var.cloud_sql_tier
  disk_size_gb = var.cloud_sql_disk_size_gb
  network_id   = module.network.network_id
  labels       = var.labels

  depends_on = [module.network]
}

module "gke" {
  source = "./modules/gke"

  project_id          = var.project_id
  region              = var.region
  zone                = var.zone
  cluster_name        = var.cluster_name
  network_id          = module.network.network_id
  subnetwork_id       = module.network.subnetwork_id
  pods_range_name     = var.pods_range_name
  services_range_name = var.services_range_name
  labels              = var.labels

  depends_on = [module.network, module.cloud_sql]
}

module "iam" {
  source = "./modules/iam"

  project_id          = var.project_id
  environment         = var.environment
  platform_namespace  = var.platform_namespace
  sandboxes_namespace = var.sandboxes_namespace
  gke_cluster_name    = module.gke.cluster_name
  gke_location        = module.gke.location
  labels              = var.labels

  depends_on = [module.gke]
}

# Google Cloud DNS is optional; set enable_google_dns = false when using Cloudflare-only records.
module "dns" {
  count  = var.enable_google_dns ? 1 : 0
  source = "./modules/dns"

  project_id      = var.project_id
  platform_domain = local.platform_domain
  preview_domain  = local.preview_domain
  environment     = var.environment
  labels          = var.labels
  ingress_ip      = var.ingress_ip

  depends_on = [module.gke]
}

module "github_wif" {
  count  = var.github_repository != "" ? 1 : 0
  source = "./modules/wif"

  project_id        = var.project_id
  github_repository = var.github_repository
}
