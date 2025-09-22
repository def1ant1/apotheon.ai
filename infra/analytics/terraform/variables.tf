variable "environment" {
  description = "Environment name (e.g. staging, production)."
  type        = string
}

variable "docker_host" {
  description = "Docker daemon host URL (ex: tcp://staging-docker:2376)."
  type        = string
}

variable "docker_cert_path" {
  description = "Path to TLS certificates on disk (optional if using *_material variables)."
  type        = string
  default     = null
}

variable "docker_ca_material" {
  description = "Inline CA PEM contents."
  type        = string
  default     = null
  sensitive   = true
}

variable "docker_client_key" {
  description = "Inline client TLS key."
  type        = string
  default     = null
  sensitive   = true
}

variable "docker_client_cert" {
  description = "Inline client TLS certificate."
  type        = string
  default     = null
  sensitive   = true
}

variable "db_name" {
  description = "PostgreSQL database name."
  type        = string
  default     = "umami"
}

variable "db_user" {
  description = "PostgreSQL username."
  type        = string
  default     = "umami"
}

variable "db_password" {
  description = "PostgreSQL password."
  type        = string
  sensitive   = true
}

variable "app_secret" {
  description = "Umami APP_SECRET used for signing session cookies."
  type        = string
  sensitive   = true
}

variable "tracker_script_name" {
  description = "Custom file name for the Umami tracker script."
  type        = string
  default     = "apotheon-analytics.js"
}

variable "umami_port" {
  description = "Public port exposed by the Umami container."
  type        = number
  default     = 3000
}

variable "umami_host_override" {
  description = "Fallback host when Cloudflare DNS is disabled."
  type        = string
  default     = "localhost"
}

variable "umami_image" {
  description = "Optional override for the Umami container image."
  type        = string
  default     = ""
}

variable "postgres_image" {
  description = "Optional override for the PostgreSQL container image."
  type        = string
  default     = ""
}

variable "umami_log_level" {
  description = "Log level for the Umami container."
  type        = string
  default     = "info"
}

variable "analytics_hostname" {
  description = "DNS hostname for analytics ingress (omit to skip DNS record)."
  type        = string
  default     = ""
}

variable "cloudflare_api_token" {
  description = "API token with DNS edit permissions."
  type        = string
  default     = ""
  sensitive   = true
}

variable "cloudflare_zone" {
  description = "Cloudflare zone name."
  type        = string
  default     = ""
}

variable "cloudflare_target" {
  description = "Target hostname for the CNAME record (e.g. staging proxy)."
  type        = string
  default     = ""
}

variable "cloudflare_proxied" {
  description = "Whether to enable Cloudflare proxying for the analytics hostname."
  type        = bool
  default     = true
}
