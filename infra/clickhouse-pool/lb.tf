# Internal TCP load balancer for distributing ClickHouse queries across replicas.
# Only accessible from within the VPC (Cloud Run uses VPC connector).

# Regional backend service
resource "google_compute_region_backend_service" "clickhouse" {
  name                  = "axaou-ch-pool-backend"
  project               = var.project_id
  region                = var.region
  protocol              = "TCP"
  load_balancing_scheme = "INTERNAL"
  health_checks         = [google_compute_health_check.clickhouse.id]

  backend {
    group          = google_compute_instance_group_manager.clickhouse_pool.instance_group
    balancing_mode = "CONNECTION"
  }
}

# Internal forwarding rule (the "load balancer" — gives us a stable internal IP)
resource "google_compute_forwarding_rule" "clickhouse" {
  name                  = "axaou-ch-pool-lb"
  project               = var.project_id
  region                = var.region
  load_balancing_scheme = "INTERNAL"
  backend_service       = google_compute_region_backend_service.clickhouse.id
  ip_protocol           = "TCP"
  ports                 = ["8123"]
  network               = data.google_compute_network.vpc_network.self_link
  subnetwork            = data.google_compute_network.vpc_network.self_link
}
