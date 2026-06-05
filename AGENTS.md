# Fable — AGENTS.md

## What this is

Fable is an open source localisation platform for developer-led teams and open source projects. It's a Turbo monorepo built with: 

- Frontend: Next.js 16, React, TypeScript, Tailwind CSS, shadcn/ui
- Backend: tRPC, Node.js
- Database: Drizzle ORM, PostgreSQL
- Monorepo: Turbo
- Auth: Better Auth

## Setup Commands (Development)

- Prerequisites: Node.js 20+, npm 10+, Docker
- Install dependencies: `npm install`
- Start the Postgres and Redis containers: `docker compose up postgres redis -d`
- Configure environment variables: `.env.local`
- Symlink the .env.local to point at the root .env.local: `ln -s .env.local apps/web/.env.local`
- Push the database schema: `npm run db:push`
- Start the development server: `npm run dev`

A few things to know:

- The worker is only needed if you're testing MT translation or QA jobs. You can skip it and just use the web app for UI/auth/tRPC work.
- If you don't have Docker, you can use a free Supabase project instead — grab the connection string from Project Settings > Database and use the non-pooling URL for DIRECT_URL and the pooled one for DATABASE_URL.
- npm run db:studio opens Drizzle Studio in the browser so you can inspect tables while developing.

## Project Structure

- `apps/web` — Next.js App Router product UI
- `apps/worker` — BullMQ workers (mt-translate, qa-check, vcs-sync, webhook-delivery)
- `packages/db` — Drizzle schema, relations, migrations, postgres client
- `packages/auth` — Better Auth server config + client helper
- `packages/formats` — i18n format parsers/serialisers (JSON flat, JSON nested, YAML, PO)
- `packages/ai` — LLMAdapter interface + OpenAI gpt-4o-mini implementation + prompt builder
- `packages/qa` — QA check engine: placeholders, length, punctuation, whitespace
- `packages/ui` — shadcn-style components (Button, Badge, Input) + Tailwind CSS variables
- `packages/email` — React Email templates (InviteEmail, VerifyEmail)
- `packages/tsconfig` — Shared TypeScript configs (base, nextjs, react-library)

## Code Style

### Typescript

- Use TypeScript strictly - avoid `any` and `unknown` types.
- Prefer explicit types over inference when it improves clarity.
- Use `as const` when possible to enforce literal types.
- Follow existing patterns for types and interfaces.

### Naming Conventions

- Use kebab-case for file names and directories.
- Use PascalCase for component names and type names.
- Use camelCase for function names and variable names.
- Use UPPERCASE_SNAKE_CASE for constants.

### Writing & Text

- No en-dashes or em-dashes anywhere: not in comments, UI strings, labels, error messages, or documentation. Use a hyphen or rewrite the sentence.
- No filler phrases ("straightforward", "simply", "just", "easy", "let's explore", "certainly").

### Database Layer (/packages/db)

- Schema definitions in `src/schema.ts`
- Migrations: Create migrations with `cd packages/db && npm drizzle-kit generate --name <migration-name>`, then run `npm run db:push` to apply the changes.
- Repositories: Put database queries in `src/repository/` files
- Soft deletes: Use `deletedAt` timestamp for soft deletes (not hard deletes)

### API Layer (/packages/api)

All tRPC routers live in `packages/api`. The package is consumed by the Next.js app via `@fable/api` — the App Router API route at `apps/web/app/api/trpc/[trpc]/route.ts` passes the `Request` object to `createTRPCContext` and mounts `appRouter`.

**Structure:**

```
packages/api/src/
  index.ts            # re-exports: appRouter, AppRouter, createTRPCContext, procedures
  root.ts             # composes all routers into appRouter
  trpc.ts             # initTRPC, createTRPCContext, publicProcedure, protectedProcedure
  routers/
    organization.ts   # list, get, create, getOrCreate
    project.ts        # list, get, getPublic, create, update, addLocale
    translation.ts    # listKeys, upsert, updateState, suggest
    user.ts           # me, update
```

**Adding a router:**

