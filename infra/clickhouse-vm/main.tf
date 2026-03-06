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

locals {
  project = "aou-neale-gwas-browser"
  zone    = "us-central1-a"
}

# Reference existing shared resources
data "google_service_account" "large_vm_sa" {
  account_id = "large-vm-sa"
  project    = local.project
}

data "google_compute_network" "vpc_network" {
  name    = "large-vm-network"
  project = local.project
}

# Firewall rule for ClickHouse (internal only)
resource "google_compute_firewall" "clickhouse_internal" {
  name    = "allow-clickhouse-internal"
  network = data.google_compute_network.vpc_network.name
  project = local.project

  allow {
    protocol = "tcp"
    ports    = ["8123", "9000"] # HTTP and native protocols
  }

  source_ranges = ["10.0.0.0/8"] # Internal VPC only
  target_tags   = ["clickhouse"]
}
