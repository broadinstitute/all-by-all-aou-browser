terraform {
  backend "gcs" {
    bucket = "axaou-browser-tf"
    prefix = "tf/cloud-run"
  }
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

locals {
  registry_prefix = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.axaou.repository_id}"
  frontend_image  = "${local.registry_prefix}/${var.frontend_image}:latest"
  backend_image   = "${local.registry_prefix}/${var.backend_image}:latest"
}

# Reference the existing VPC network (shared with clickhouse-vm)
data "google_compute_network" "vpc_network" {
  name    = "large-vm-network"
  project = var.project_id
}

# Get ClickHouse VM internal IP
data "google_compute_instance" "clickhouse_vm" {
  name    = "clickhouse-vm"
  zone    = "us-central1-a"
  project = var.project_id
}

locals {
  clickhouse_internal_ip = data.google_compute_instance.clickhouse_vm.network_interface[0].network_ip
}
