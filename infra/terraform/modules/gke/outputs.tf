output "cluster_name" {
  value = google_container_cluster.autopilot.name
}

output "location" {
  value = google_container_cluster.autopilot.location
}

output "endpoint" {
  value = google_container_cluster.autopilot.endpoint
}

output "workload_identity_pool" {
  value = google_container_cluster.autopilot.workload_identity_config[0].workload_pool
}
