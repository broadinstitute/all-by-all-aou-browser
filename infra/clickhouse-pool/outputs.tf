output "load_balancer_ip" {
  description = "Internal IP of the ClickHouse pool load balancer. Use this as CLICKHOUSE_URL in Cloud Run."
  value       = google_compute_forwarding_rule.clickhouse.ip_address
}

output "instance_group" {
  description = "Instance group URL"
  value       = google_compute_instance_group_manager.clickhouse_pool.instance_group
}

output "clickhouse_url" {
  description = "Ready-to-use ClickHouse URL for Cloud Run env var"
  value       = "http://${google_compute_forwarding_rule.clickhouse.ip_address}:8123"
}
