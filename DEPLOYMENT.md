# Production Deployment — Vercel

This project is a Next.js application deployed through Vercel with PostgreSQL/Prisma. The old Oracle VM, PM2, and local PostgreSQL procedure is intentionally removed because it does not describe the production architecture.

## 1. Vercel project

Connect `Sugyan99/restaurant-billing-app` to Vercel and deploy the `main` branch.

Recommended project settings:

- Framework: Next.js
- Node.js: 24.x
- Install command: `npm ci`
- Build command: `npm run build`
- Region: `sin1`

## 2. Required environment variables

Set these in the Vercel Production environment. Add the same variables to Preview only when preview databases are intentionally configured.

### Database

- `DATABASE_URL` or `POSTGRES_PRISMA_URL`: privileged Prisma connection used only by administrative/authentication code.
- `APP_DATABASE_URL`: **required** dedicated non-superuser `prisma_app` connection with `NOBYPASSRLS` so PostgreSQL Row Level Security remains enforced for tenant-scoped application queries.

Do not point `APP_DATABASE_URL` at the privileged/admin connection.

### Authentication

- `JWT_SECRET`: long random production secret.
- Auth0 variables when Auth0 login is enabled: `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`.
- Supabase variables when Google/Supabase login is enabled: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### Optional integrations

- `GROQ_API_KEY` when AI features are enabled.

Never commit real secrets to GitHub. Never use `NEXT_PUBLIC_` for server-only secrets.

## 3. Database deployment

Prisma Client is generated automatically by `npm run build`.

Run schema migrations from a controlled migration environment using the direct/non-pooling database connection. Do not run destructive `prisma db push` automatically during every Vercel deployment.

Before production deployment:

```bash
npx prisma validate
npx prisma generate
npx prisma migrate deploy
npm run typecheck
npm run lint
npm run build
```

## 4. Multi-tenant security requirements

Every authenticated session must contain a valid `tenantId` in its JWT.

Tenant-scoped database operations must use `withTenant(tenantId, userId, callback)` and therefore run through the dedicated `prisma_app` role and RLS policies.

There is no production fallback from `APP_DATABASE_URL` to an admin database URL. A missing `APP_DATABASE_URL` intentionally causes the application to fail closed.

Do not reintroduce hard-coded tenant UUIDs as Prisma field defaults or authentication fallbacks.

## 5. Deployment verification

After Vercel reports a successful deployment:

1. Open the production URL.
2. Register/login with a valid owner account.
3. Verify the owner has exactly one tenant membership.
4. Create a second test tenant/user in a staging database.
5. Verify tenant A cannot read or mutate tenant B data.
6. Test login, orders, billing, inventory, and settings APIs.
7. Check Vercel runtime logs for 4xx/5xx errors.

## 6. Rollback

Use the Vercel deployment history to promote the last known-good deployment if a production release fails. Database migrations must be backward-compatible before application rollout.
