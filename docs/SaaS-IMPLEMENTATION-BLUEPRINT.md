# Mobile Inventory SaaS implementation blueprint

## Target topology

- **Web app:** Next.js on Vercel. Use it for the shop portal, public storefronts, and the super-admin portal. The browser talks to the Express API; Vercel server functions must not become a second database access path.
- **API:** Node.js/Express on Fly.io. Keep the API stateless, horizontally scalable, and deploy it independently from the web app. Use health checks, graceful shutdown, structured request IDs, rate limits, and a managed secret store.
- **Platform database:** MongoDB Atlas, reached only by the API. The platform database stores identities, tenant metadata, plan catalog, subscriptions, approval requests, and (in shared mode) shop records.
- **Billing:** provider-neutral subscription records; integrate Stripe (or another provider) through signed, idempotent webhooks. Entitlements are derived server-side from the active subscription and plan, never trusted from browser state.

## Tenant and database strategy

Support both placements without dual-writing:

1. **Managed database (default):** platform-managed tenant records use a shared database with a required immutable `tenantId`. At scale, large tenants can be moved to dedicated databases behind the same repository interface. Every read, write, aggregation, export, and background job must remain tenant-scoped. Add compound indexes beginning with `tenantId`; business keys are unique per tenant where collections are shared.
2. **Bring-your-own database (optional entitlement):** only enable this for an approved tenant and explicitly entitled plan. Encrypt the URI at rest with a managed KMS/key-encryption key, restrict allowed hosts, require TLS, and restrict Fly.io egress to approved database hosts. Do not log or return credentials. A user-supplied URI is a network-egress/SSRF boundary; an application allowlist alone is not a substitute for infrastructure egress controls and DNS-rebinding defenses.

The API must select the data placement only after authentication and tenant membership checks. A tenant ID supplied by a request header, query parameter, or body is never an authorization decision. The TypeScript tenant schema models `managed`/`byod`; physical shared-versus-dedicated managed placement is a platform deployment detail, not a user-controlled connection string.

## Initial data model

- `User`: global identity, normalized unique email, password hash, platform role, account state.
- `Tenant`: shop identity, unique slug, approval/lifecycle state, branding, and data-placement configuration.
- `TenantMembership`: unique `(tenantId, userId)` membership with owner/admin/manager/staff role.
- `SignupRequest`: approval queue linking owner identity, tenant, and requested plan; credentials are held only as a password hash on `User`.
- `Plan`: subscription price/interval, feature flags, usage limits, and billing-provider product reference.
- `Subscription`: tenant, plan, provider identifiers, billing period, cancellation and payment lifecycle state.
- Tenant-owned operational collections (products, sales, customers, repairs, vendors, settings, cash transactions): add required immutable `tenantId`, tenant-scoped uniqueness and indexes, and repositories that require a verified tenant context. This is deliberately a separate migration/cutover from the current desktop API.

Schemas added in this first implementation slice are in `mobile-hub-backend/src/models/`. The existing JavaScript model files under `mobile-hub-backend/models/` and the `Shop` model remain part of the legacy desktop service; they are not silently repurposed as the new tenant root.

## Signup, approval, billing, and tenant lifecycle

1. Public signup validates shop name, slug, owner email, and password; it creates the owner identity and a `pending` tenant/application in one MongoDB transaction. Verification tokens are sent by Resend and only their SHA-256 hashes are stored. No access token is issued until email verification and login.
2. A super admin reviews the verified application. Approval runs transactionally: assign an active plan, activate membership, create a trialing or pending subscription, and record an audit event. Rejection records reviewer and reason; all decisions are audited.
3. A verified billing webhook (not implemented yet) must update subscription state idempotently. Protected tenant operations require an active/trialing subscription with an unexpired billing period. The current policy denies access for `past_due` and does not implement a grace period.
4. Super-admin-only APIs manage tenants, approvals, plans, subscriptions, branding, database placement, and audited support access. Shop admins manage their own members, settings, and allowed branding only.

## Security and isolation invariants

- Authenticate users and authorize a selected membership before accessing tenant data; protect super-admin operations with a separate platform role and MFA.
- Centralize tenant-scoped model/repository access. Never accept `tenantId` from a client as proof of access. Prevent unscoped `find`, update, delete, aggregate, and bulk-import paths.
- Hash passwords with a strong password KDF and rate-limit signup/login. The initial API uses bcrypt with a work factor of 12; move to Argon2id before production. It currently issues short-lived bearer JWTs, without refresh/revocation or browser cookie/CSRF flows.
- Validate inputs, use parameterized Mongo filters, restrict CORS to the deployed app origins, cap request/body/upload sizes, and avoid exposing database errors or secrets.
- Encrypt customer connection strings with authenticated encryption backed by a managed secret/KMS key; rotate keys and support re-encryption. Never put credentials in logs, traces, API responses, or source control.
- Add audit events for approvals, role/plan/subscription changes, support access, and data-placement changes. Backups, retention, deletion/export, and restore tests must be tenant-aware.
- Treat the current `/api/*` desktop endpoints as legacy and not safe for public SaaS exposure: they have no authenticated membership context and existing models/queries are not tenant-scoped. Do not route production tenants through them until they are migrated and secured.

