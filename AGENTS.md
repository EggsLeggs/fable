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

- To use Stripe's local webhook, run `stripe listen --forward-to localhost:3000/api/stripe/webhook`
- The worker is only needed if you're testing MT translation or QA jobs. You can skip it and just use the web app for UI/auth/tRPC work.
- If you don't have Docker, you can use a free Supabase project instead — grab the connection string from Project Settings > Database and use the non-pooling URL for DIRECT_URL and the pooled one for DATABASE_URL.
- npm run db:studio opens Drizzle Studio in the browser so you can inspect tables while developing.

## Project Structure

- `apps/web` — Next.js App Router product UI
- `apps/worker` — BullMQ workers (mt-translate, qa-check, vcs-sync, webhook-delivery)
- `packages/db` — Drizzle schema, relations, migrations, postgres client
- `packages/auth` — Better Auth server config + client helper
- `packages/formats` - i18n format adapters. Each adapter implements `FormatAdapter` (parse, parseTranslation, serialize, defaultOutputPattern). To add a format: create `src/<name>.ts`, implement `FormatAdapter`, add to the registry in `src/detect.ts`, and export from `src/index.ts`.
- `packages/ingest` - core ingest logic + VcsProvider interface. GitHub provider lives in `src/providers/github.ts`. To add a provider (GitLab, Bitbucket) implement `VcsProvider` and export a factory from a new file in `src/providers/`.
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
- Always display users by `name` as the primary label in the UI and activity feed. Show their handle (the `username` field, as `@handle`) in muted text where space allows. Fall back to `email` only if `name` is null.

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

- Format adapters: `packages/formats/src/{json,yaml,po,lingui-json}.ts`

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

## Activity Log

The `activity_log` table (`packages/db/src/schema.ts`) records project events. When adding a new feature that creates, updates, or deletes a significant resource, call `logActivity` (from `packages/api/src/log-activity.ts`) after the mutation succeeds.

- Use `@fable/api/log-activity` in Next.js API route handlers.
- Use `../log-activity` (relative) inside tRPC routers.
- Pick the closest existing `ActivityType` enum value or add a new one to `activityTypeEnum` in the schema.
- Set `locale` on the log entry when the event is locale-specific (locale added/removed, locale-scoped task, etc.).
- Store enough context in `metadata` that the activity feed can render a human-readable sentence without a follow-up DB lookup.

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

## Localisation

