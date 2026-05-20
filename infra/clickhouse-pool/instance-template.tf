# Instance template for ClickHouse read replicas.
# Each replica boots with a data disk created from a snapshot of the
# primary ClickHouse instance, so it has a full copy of all data.

resource "google_compute_instance_template" "clickhouse_replica" {
  name_prefix  = "axaou-ch-replica-"
  project      = var.project_id
  machine_type = var.machine_type
  region       = var.region

  # Replace template on change (MIG handles rolling update)
  lifecycle {
    create_before_destroy = true
  }

  service_account {
    email  = data.google_service_account.large_vm_sa.email
    scopes = ["cloud-platform"]
  }

  network_interface {
    network = data.google_compute_network.vpc_network.self_link
    # No external IP — internal only
  }

  # Boot disk
  disk {
    auto_delete  = true
    boot         = true
    source_image = "debian-cloud/debian-12"
    disk_size_gb = 50
    disk_type    = "pd-ssd"
  }

  # Data disk from snapshot
  disk {
    auto_delete  = true
    boot         = false
    disk_size_gb = var.data_disk_size_gb
    disk_type    = "pd-ssd"
    source_snapshot = data.google_compute_snapshot.ch_data.self_link
  }

  metadata = {
    startup-script = file("${path.module}/startup-replica.sh")
  }

  tags = ["clickhouse"]
}
