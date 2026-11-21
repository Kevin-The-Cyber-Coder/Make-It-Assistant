# Deployment

This repository now contains container and Kubernetes manifests. They are templates: no image was built, pushed, or deployed as part of adding them.

## Containers

Three images are defined:

| Image | Dockerfile | Purpose |
| --- | --- | --- |
| API | `apps/api/Dockerfile` | Express API on port 4000, run with `tsx` from source |
| Web | `apps/web/Dockerfile` | Vite build served by nginx on port 80 |
| Worker | `apps/worker/Dockerfile` | Optional sandbox worker on port 4100 |

The web nginx config proxies `/api/` to the `api` service and falls back to `index.html` for client routes.

Build and run the full stack locally:

```bash
docker compose up --build
```

The API is at `http://localhost:4000` and the console at `http://localhost:8080`. Set real secrets in a local `.env` file before using anything beyond development. `docker compose up -d mongo redis` still works for local API development.

## Kubernetes

Manifests live in `deploy/kubernetes/`. They create the `make-it-ai` namespace, a Mongo deployment with a PVC, Redis, two API replicas, two web replicas, one worker, an nginx ingress and a ConfigMap.

```bash
# 1. Create the Secret out of band. Never commit real values.
kubectl create namespace make-it-ai
kubectl -n make-it-ai create secret generic mia-secrets \
  --from-literal=JWT_SECRET='replace-with-32-plus-random-characters' \
  --from-literal=MONGODB_URI='mongodb://mongo:27017/make_it_ai' \
  --from-literal=REDIS_URL='redis://redis:6379'

# 2. Edit configmap.yaml and ingress.yaml with the real public host.
# 3. Apply everything except secrets.example.yaml.
kubectl apply -k deploy/kubernetes
```

`kustomization.yaml` deliberately excludes `secrets.example.yaml`. Update the image references in `api.yaml`, `web.yaml` and `worker.yaml` to registries you control; the `ghcr.io` paths are placeholders, not published images. TLS expects a `mia-tls` secret in the namespace.

## Production prerequisites

- Set `JWT_SECRET` to at least 32 random characters. Env validation enforces this.
- Set `MONGODB_URI` and `REDIS_URL` so replicas share state and rate limits. Without them each API replica falls back to its own JSON file or in-process stores.
- Set `CLIENT_ORIGIN` and `GITHUB_OAUTH_REDIRECT_URI` to the real public origin.
- Keep `SANDBOX_URL` empty unless the worker is deployed and `SANDBOX_TOKEN` is set. The worker is not a hardened multi-tenant boundary.
- The API exposes `/healthz` for liveness and `/readyz` for readiness probes. The Kubernetes API deployment uses `/readyz` for readiness and `/healthz` for liveness.
- The API runs TypeScript through `tsx` in the image. A compiled JavaScript image is preferable for a high-volume deployment.
- Run behind TLS. Set `GITHUB_OAUTH_COOKIE_SAMESITE=none` only when the API and console are on different registrable domains, and only over HTTPS.

## Not covered

No Helm chart, Terraform module, autoscaling policy, backup/restore job, service-mesh policy, image signing, vulnerability scanning or production rollout is included here. These manifests are a starting point, not a certified production topology.
