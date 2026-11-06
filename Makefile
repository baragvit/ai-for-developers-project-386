.DEFAULT_GOAL := help
.PHONY: help install contract mock dev-mock dev-backend dev-frontend build start lint typecheck test e2e check docker-build docker-run

help:
	@echo "make install       - install dependencies of all workspaces"
	@echo "make contract      - compile TypeSpec -> OpenAPI and regenerate client/server types"
	@echo "make mock          - Prism mock of the API on :4010 (from api-contract/openapi.yaml)"
	@echo "make dev-mock      - frontend dev server on :5391 proxied to the Prism mock"
	@echo "make dev-backend   - backend in watch mode on :7341"
	@echo "make dev-frontend  - frontend dev server on :5391 proxied to the backend"
	@echo "make build         - production build of frontend and backend"
	@echo "make start         - run the production build on :7341 (API + SPA)"
	@echo "make lint | typecheck | test | e2e"
	@echo "make check         - all checks (mise run check), same as CI"
	@echo "make docker-build  - build the Docker image"
	@echo "make docker-run    - run the image on :8080"

install:
	npm ci

contract:
	npm run contract

mock:
	npm run mock

dev-mock:
	API_PROXY_TARGET=http://127.0.0.1:4010 npm run dev:frontend

dev-backend:
	npm run dev:backend

dev-frontend:
	npm run dev:frontend

build:
	npm run build

start:
	npm start

lint:
	npm run lint

typecheck:
	npm run typecheck

test:
	npm test

e2e:
	npm run test:e2e

check:
	mise run check

docker-build:
	docker build -t call-booking .

docker-run:
	docker run --rm -p 8080:8080 call-booking
