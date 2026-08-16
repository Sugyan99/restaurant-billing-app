# Production Deployment Guide

## Current architecture

- Main Panel: Next.js + Prisma
- Database: Supabase PostgreSQL project `Billing Software`
- Main Panel deployment: Vercel project `restaurant-billing-app`
- Admin Panel: separate `restobill-super-admin` repository, using the same Supabase PostgreSQL database
- Never commit database passwords, service-role keys, or production connection strings

## Main Panel environment variables

Configure these in the Vercel project for the required environments:

```text
DATABASE_URL
POSTGRES_PRISMA_URL
POSTGRES_URL
APP_DATABASE_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

`POSTGRES_PRISMA_URL` / `DATABASE_URL` must resolve to the current Supabase project. The application normalizes a direct `db.<project-ref>.supabase.co:5432` URL to the Supavisor session pooler in `ap-south-1` and limits Prisma to one connection per serverless instance.

`APP_DATABASE_URL` is used by the RLS-enforced Prisma client when configured. It must point to the same current Supabase database and use credentials appropriate for the tenant-scoped client.

The browser must use only the publishable/anon Supabase key. Never expose a service-role or database password through `NEXT_PUBLIC_*` variables.

## Admin Panel environment variables

The admin backend is server-only and uses:

```text
SUPER_ADMIN_DATABASE_URL
# fallback: DATABASE_URL
```

This connection must point to the same Supabase PostgreSQL database used by the Main Panel. Do not place this value in client-side code.

## Deployment

Vercel should deploy the `main` branch of `Sugyan99/restaurant-billing-app`.

After a database-client change:

```bash
npm ci
npx prisma generate
npm run build
```

The Admin Panel should be built and deployed from `Sugyan99/restobill-super-admin` using the same database target.

## Verification checklist

1. Confirm all database environment variables exist in the target deployment environment.
2. Confirm the Supabase project reference is `ybpbwwpnrvtfaeqqmqgg`.
3. Confirm Prisma connects through the current pooler/direct configuration without P1001 or max-session errors.
4. Confirm the Admin Panel can read `tenants`, `tenant_memberships`, `"User"`, and `"Bill"`.
5. Confirm tenant-scoped queries return no cross-tenant rows.
6. Confirm no database password or service-role key is committed to Git.
7. Run a production smoke test for login, tenants, orders, bills, and tables after deployment.
