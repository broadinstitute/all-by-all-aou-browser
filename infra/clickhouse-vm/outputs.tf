# clickhouse-vm outputs
output "instance_name" {
  value = google_compute_instance.clickhouse_vm.name
}

output "internal_ip" {
  value = google_compute_instance.clickhouse_vm.network_interface[0].network_ip
}

output "external_ip" {
  value = google_compute_instance.clickhouse_vm.network_interface[0].access_config[0].nat_ip
}

# axaou-clickhouse-1 outputs
output "instance_name_1" {
  value = google_compute_instance.clickhouse_vm_1.name
}

output "internal_ip_1" {
  value = google_compute_instance.clickhouse_vm_1.network_interface[0].network_ip
}

output "external_ip_1" {
  value = google_compute_instance.clickhouse_vm_1.network_interface[0].access_config[0].nat_ip
}
