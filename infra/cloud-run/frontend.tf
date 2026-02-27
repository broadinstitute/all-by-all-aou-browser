# Node.js frontend (SSR) - public service
resource "google_cloud_run_v2_service" "frontend" {
  name     = "axaou-app-${var.env}"
  location = var.region
  project  = var.project_id

  template {
    service_account = google_service_account.frontend_sa.email

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    # VPC access for backend connectivity (uses internal URL)
    vpc_access {
      network_interfaces {
        network    = data.google_compute_network.vpc_network.name
        subnetwork = data.google_compute_network.vpc_network.name
      }
      egress = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = local.frontend_image

      ports {
        container_port = 8080
      }

      # The frontend proxies /api/* to the backend service
      env {
        name  = "PYTHON_API_HOST"
        value = google_cloud_run_v2_service.backend.uri
      }

      env {
        name  = "PYTHON_API_PATH"
        value = "/api"
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      startup_probe {
        http_get {
          path = "/"
        }
        initial_delay_seconds = 3
        timeout_seconds       = 3
        period_seconds        = 5
        failure_threshold     = 3
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  # Frontend depends on backend being created first
  depends_on = [google_cloud_run_v2_service.backend]
}
