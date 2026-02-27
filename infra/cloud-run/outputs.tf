output "frontend_url" {
  description = "URL of the frontend Cloud Run service"
  value       = google_cloud_run_v2_service.frontend.uri
}

output "backend_url" {
  description = "URL of the backend Cloud Run service (internal)"
  value       = google_cloud_run_v2_service.backend.uri
}

output "clickhouse_internal_ip" {
  description = "Internal IP of the ClickHouse VM"
  value       = local.clickhouse_internal_ip
}

output "registry_path" {
  description = "Artifact Registry path for Docker images"
  value       = local.registry_prefix
}
