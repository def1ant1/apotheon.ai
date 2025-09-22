terraform {
  required_version = ">= 1.8.0"

  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.44"
    }
  }

  backend "s3" {
    # Values provided via terraform.backend.hcl or CLI flags.
  }
}

locals {
  labels = {
    project     = "apotheon"
    environment = var.environment
    service     = "analytics"
  }

  umami_image = var.umami_image != "" ? var.umami_image : "ghcr.io/umami-software/umami:postgresql-latest"
  postgres_image = var.postgres_image != "" ? var.postgres_image : "postgres:16-alpine"
}

provider "docker" {
  host     = var.docker_host
  cert_path = var.docker_cert_path
  ca_material   = var.docker_ca_material
  client_key_material = var.docker_client_key
  client_cert_material = var.docker_client_cert
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

data "cloudflare_zones" "selected" {
  count = var.cloudflare_zone != "" ? 1 : 0
  filter {
    name = var.cloudflare_zone
  }
}

resource "docker_network" "analytics" {
  name   = "${var.environment}-analytics"
  labels = [for k, v in local.labels : {
    label = k
    value = v
  }]
}

resource "docker_volume" "postgres" {
  name   = "${var.environment}-analytics-postgres"
  labels = [for k, v in local.labels : {
    label = k
    value = v
  }]
}

resource "docker_container" "postgres" {
  name  = "${var.environment}-analytics-postgres"
  image = local.postgres_image

  restart     = "unless-stopped"
  network_mode = docker_network.analytics.name

  env = [
    "POSTGRES_DB=${var.db_name}",
    "POSTGRES_USER=${var.db_user}",
    "POSTGRES_PASSWORD=${var.db_password}",
  ]

  mounts {
    target = "/var/lib/postgresql/data"
    source = docker_volume.postgres.name
    type   = "volume"
  }

  healthcheck {
    test     = ["CMD-SHELL", "pg_isready -d ${var.db_name} -U ${var.db_user}"]
    interval = "10s"
    timeout  = "5s"
    retries  = 5
  }

  labels = {
    for k, v in local.labels : k => v
  }
}

resource "docker_container" "umami" {
  name  = "${var.environment}-analytics-umami"
  image = local.umami_image

  restart     = "unless-stopped"
  network_mode = docker_network.analytics.name

  env = [
    "DATABASE_URL=postgresql://${var.db_user}:${var.db_password}@${docker_container.postgres.name}:5432/${var.db_name}",
    "APP_SECRET=${var.app_secret}",
    "TRACKER_SCRIPT_NAME=${var.tracker_script_name}",
    "DISABLE_TELEMETRY=true",
    "LOG_LEVEL=${var.umami_log_level}",
  ]

  ports {
    internal = 3000
    external = var.umami_port
  }

  depends_on = [docker_container.postgres]

  command = ["/bin/sh", "-c", "node prisma/migrate.js && node server/index.js"]

  labels = {
    for k, v in local.labels : k => v
  }
}

resource "cloudflare_record" "analytics" {
  count = var.cloudflare_zone != "" && var.analytics_hostname != "" ? 1 : 0

  zone_id = data.cloudflare_zones.selected[0].zones[0].id
  name    = var.analytics_hostname
  type    = "CNAME"
  value   = var.cloudflare_target
  ttl     = 300
  proxied = var.cloudflare_proxied

  comment = "${var.environment} analytics ingress"
}

output "umami_url" {
  value = "http://${var.analytics_hostname != "" ? var.analytics_hostname : var.umami_host_override}:${var.umami_port}"
}

output "postgres_container" {
  value = docker_container.postgres.name
}

output "umami_container" {
  value = docker_container.umami.name
}
