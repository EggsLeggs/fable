# Fable

Fable is an open source localisation platform for developer led teams and open source projects. Manage translation keys, import and export i18n files, collaborate with translators, and ship multilingual software.

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/fable?referralCode=CK_2K4&utm_medium=integration&utm_source=template&utm_campaign=generic)

## Deploy on Railway

### About Hosting Fable

Hosting Fable requires PostgreSQL for all application data and Redis for background job queues. The main web service is a Next.js application that serves the UI, tRPC API, and authentication. A separate worker service is recommended to process machine translation, QA checks, repository sync, and webhook delivery jobs. Database schema is applied via a one off Drizzle migration service before or alongside your web deploy. OpenAI, Stripe, and GitHub App credentials are optional; those features stay disabled until you add them. Railway simplifies deployment by provisioning Postgres and Redis, wiring environment variables between services, and running health checks against `/api/health`.

### Common Use Cases

- Team translation management for software projects shipping in multiple languages
- Self hosted localisation hub for open source projects accepting community contributions
- Internal CAT workflow with AI pre translation, QA checks, and format agnostic import/export

### Dependencies for Fable Hosting

- **PostgreSQL** (required) - Primary database for projects, keys, translations, users, and billing state
- **Redis** (required) - BullMQ job queues connecting the web app to background workers
- **Web service** (required) - Next.js application serving the product UI and API
- **Worker service** (recommended) - Processes MT, QA, VCS sync, and webhook jobs
- **OpenAI API key** (optional) - Enables AI powered machine translation
- **Stripe** (optional) - Enables Pro subscriptions and metered MT billing
- **GitHub App** (optional) - Enables repository sync and pull request workflows

### Deployment Dependencies

- [Railway PostgreSQL Service](https://railway.com/template/postgres)
- [Railway Redis Service](https://railway.com/template/redis)
- [Better Auth](https://www.better-auth.com/docs)
- [OpenAI API](https://platform.openai.com/docs) (optional)
- [Stripe](https://stripe.com/docs) (optional)
- [GitHub Apps](https://docs.github.com/en/apps/creating-github-apps) (optional)

### Why Deploy Fable on Railway?

Railway provides managed PostgreSQL and Redis that link directly into your Fable web and worker services. Each app ships with its own `railway.json` and Dockerfile, so you can deploy the web app, worker, and migration job as separate services in one project. Environment variables like `DATABASE_URL` and `REDIS_URL` are injected automatically when you link services, and the web deploy health check confirms the app is ready before traffic routes over. Railway handles scaling, restarts, and infrastructure management, so you can self host a full localisation platform without running your own servers or wiring up queues and databases manually.

## Local Development

Prerequisites: Node.js 20+, npm 10+, Docker.

```bash
npm install
docker compose up postgres redis -d
cp .env.example .env.local
ln -s ../../.env.local apps/web/.env.local
npm run db:push
npm run dev
```

See [AGENTS.md](./AGENTS.md) for full project structure, conventions, and environment variable reference.
