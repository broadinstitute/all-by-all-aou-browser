terraform {
  backend "gcs" {
    bucket = "axaou-browser-tf"
    prefix = "tf/clickhouse-vm"
  }
}

variable "user" {
  description = "Username on the VM, typically $USER"
  type        = string
  default     = "msolomon"
}

# Reference existing shared resources
data "google_service_account" "large_vm_sa" {
  account_id = "large-vm-sa"
  project    = "aou-neale-gwas-browser"
}

data "google_compute_network" "vpc_network" {
  name    = "large-vm-network"
  project = "aou-neale-gwas-browser"
}

# Persistent disk for ClickHouse data
resource "google_compute_disk" "clickhouse_data" {
  project = "aou-neale-gwas-browser"
  name    = "clickhouse-data-pd"
  zone    = "us-central1-a"
  size    = 500
  type    = "pd-ssd"
}

# ClickHouse VM
resource "google_compute_instance" "clickhouse_vm" {
  name         = "clickhouse-vm"
  machine_type = "n2-highmem-8"  # 8 vCPUs, 64GB RAM - good for ClickHouse
  zone         = "us-central1-a"
  project      = "aou-neale-gwas-browser"

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
    startup-script = templatefile("${path.module}/startup.sh", {
      USER = var.user
    })
    enable-logging    = "true"
    enable-monitoring = "true"
  }

  lifecycle {
    prevent_destroy = false
  }

  tags = ["clickhouse"]
}

# Firewall rule for ClickHouse (internal only)
resource "google_compute_firewall" "clickhouse_internal" {
  name    = "allow-clickhouse-internal"
  network = data.google_compute_network.vpc_network.name
  project = "aou-neale-gwas-browser"

  allow {
    protocol = "tcp"
    ports    = ["8123", "9000"]  # HTTP and native protocols
  }

  source_ranges = ["10.0.0.0/8"]  # Internal VPC only
  target_tags   = ["clickhouse"]
}

output "instance_name" {
  value = google_compute_instance.clickhouse_vm.name
}

output "internal_ip" {
  value = google_compute_instance.clickhouse_vm.network_interface[0].network_ip
}

output "external_ip" {
  value = google_compute_instance.clickhouse_vm.network_interface[0].access_config[0].nat_ip
}
