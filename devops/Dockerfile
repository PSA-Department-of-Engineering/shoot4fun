# devops/Dockerfile: monorepo build entry point (REF-Homelab §4)
# The CI's conformance suite expects a devops/Dockerfile and references it from
# docker-compose.yml. The concrete image builds come from each service's own
# Dockerfile via docker-compose.yml; this file is the root build for the
# platform's single-Dockerfile fallback path.
FROM alpine:3.20 AS scratch
WORKDIR /build
COPY backend/ backend/
COPY apps/client/ apps/client/
