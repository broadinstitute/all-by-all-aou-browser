# Rust backend (axaou-server) - internal service
resource "google_cloud_run_v2_service" "backend" {
  name     = "axaou-backend-${var.env}"
  location = var.region
  project  = var.project_id

  template {
    service_account = data.google_service_account.backend_sa.email

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    # VPC access for ClickHouse connectivity
    vpc_access {
      network_interfaces {
        network    = data.google_compute_network.vpc_network.name
        subnetwork = data.google_compute_network.vpc_network.name
      }
      egress = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = local.backend_image

      ports {
        container_port = 8080
      }

      env {
        name  = "CLICKHOUSE_URL"
        value = "http://${local.clickhouse_internal_ip}:8123"
      }

      env {
        name  = "RUST_LOG"
        value = "info"
      }

      resources {
        limits = {
          cpu    = "8"
          memory = "32Gi"
        }
      }

      startup_probe {
        http_get {
          path = "/api/health"
        }
        initial_delay_seconds = 10
        timeout_seconds       = 5
        period_seconds        = 15
        failure_threshold     = 10
      }

      liveness_probe {
        http_get {
          path = "/api/health"
        }
        timeout_seconds   = 3
        period_seconds    = 30
        failure_threshold = 3
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }
}
