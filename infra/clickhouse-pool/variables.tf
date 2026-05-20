variable "project_id" {
  description = "GCP project ID"
  type        = string
  default     = "aou-neale-gwas-browser"
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "snapshot_name" {
  description = "Name of the ClickHouse data disk snapshot to use for replicas"
  type        = string
  default     = "axaou-clickhouse-1-data-pd-snap-20260520-1923"
}

variable "machine_type" {
  description = "Machine type for ClickHouse replicas (CPU-optimized recommended)"
  type        = string
  default     = "n2-highcpu-8"
}

variable "min_replicas" {
  description = "Minimum number of ClickHouse replicas"
  type        = number
  default     = 1
}

variable "max_replicas" {
  description = "Maximum number of ClickHouse replicas"
  type        = number
  default     = 3
}

variable "data_disk_size_gb" {
  description = "Size of data disk (must be >= snapshot size)"
  type        = number
  default     = 750
}
