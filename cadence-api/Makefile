.PHONY: run worker build test lint tidy fmt db-up db-down db-shell db-logs db-reset db-create-test

run:
	go run ./cmd/api

worker:
	go run ./cmd/worker

build:
	go build -o bin/api ./cmd/api
	go build -o bin/worker ./cmd/worker

test:
	go test ./...

lint:
	golangci-lint run ./...

tidy:
	go mod tidy

fmt:
	gofmt -s -w .

db-up:
	docker compose -f deploy/docker-compose.dev.yml up -d
	@echo "Postgres on localhost:5433 (user cadence, db cadence)"

db-down:
	docker compose -f deploy/docker-compose.dev.yml down

db-shell:
	docker exec -it cadence-postgres-dev psql -U cadence -d cadence

db-logs:
	docker compose -f deploy/docker-compose.dev.yml logs -f postgres

db-reset:
	docker compose -f deploy/docker-compose.dev.yml down -v
	$(MAKE) db-up

db-create-test:
	docker exec -i cadence-postgres-dev psql -U cadence -d postgres -c "CREATE DATABASE cadence_test;" || true