## Deployment and scale

- Configure Vercel with only the public API base URL and public web settings. Configure Fly.io with MongoDB credentials, token secrets, CORS origins, and `RESEND_API_KEY`. BYOD endpoints and connection management are not implemented; keep BYOD disabled until a KMS-backed encryption adapter, safe connection test, and egress controls are implemented.
- Keep the API stateless; store sessions/revocation state in a shared store if needed. Use MongoDB connection pooling and bounded external-tenant connection pools; do not open a new connection per request.
- Add readiness/liveness endpoints, graceful connection draining, request correlation, metrics, error reporting, and alerts for saturation, database failures, webhook retries, and subscription transitions.
- Use MongoDB replica set/Atlas for transactions and change streams if adopted. Provision indexes in controlled migrations rather than allowing each production process to race to build them.
- Introduce queues for long-running imports, exports, email, billing retries, and tenant migration. Apply per-tenant quotas and concurrency limits to avoid noisy neighbors.

## Phased implementation

1. **Foundation (started here):** add a TypeScript API skeleton, environment validation, Docker/Fly configuration, tenant, identity, membership, approval, plan, subscription, audit and domain schemas; add authentication, tenant/subscription/feature middleware, health checks, and a first-super-admin bootstrap.
2. **Identity and control plane (initial slice):** implement email-verified registration, login, approval/rejection with transactional audit records, super-admin plan management, shop feature/subscription/database-status reads, and application status checks. MFA, password recovery, billing checkout/webhooks, and refresh/revocation remain unfinished.
3. **Tenant-safe data plane:** add tenantId to operational schemas, create tenant-scoped repositories/middleware, migrate existing data into a tenant, and update every endpoint and desktop client. Require tests proving cross-tenant read/write isolation before public rollout.
4. **Web and operations:** build Next.js onboarding/shop/admin surfaces, branding, entitlement UX, deployment health/observability, backups, quotas, and production security checks.
5. **Optional database placement:** roll out dedicated DBs first; enable customer-owned URIs only after egress enforcement, KMS-backed key management, connection lifecycle limits, and security review.

## Current slice and non-goals

The new TypeScript entry point is `npm run dev:saas` (or `npm run start:saas` after `npm run build:saas`); existing `npm start` remains the legacy desktop server. Signup and approval are implemented, but no MongoDB-backed integration test has run in this environment. The new API does not mount legacy business routes, migrate desktop collections, implement billing webhooks, or provide a Next.js UI. The legacy routes remain unsafe for internet exposure. Do not deploy this as a complete production SaaS until the unfinished security and billing work above is complete.

### Backend structure and local setup

The SaaS API is isolated from the existing CommonJS desktop service:

```text
mobile-hub-backend/
  src/
    app.ts
    server.ts
    config/       environment validation and feature registry
    middleware/   JWT, membership, subscription, and feature checks
    models/       platform-control collections
    routes/       auth, super-admin plans/applications, shop status
    services/     registration, approval, entitlement, and email logic
  scripts/        one-time super-admin bootstrap and index migration
  *.test.ts       schema, service, entitlement, and HTTP tests
  Dockerfile
  fly.toml
  tsconfig.saas.json
```

1. Use Node.js 22+, MongoDB Atlas or a local replica set (transactions are required for registration and approval), and a Resend account.
2. In `mobile-hub-backend`, run `npm install`; copy `.env.example` to `.env` and set `PLATFORM_MONGO_URI`, a random `JWT_SECRET` of at least 32 characters, `WEB_ORIGINS`, `EMAIL_FROM`, and `RESEND_API_KEY`.
3. Run `npm run build:saas`, then `npm run migrate:indexes` against the platform replica set before creating the first administrator. On a local development checkout, set `BOOTSTRAP_SUPER_ADMIN_EMAIL`, `BOOTSTRAP_SUPER_ADMIN_NAME`, and a strong `BOOTSTRAP_SUPER_ADMIN_PASSWORD`, then run `npm run bootstrap:admin`. In the production image, use `npm run bootstrap:admin:compiled`. The script refuses to promote an existing account or run if a super admin already exists.
4. Run `npm run dev:saas` for the API, `npm run build:saas` for strict TypeScript validation, and `npm test` for the SaaS tests. Fly runs the index command as a release task. The SaaS API is `/api/v1`; health endpoints are `/health/live` and `/health/ready`.
5. Before Fly deployment, replace the placeholder `app` name in `fly.toml` and set production values with Fly secrets, never in Vercel or the repository. `Dockerfile` runs only the compiled SaaS API; `npm start` is still the existing desktop API.

Implemented routes currently include `GET /api/v1/public/plans`, `POST /api/v1/auth/register`, `POST /api/v1/auth/verify-email`, `POST /api/v1/auth/resend-verification`, `POST /api/v1/auth/login`, `GET /api/v1/auth/me`, super-admin plan and application list/create/update/approve/reject routes, and authenticated shop profile/features/subscription/database-status reads. Approval requires a verified owner and active plan. The plan's trial duration is used by default; no-trial approval leaves the subscription pending, which blocks paid tenant operations.
