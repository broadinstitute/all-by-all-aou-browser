terraform {
  backend "gcs" {
    bucket = "axaou-browser-tf"
    prefix = "tf/clickhouse-pool"
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
  zone = "${var.region}-a"
}

# Reference existing shared resources
data "google_service_account" "large_vm_sa" {
  account_id = "large-vm-sa"
  project    = var.project_id
}

data "google_compute_network" "vpc_network" {
  name    = "large-vm-network"
  project = var.project_id
}

# Use the latest data disk snapshot
data "google_compute_snapshot" "ch_data" {
  name    = var.snapshot_name
  project = var.project_id
}
