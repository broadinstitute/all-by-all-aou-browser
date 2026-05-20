# Managed Instance Group for ClickHouse read replicas

resource "google_compute_instance_group_manager" "clickhouse_pool" {
  name               = "axaou-ch-pool"
  project            = var.project_id
  zone               = local.zone
  base_instance_name = "axaou-ch-replica"

  version {
    instance_template = google_compute_instance_template.clickhouse_replica.self_link
  }

  named_port {
    name = "clickhouse-http"
    port = 8123
  }

  # Health check: ClickHouse responds to GET / with "Ok.\n"
  auto_healing_policies {
    health_check      = google_compute_health_check.clickhouse.id
    initial_delay_sec = 120 # Give startup script time to install + start CH
  }
}

# Autoscaler based on CPU utilization
resource "google_compute_autoscaler" "clickhouse_pool" {
  name    = "axaou-ch-pool-autoscaler"
  project = var.project_id
  zone    = local.zone
  target  = google_compute_instance_group_manager.clickhouse_pool.id

  autoscaling_policy {
    min_replicas    = var.min_replicas
    max_replicas    = var.max_replicas
    cooldown_period = 120

    cpu_utilization {
      target = 0.6 # Scale up when average CPU exceeds 60%
    }
  }
}

# Health check for ClickHouse HTTP interface
resource "google_compute_health_check" "clickhouse" {
  name                = "axaou-ch-health"
  project             = var.project_id
  check_interval_sec  = 10
  timeout_sec         = 5
  healthy_threshold   = 2
  unhealthy_threshold = 3

  http_health_check {
    port         = 8123
    request_path = "/ping"
  }
}
