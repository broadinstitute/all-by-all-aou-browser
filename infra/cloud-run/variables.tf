variable "project_id" {
  description = "GCP project ID"
  type        = string
  default     = "aou-neale-gwas-browser"
}

variable "region" {
  description = "GCP region for Cloud Run services"
  type        = string
  default     = "us-central1"
}

variable "env" {
  description = "Environment name (dev, prod)"
  type        = string
  default     = "dev"
}

variable "frontend_image" {
  description = "Frontend Docker image name (without registry prefix)"
  type        = string
  default     = "axaou-frontend"
}

variable "backend_image" {
  description = "Backend Docker image name (without registry prefix)"
  type        = string
  default     = "axaou-backend"
}

variable "min_instances" {
  description = "Minimum number of Cloud Run instances"
  type        = number
  default     = 0
}

variable "max_instances" {
  description = "Maximum number of Cloud Run instances"
  type        = number
  default     = 5
}
