# Use existing large-vm-sa for backend (already has GCS permissions)
data "google_service_account" "backend_sa" {
  account_id = "large-vm-sa"
  project    = var.project_id
}

# Service account for the frontend (Node.js SSR)
resource "google_service_account" "frontend_sa" {
  project      = var.project_id
  account_id   = "axaou-frontend-${var.env}-sa"
  display_name = "Cloud Run Service Account for Axaou Frontend (${var.env})"
}

# Allow unauthenticated access to backend for frontend proxy
# The backend URL is not advertised to users - they access via frontend only.
# This avoids needing identity token auth in the frontend proxy code.
resource "google_cloud_run_service_iam_member" "backend_public_access" {
  location = var.region
  project  = var.project_id
  service  = google_cloud_run_v2_service.backend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Public access to frontend (allUsers can invoke)
resource "google_cloud_run_service_iam_member" "frontend_public_access" {
  location = var.region
  project  = var.project_id
  service  = google_cloud_run_v2_service.frontend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Artifact Registry reader for frontend SA (backend SA likely already has this)
resource "google_artifact_registry_repository_iam_member" "frontend_ar_reader" {
  project    = var.project_id
  location   = var.region
  repository = google_artifact_registry_repository.axaou.repository_id
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${google_service_account.frontend_sa.email}"
}

resource "google_artifact_registry_repository_iam_member" "backend_ar_reader" {
  project    = var.project_id
  location   = var.region
  repository = google_artifact_registry_repository.axaou.repository_id
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${data.google_service_account.backend_sa.email}"
}