1. Create `packages/api/src/routers/<name>.ts`. Export a `router({...})`.
2. Import and register it in `packages/api/src/root.ts`.
3. Use `protectedProcedure` for authenticated procedures, `publicProcedure` for open ones.
4. Validate all inputs with Zod `.input(z.object({...}))`.
5. Throw `TRPCError` with `UNAUTHORIZED`, `FORBIDDEN`, or `NOT_FOUND` as appropriate.
6. The `ctx` object provides `ctx.db` (Drizzle) and `ctx.session` (Better Auth session, typed as non-null in `protectedProcedure`).

**Authorization pattern:**

Check org membership before any resource access:

```typescript
const member = await ctx.db.query.orgMembers.findFirst({
  where: and(eq(orgMembers.userId, ctx.session.user.id), eq(orgMembers.orgId, input.orgId)),
});
if (!member) throw new TRPCError({ code: "FORBIDDEN" });
```

### Frontend (/apps/web)

- Components: Shared components in `components/` (e.g. `AppShell`, `AppSidebar`). Local UI primitives (shadcn-based) in `components/ui/` — prefer extending these over adding one-off inline styles.
- Pages: Route segments in `app/` using Next.js App Router conventions. Group routes with `(auth)` and `(dashboard)` layout groups.
- Styling: Tailwind CSS classes only. No inline styles. CSS variables for theming are defined in `app/globals.css`.
- shadcn/ui: Use shadcn components from `packages/ui` for shared primitives. For web-only UI pieces, drop them into `components/ui/` following the same pattern (export a single named component, use `cn()` for class merging).
- Server state: Use tRPC React Query hooks (`trpc.<router>.<procedure>.useQuery` / `useMutation`) for all server data. No raw `fetch` in components.
- Utilities: `lib/utils.ts` for shared helpers. `lib/trpc/` for tRPC client setup and routers.

## File Locations Reference

**Database (`packages/db`)**

- Schema: `packages/db/src/schema.ts`
- Relations: `packages/db/src/relations.ts`
- Client: `packages/db/src/client.ts`
- Migrations: run `npm run db:push` from repo root or `npm run db:generate` from `packages/db`

**tRPC (`packages/api`)**

- Routers: `packages/api/src/routers/*.ts` — register in `packages/api/src/root.ts`
- Server context + procedures: `packages/api/src/trpc.ts`
- tRPC route handler: `apps/web/app/api/trpc/[trpc]/route.ts`
- tRPC React client: `apps/web/lib/trpc/client.tsx`

**Frontend (`apps/web`)**

- App routes: `apps/web/app/` (route groups: `(auth)`, `(dashboard)`)
- Shared components: `apps/web/components/`
- shadcn UI primitives: `apps/web/components/ui/`
- Utilities: `apps/web/lib/utils.ts`

**AI package (`packages/ai`)**

- LLM adapter interface: `packages/ai/src/adapter.ts`
- OpenAI implementation: `packages/ai/src/openai.ts`
- Prompt builder: `packages/ai/src/prompt.ts`

**QA package (`packages/qa`)**

- Engine: `packages/qa/src/engine.ts`
- Check adapters: `packages/qa/src/checks/`

**Formats package (`packages/formats`)**

- Parsers/serialisers: `packages/formats/src/{json,yaml,po}.ts`

**Worker (`apps/worker`)**

- Job handlers: `apps/worker/src/jobs/{mt-translate,qa-check,vcs-sync,webhook}.ts`

## Database Patterns

- All queries use Drizzle ORM via `ctx.db` in tRPC procedures or `db` from `@fable/db` in the worker.
- Use `ctx.db.query.<table>.findMany/findFirst` with `with:` for reads that need relations.
- Use `ctx.db.insert/update/delete` for mutations.
- Use `ctx.db.transaction` for multi-step writes.
- Avoid N+1 queries by eager-loading relations in a single query via `with:`.
- Add indexes for columns used in `where` clauses on high-volume tables.

## API Patterns

- All API logic lives in tRPC routers under `packages/api/src/routers/`.
- Use `publicProcedure` for unauthenticated endpoints, `protectedProcedure` for anything requiring a session.
- Validate all inputs with Zod inline in `.input(z.object({...}))`.
- Return plain objects from procedures — no wrapper envelopes needed.
- Keep procedures thin: complex logic belongs in a separate function or `packages/` utility.

