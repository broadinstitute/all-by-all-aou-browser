# Service account for running deployments (Cloud Build, pushing to Artifact Registry)
resource "google_service_account" "deploy_sa" {
  project      = var.project_id
  account_id   = "axaou-deploy-sa"
  display_name = "Axaou Deployment Service Account"
  description  = "Used for Cloud Build and deploying to Cloud Run"
}

# Cloud Build Editor - submit and manage builds
resource "google_project_iam_member" "deploy_cloudbuild_editor" {
  project = var.project_id
  role    = "roles/cloudbuild.builds.editor"
  member  = "serviceAccount:${google_service_account.deploy_sa.email}"
}

# Artifact Registry Writer - push images
resource "google_artifact_registry_repository_iam_member" "deploy_ar_writer" {
  project    = var.project_id
  location   = var.region
  repository = google_artifact_registry_repository.axaou.repository_id
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${google_service_account.deploy_sa.email}"
}

# Storage Admin on the Cloud Build bucket (for uploading source)
resource "google_storage_bucket_iam_member" "deploy_cloudbuild_storage" {
  bucket = "${var.project_id}_cloudbuild"
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.deploy_sa.email}"
}

# Cloud Run Admin - deploy services
resource "google_project_iam_member" "deploy_run_admin" {
  project = var.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${google_service_account.deploy_sa.email}"
}

# Service Account User - to deploy with service accounts
resource "google_project_iam_member" "deploy_sa_user" {
  project = var.project_id
  role    = "roles/iam.serviceAccountUser"
  member  = "serviceAccount:${google_service_account.deploy_sa.email}"
}

# Service Usage Consumer - required for Cloud Build bucket access
resource "google_project_iam_member" "deploy_service_usage" {
  project = var.project_id
  role    = "roles/serviceusage.serviceUsageConsumer"
  member  = "serviceAccount:${google_service_account.deploy_sa.email}"
}

# Output the service account email
output "deploy_sa_email" {
  description = "Email of the deployment service account"
  value       = google_service_account.deploy_sa.email
}
