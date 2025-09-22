# A tiny convenience wrapper so developers can bootstrap the analytics stack
# without memorizing docker-compose or Terraform commands. Targets intentionally
# encapsulate env var loading so CI/CD can invoke them in exactly the same way.

include .env

.PHONY: local-up local-down local-logs local-reset staging-init staging-plan staging-apply staging-destroy

local-up:
@echo "[analytics] Starting local Umami stack..."
docker compose --project-name apotheon-analytics --env-file .env up -d

local-down:
@echo "[analytics] Stopping local Umami stack..."
docker compose --project-name apotheon-analytics --env-file .env down

local-logs:
docker compose --project-name apotheon-analytics logs -f

local-reset: local-down
docker volume rm apotheon-analytics_postgres-data || true
$(MAKE) local-up

staging-init:
terraform -chdir=terraform init

staging-plan:
terraform -chdir=terraform plan -out=tfplan

staging-apply: staging-plan
terraform -chdir=terraform apply tfplan

staging-destroy:
terraform -chdir=terraform destroy -auto-approve
