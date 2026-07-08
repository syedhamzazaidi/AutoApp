# Remote state bucket is created by scripts/infra-bootstrap.sh before first init.
# Re-run bootstrap with TF_STATE_BUCKET set, or pass -backend-config=bucket=... on init.

terraform {
  backend "gcs" {
    prefix = "endian/terraform.tfstate"
  }
}