## Important Patterns

### Authorization

Use `protectedProcedure` from `packages/api/src/trpc.ts` for any procedure that requires authentication. It throws `TRPCError({ code: "UNAUTHORIZED" })` automatically if there is no session. Beyond authentication, verify that the authenticated user has access to the requested resource before returning or mutating data (e.g. check that `orgId` belongs to the session user before scoping a query).

### Error Handling

Use `TRPCError` with the appropriate code:

- `UNAUTHORIZED` — not logged in
- `FORBIDDEN` — logged in but lacks permission
- `NOT_FOUND` — resource does not exist
- `BAD_REQUEST` — invalid input not caught by Zod

Keep error messages user-facing where they will surface in the UI.

### Logging

No logger package exists. Use `console.log` / `console.error` for worker and server-side output. Keep messages minimal and structured (include job ID, queue name, relevant IDs). Never log sensitive data such as tokens, passwords, or full request bodies.

## Adding a New Feature

1. **Database**: update `packages/db/src/schema.ts` (and `relations.ts` if adding relations), then run `npm run db:push`.
2. **tRPC router**: add a procedure to an existing router in `packages/api/src/routers/` or create a new router file and register it in `packages/api/src/root.ts`.
3. **Frontend**: add UI in `apps/web/app/` or `apps/web/components/`, using tRPC React Query hooks for data.
4. **Worker** (async jobs only): add a job handler in `apps/worker/src/jobs/`, register a new Worker in `src/index.ts`, add a Queue in `src/queues.ts`.

## Adding a New Environment Variable

Update all of the following:

- `.env.example` — add the variable with an empty value and a comment explaining it
- `.env.local` — set the actual value locally
- `docker-compose.yml` — add to the `web` service `environment` section if needed at runtime
- `turbo.json` — add to `globalEnv` if the variable is consumed during `build` or `typecheck` tasks

## Database Changes

- Edit `packages/db/src/schema.ts` to add or modify tables and columns.
- Edit `packages/db/src/relations.ts` if adding foreign key relations.
- Run `npm run db:push` to apply changes to the dev database directly.
- Use `npm run db:generate` to produce an explicit migration file for production, then apply with `npm run db:migrate`.
- Never modify an already-applied migration file.

## Frontend Components

- Tailwind CSS classes only. No inline styles.
- Use `cn()` from `apps/web/lib/utils.ts` to merge conditional class names.
- Use shadcn components from `packages/ui` for shared primitives; add web-specific variants in `apps/web/components/ui/`.
- Use tRPC hooks for all server data. No raw `fetch` calls in components.
- Add loading and error states for async operations.

## Performance Considerations

- Eager-load relations with `with:` in Drizzle queries rather than issuing separate queries.
- Batch DB operations or use transactions for multi-step writes.
- Avoid N+1 queries in tRPC procedures.
- Rely on React Query's default stale-time and caching — do not force unnecessary refetches.

## Security

- Always verify that the authenticated user has access to the org or project before returning or mutating data.
- Validate all inputs with Zod at tRPC boundaries.
- Do not expose internal database IDs in URLs or API responses where a slug or scoped identifier suffices.
- Keep `BETTER_AUTH_SECRET` and `OPENAI_API_KEY` out of client-side code and logs.

## Dependencies

- Use `workspace:*` for internal package references (e.g. `"@fable/db": "workspace:*"`).
- Add external dependencies to the specific `package.json` of the app or package that needs them, not the root.
- Do not duplicate `tsconfig.json` settings across packages — extend from `packages/tsconfig`.

## Git & Commits

- Use conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, etc.
- Keep commits focused on a single change.
- Run `npm run lint` and `npm run typecheck` before committing.
- Never add `Co-authored-by` trailers to commit messages.

## PR Instructions

- Title format: `feat: description` or `fix: description`.
- Run `npm run lint` and `npm run typecheck` before opening a PR.
- Write a clear description of what changed and why.
- Include screenshots for UI changes.
- Keep PRs focused on a single feature or fix.
