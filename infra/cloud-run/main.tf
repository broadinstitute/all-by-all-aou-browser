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
}

# Fetch current digest of :latest tags via gcloud - triggers redeploy when images change
data "external" "frontend_digest" {
  program = ["bash", "-c", <<-EOF
    DIGEST=$(gcloud artifacts docker images describe \
      ${local.registry_prefix}/${var.frontend_image}:latest \
      --format='value(image_summary.digest)' 2>/dev/null)
    echo "{\"digest\": \"$DIGEST\"}"
  EOF
  ]
}

data "external" "backend_digest" {
  program = ["bash", "-c", <<-EOF
    DIGEST=$(gcloud artifacts docker images describe \
      ${local.registry_prefix}/${var.backend_image}:latest \
      --format='value(image_summary.digest)' 2>/dev/null)
    echo "{\"digest\": \"$DIGEST\"}"
  EOF
  ]
}

locals {
  # Reference images by digest so Terraform detects changes
  frontend_image = "${local.registry_prefix}/${var.frontend_image}@${data.external.frontend_digest.result.digest}"
  backend_image  = "${local.registry_prefix}/${var.backend_image}@${data.external.backend_digest.result.digest}"
}

# Reference the existing VPC network (shared with clickhouse-vm)
data "google_compute_network" "vpc_network" {
  name    = "large-vm-network"
  project = var.project_id
}

# Get ClickHouse VM internal IP (full dataset instance)
data "google_compute_instance" "clickhouse_vm" {
  name    = "axaou-clickhouse-1"
  zone    = "us-central1-a"
  project = var.project_id
}

locals {
  clickhouse_internal_ip = data.google_compute_instance.clickhouse_vm.network_interface[0].network_ip
}