Fable uses [Lingui v5](https://lingui.dev) for i18n. Catalogs live at `apps/web/locales/` and the runtime provider lives in `apps/web/components/lingui-provider.tsx`.

### Supported locales

| Code | Language |
|------|----------|
| `en` | English (source) |
| `fr` | Français |
| `de` | Deutsch |
| `es` | Español |
| `it` | Italiano |
| `nl` | Nederlands |
| `ru` | Русский |
| `pl` | Polski |
| `pt-BR` | Português (Brasil) |

### Directory structure

```
apps/web/
  lingui.config.ts          # Lingui config (locales, catalog paths, format)
  i18n.json                 # Lingo.dev config for automated translation CI
  locales/
    index.ts                # Locale types, defaultLocale, localeNames
    en/
      messages.json         # Source catalog (updated by lingui extract)
      messages.ts           # Compiled catalog (generated, do not edit)
    fr/
      messages.json
      messages.ts
    ...                     # Same for de, es, it, nl, ru, pl, pt-BR
  lib/
    i18n.ts                 # initializeI18n, activateLocale, i18n singleton
  components/
    lingui-provider.tsx     # LinguiProvider, useLingui hook
```

### Marking strings for translation

Import macros from `@lingui/core/macro` (plain strings) or `@lingui/react/macro` (JSX):

```typescript
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";

// Plain string (attributes, toast messages, etc.)
const label = t`Save changes`;

// JSX content
<p><Trans>Welcome to <strong>Fable</strong></Trans></p>

// With variables
const msg = t`Deleting project "${name}"`;

// Plurals (ICU MessageFormat)
const count = t`{count, plural, one {# key} other {# keys}}`;
```

### Development workflow

1. Wrap new UI strings with `t\`...\`` or `<Trans>`.
2. Run `npm run lingui:extract` from the repo root to update the `.json` catalogs.
3. Send the non-English `.json` files to translators (or use Lingo.dev CI).
4. Run `npm run lingui:compile` before building to regenerate the `.ts` files.

The compiled `.ts` files are committed to the repository so the build does not require a compile step at deploy time.

### Adding a new locale

1. Add the locale code to the `locales` array in `apps/web/locales/index.ts` and add its display name to `localeNames`.
2. Add the code to the `locales` array in `apps/web/lingui.config.ts` and to the `targets` list in `apps/web/i18n.json`.
3. Run `npm run lingui:extract` — Lingui will create `locales/<code>/messages.json`.
4. Run `npm run lingui:compile` to generate `messages.ts`.
5. Add a dynamic import case for the new locale in `apps/web/lib/i18n.ts` (in the `loadMessages` switch).

### Reading the active locale in components

```typescript
import { useLingui } from "@/components/lingui-provider";

export function LocaleSwitcher() {
  const { locale, setLocale, availableLocales } = useLingui();
  // ...
}
```

`setLocale` persists the choice to `localStorage` and activates the new catalog asynchronously.

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

## Billing & Pricing

### Tier limits

| | Free | Pro | Enterprise |
|---|---|---|---|
| Price | $0 | $29/mo or $313/yr (10% off) | Coming soon |
| Projects | 1 | Unlimited | Unlimited |
| Members | 3 | Unlimited | Unlimited |
| Translation keys | 1,000 | Unlimited | Unlimited |
| MT included | none | 50k chars/mo | Custom |
| MT overage | n/a | $2/100k chars | Custom |
| Webhooks | No | Yes | Yes |
| Glossary | No | Yes | Yes |

Limit constants live in `packages/stripe/src/prices.ts` (`PLAN_LIMITS`). Enterprise is schema-ready (`plan` enum includes `"enterprise"`) but not sold yet.

### Stripe package (`packages/stripe`)

- `src/client.ts` - Stripe singleton (`stripe` export), requires `STRIPE_SECRET_KEY`
- `src/prices.ts` - `PLAN_LIMITS`, `PRICE_IDS`, price constants
- `src/checkout.ts` - `createCheckoutSession(...)` - creates a Checkout Session with the Pro flat price and the MT metered price as line items
- `src/portal.ts` - `createPortalSession(...)` - opens the Stripe billing portal
- `src/usage.ts` - `reportMtUsage(stripeCustomerId, chars)` reports to Stripe; `resetMtUsageIfDue(user)` lazily zeroes `mtCharsUsed` every 30 days (handles annual plan monthly resets)

### Billing state on the `user` table

Columns: `plan`, `planStatus`, `billingCycle`, `stripeCustomerId`, `stripeSubscriptionId`, `planCurrentPeriodEnd`, `mtCharsUsed`, `mtCharsResetAt`, `mtCharsCap`.

Billing belongs to the user, not the org. The org owner's plan governs limits for their projects and members. MT chars are pooled across all orgs the user owns. Webhook matches by `session.metadata.userId`.

### tRPC billing router (`packages/api/src/routers/billing.ts`)

All procedures use `ctx.session.user.id` directly - no `orgId` input needed.

- `billing.getUsage` - plan info + usage counts (projects, members, keys, MT chars across all user's orgs)
- `billing.checkout` - returns Stripe Checkout URL
- `billing.portal` - returns Stripe billing portal URL
- `billing.updateMtCap` - sets `mtCharsCap` on the user (null = uncapped, still billed)

### Webhook handler (`apps/web/app/api/stripe/webhook/route.ts`)

Handles: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`. User is matched via `session.metadata.userId` set at checkout creation. Uses raw `req.text()` body for Stripe signature verification.

### Enforcing limits

To check limits on an org resource, look up the org owner's plan:

```typescript
const owner = await ctx.db.query.orgMembers.findFirst({
  where: and(eq(orgMembers.orgId, input.orgId), eq(orgMembers.role, "owner")),
  with: { user: { columns: { plan: true } } },
});
if (owner?.user.plan === "free") {
  const [{ value }] = await ctx.db.select({ value: count() }).from(table).where(...);
  if (value >= PLAN_LIMITS.free.someLimit) {
    throw new TRPCError({ code: "FORBIDDEN", message: "LIMIT_REACHED" });
  }
}
```

Currently enforced: `project.create` (1 project on free), `organization.inviteMember` (3 members on free).

### MT usage in the worker

`apps/worker/src/jobs/mt-translate.ts` finds the org owner via `orgMembers`, calls `resetMtUsageIfDue(owner)`, checks `mtCharsCap`, translates, then increments `mtCharsUsed` on the owner's user row and calls `reportMtUsage(owner.stripeCustomerId, charCount)`. Usage is pooled across all the owner's orgs.

### Annual billing note

For annual plans, Stripe's `invoice.paid` fires once per year. MT usage is reset monthly via the lazy `resetMtUsageIfDue` helper regardless of billing cycle. Stripe accumulates metered records and bills them at annual renewal (the overage cap protects users from surprises).

### Frontend

- Public pricing page: `apps/web/app/pricing/page.tsx`
- Billing settings: `apps/web/app/(dashboard)/settings/billing/page.tsx`

### Environment variables

```
STRIPE_SECRET_KEY            Secret key from Stripe dashboard
STRIPE_WEBHOOK_SECRET        Signing secret for webhook endpoint
STRIPE_PRO_MONTHLY_PRICE_ID  Price ID for Fable Pro monthly ($29)
STRIPE_PRO_ANNUAL_PRICE_ID   Price ID for Fable Pro annual ($313.20)
STRIPE_MT_METERED_PRICE_ID   Price ID for MT Characters metered product
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY  Publishable key (client-side)
```

Local webhook testing: `stripe listen --forward-to localhost:3000/api/stripe/webhook`

### Stripe dashboard setup

1. Create product "Fable Pro" with two prices: monthly ($29) and annual ($313.20)
2. Create a Meter (Billing > Meters, event name: `mt_characters`, aggregation: sum), then create product "MT Characters" with a usage-based price attached to that meter at $0.00002/unit (1 unit = 1 char, code reports raw char counts)
3. Copy the four price IDs into `.env.local`
4. Create a webhook endpoint at `https://yourdomain.com/api/stripe/webhook` subscribing to: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`

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
