# Artifact Registry for Docker images
resource "google_artifact_registry_repository" "axaou" {
  project       = var.project_id
  location      = var.region
  repository_id = "axaou"
  description   = "Docker images for axaou-rust services"
  format        = "DOCKER"

  cleanup_policies {
    id     = "keep-recent"
    action = "KEEP"
    most_recent_versions {
      keep_count = 10
    }
  }
}

