bucket         = "apotheon-terraform-state"
key            = "analytics/terraform.tfstate"
region         = "us-east-1"
dynamodb_table = "terraform-locks"
encrypt        = true
