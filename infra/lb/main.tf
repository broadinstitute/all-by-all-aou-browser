provider "google" {
  project = var.project_id
  region  = var.region
}

# Reference the new Cloud Run frontend (managed by cloud-run TF)
data "google_cloud_run_v2_service" "new_frontend" {
  name     = "axaou-app-prod"
  location = var.region
}

# New NEG pointing to the new frontend — avoids destroy/recreate of the old NEG
resource "google_compute_region_network_endpoint_group" "serverless_neg_v2" {
  name                  = "serverless-neg-v2"
  network_endpoint_type = "SERVERLESS"
  region                = var.region

  cloud_run {
    service = data.google_cloud_run_v2_service.new_frontend.name
  }
}

# Cloud Armor rate limiting policy (exists in GCP but was never attached to the LB)
resource "google_compute_security_policy" "axaou_cloud_armor" {
  name = "axaou-cloud-armor"
  type = "CLOUD_ARMOR"

  rule {
    action      = "throttle"
    description = "catch-all rate enforcement"
    preview     = false
    priority    = 1000

    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }

    rate_limit_options {
      ban_duration_sec = 0
      conform_action   = "allow"
      enforce_on_key   = "IP"
      exceed_action    = "deny(429)"

      rate_limit_threshold {
        count        = 500
        interval_sec = 60
      }
    }
  }

  rule {
    action      = "allow"
    description = "Default rule, higher priority overrides it"
    preview     = false
    priority    = 2147483647

    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
  }
}

# Global HTTP(S) Load Balancer
# The module originally created its own IP (axaou-lb-address / 34.144.247.230)
module "lb-http" {
  source  = "GoogleCloudPlatform/lb-http/google//modules/serverless_negs"
  version = "~> 9.0"

  project = var.project_id
  name    = "axaou-lb"

  create_address = true

  ssl                             = true
  managed_ssl_certificate_domains = ["allbyall.researchallofus.org"]
  https_redirect                  = true

  backends = {
    default = {
      protocol   = "HTTP"
      enable_cdn = false

      log_config = {
        enable      = true
        sample_rate = 1.0
      }

      security_policy = google_compute_security_policy.axaou_cloud_armor.id

      groups = [
        {
          group = google_compute_region_network_endpoint_group.serverless_neg_v2.id
        }
      ]

      iap_config = {
        enable = false
      }
    }
  }
}
