# Optional Terraform for multi-env Supabase provisioning (Phase 6)
# Not required for POC — use Supabase CLI instead.
#
# When needed:
# 1. terraform init
# 2. Import existing project: terraform import supabase_project.main <project-ref>
# 3. Keep SQL migrations in apps/scaffold/supabase/migrations/

# terraform {
#   required_providers {
#     supabase = {
#       source  = "supabase/supabase"
#       version = "~> 1.0"
#     }
#   }
# }

# variable "supabase_access_token" {
#   type      = string
#   sensitive = true
# }

# provider "supabase" {
#   access_token = var.supabase_access_token
# }

# resource "supabase_project" "main" {
#   organization_id   = var.organization_id
#   name              = "endian-scaffold"
#   database_password = var.database_password
#   region            = "us-east-1"
# }
