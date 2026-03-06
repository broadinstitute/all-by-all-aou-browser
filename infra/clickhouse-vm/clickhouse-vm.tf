# Original ClickHouse instance (500GB)

resource "google_compute_disk" "clickhouse_data" {
  project = local.project
  name    = "clickhouse-data-pd"
  zone    = local.zone
  size    = 500
  type    = "pd-ssd"
}

resource "google_compute_instance" "clickhouse_vm" {
  name         = "clickhouse-vm"
  machine_type = "n2-highmem-8" # 8 vCPUs, 64GB RAM
  zone         = local.zone
  project      = local.project

  allow_stopping_for_update = true

  service_account {
    email  = data.google_service_account.large_vm_sa.email
    scopes = ["cloud-platform"]
  }

  network_interface {
    network = data.google_compute_network.vpc_network.self_link

    access_config {
      // Ephemeral public IP
    }
  }

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-12"
      size  = 50
      type  = "pd-ssd"
    }
    auto_delete = true
  }

  attached_disk {
    source = google_compute_disk.clickhouse_data.self_link
  }

  metadata = {
    startup-script    = templatefile("${path.module}/startup.sh", { USER = var.user })
    enable-logging    = "true"
    enable-monitoring = "true"
  }

  lifecycle {
    prevent_destroy = false
  }

  tags = ["clickhouse"]
}
