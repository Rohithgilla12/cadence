# syntax=docker/dockerfile:1.7
# Multi-stage build: Alpine for compile, distroless for runtime.
# Final image is ~15MB, has no shell, runs as nonroot.

FROM golang:1.25-alpine AS build
WORKDIR /src

# Keep the dependency layer separate so changes to source don't bust the cache.
COPY go.mod go.sum ./
RUN go mod download

COPY . .

# CGO_ENABLED=0 so the binary is fully static — required for distroless/static.
# -trimpath strips local paths from the binary; -ldflags '-s -w' drops the
# debug + symbol tables to shave a few MB.
RUN CGO_ENABLED=0 GOOS=linux \
    go build -trimpath -ldflags='-s -w' -o /out/api ./cmd/api
RUN CGO_ENABLED=0 GOOS=linux \
    go build -trimpath -ldflags='-s -w' -o /out/worker ./cmd/worker

# Runtime image — distroless/static is ~2MB and contains no shell, no apt,
# no busybox. The binary runs as the 'nonroot' user (uid 65532) by default.
FROM gcr.io/distroless/static-debian12:nonroot

# OCI labels: GHCR auto-links the published image to this repo on the
# package UI when source matches the canonical GitHub URL.
LABEL org.opencontainers.image.source="https://github.com/Rohithgilla12/cadence"
LABEL org.opencontainers.image.description="Cadence API — habit tracker with context-aware analytics"
LABEL org.opencontainers.image.licenses="proprietary"

WORKDIR /app
COPY --from=build /out/api /app/api
COPY --from=build /out/worker /app/worker

# CA certificates are needed for outbound HTTPS to Firebase + Strava.
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt

USER nonroot:nonroot
EXPOSE 8080

ENTRYPOINT ["/app/api"]
