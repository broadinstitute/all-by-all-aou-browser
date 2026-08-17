terraform {
  backend "gcs" {
    bucket = "axaou-browser-tf"
    prefix = "tf/lb"
  }
}
