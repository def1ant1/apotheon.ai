# Analytics Infrastructure

This directory contains the **single source of truth** for the Apothéon
analytics stack. We intentionally chose the open-source [Umami](https://umami.is)
project because it aligns with our privacy-first philosophy and ships with a
lightweight footprint that runs identically on developer laptops and staging.

The repository offers two entry points:

- [`docker-compose.yml`](./docker-compose.yml) for local prototyping and
  integration testing. The compose stack encapsulates PostgreSQL + Umami and
  exposes the Umami dashboard on `http://localhost:${UMAMI_PORT}`.
- [`terraform/`](./terraform) for staging (and production) environments. The
  module targets any Docker-compatible host (Kubernetes, ECS, Nomad, etc.) by
  talking to the Docker daemon over TLS. We prefer Terraform here so the rollout
  is auditable, reviewed, and reproducible.

> **Zero manual steps**: Every command below is fully scripted — no hidden
> toggles in a UI. This makes on-call rotations and compliance audits trivial.

## Quickstart

```bash
cd infra/analytics
cp .env.example .env # update secrets or export via direnv
make local-up        # boots PostgreSQL + Umami in ~5 seconds
```

Browse `http://localhost:3000` and log in with the admin credentials you supply
via `.env`. When you are finished testing, shut everything down with
`make local-down`.

`make local-reset` is a convenience wrapper that **destroys** the local volume
and re-creates the stack, which is handy when resetting the database between
integration tests.

## Terraform staging deployment

1. Ensure the remote Docker host (for staging we use a managed container
   runtime) exposes a TLS endpoint. Export `DOCKER_HOST`, `DOCKER_CERT_PATH`, and
   `DOCKER_TLS_VERIFY=1` to point Terraform at the daemon.
2. Populate [`terraform/terraform.tfvars`](./terraform/terraform.tfvars.example)
   with stage-specific overrides (passwords, hostnames, CDN origins, etc.).
3. Deploy:

```bash
make staging-init
make staging-apply
```

The Terraform plan provisions:

- An isolated Docker network and volume for persistence
- A hardened PostgreSQL container with automated health checks
- The Umami web container wired to the analytics Worker ingress
- Optional Cloudflare DNS records so staging mirrors production hostnames

Destroying the environment is just as easy: `make staging-destroy`.

## Operational runbooks

- `make local-logs` tails both containers with timestamps to help debug
  ingestion failures.
- Terraform state lives in the remote backend configured via
  `terraform.backend.hcl`. We default to an S3 bucket with encryption enabled;
  update the backend file as needed for your cloud of choice.
- The [`workers/analytics-proxy.ts`](../../workers/analytics-proxy.ts) Cloudflare
  Worker signs and rate-limits client beacons before forwarding them to Umami.
  When staging deployments complete, update the Worker secrets via
  `wrangler secret put` as outlined in `docs/dev/PRIVACY.md`.

## Why this approach?

- **Automated**: Both local and staging workflows run from `make` targets,
  keeping the developer experience frictionless.
- **Auditable**: Terraform outputs the change set before any apply, which is
  crucial for security review and SOC 2 controls.
- **Portable**: Everything runs in containers, so migrating to another provider
  is just a Terraform variable change away.
