output "instance_name" {
  value = google_sql_database_instance.platform.name
}

output "connection_name" {
  value = google_sql_database_instance.platform.connection_name
}

output "database_name" {
  value = google_sql_database.platform.name
}

output "database_user" {
  value = google_sql_user.platform.name
}

output "db_password_secret_id" {
  value = google_secret_manager_secret.db_password.secret_id
}
