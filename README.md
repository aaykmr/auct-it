# AuctIt

Monorepo: **Next.js 15** (`apps/web`) + **Node.js API** (`apps/api`) with **PostgreSQL**, **Redis**, **RabbitMQ**, **Prisma**, **Cashfree-ready** payments, **MVP seller KYC**, visits with **₹25** unlock, **escrow-style** payouts, **disputes** with photo/video evidence, and a **Help** hub.

## Prerequisites

- Node 20+
- pnpm (`corepack enable && corepack prepare pnpm@9 --activate`)
- Docker (for Postgres, Redis, RabbitMQ)

## Quick start

1. **Start infrastructure**

   ```bash
   cd infra && docker compose up -d
   ```

2. **API environment**

   ```bash
   cp apps/api/.env.example apps/api/.env
   # Edit apps/api/.env if needed (JWT_SECRET, ADMIN_SECRET, Cashfree keys).
   ```

3. **Create the local database (schema + seed)**

   After `docker compose up`, Postgres is reachable on the host at **`127.0.0.1:5433`** (mapped from port 5432 inside the container). This avoids clashing with a **local** Postgres that often binds `127.0.0.1:5432` (Homebrew / Postgres.app).

   - Database: `auctit`
   - User / password: `auctit` / `auctit` (see [`infra/docker-compose.yml`](infra/docker-compose.yml))

   Ensure `apps/api/.env` contains a matching URL (same as [`.env.example`](apps/api/.env.example)):

   ```bash
   DATABASE_URL="postgresql://auctit:auctit@localhost:5433/auctit"
   ```

   Apply migrations to **create all tables** in that database, then load seed data (cities, categories, sample help articles):

   ```bash
   pnpm db:migrate
   pnpm --filter api exec prisma db seed
   ```

   **Alternatives**

   - **Fresh DB without interactive migrate name:**  
     `pnpm --filter api exec prisma migrate deploy`  
     (uses existing migration files under `apps/api/prisma/migrations/`.)
   - **Prototype only (no migration history):**  
     `pnpm db:push` — syncs `schema.prisma` directly; use migrate for anything shared or production-like.

4. **Web environment** (optional)

   ```bash
   echo 'NEXT_PUBLIC_API_URL=http://127.0.0.1:4000' > apps/web/.env.local
   ```

5. **Dev (API + web)**

   ```bash
   pnpm dev
   ```

   - Web: http://localhost:3000  
   - API: http://127.0.0.1:4000  
   - RabbitMQ UI: http://localhost:15672 (user/pass `auctit` / `auctit`)

## Check if the database is running

**Docker (recommended for this repo)**

From the repo root:

```bash
docker compose -f infra/docker-compose.yml ps
```

You should see the `postgres` service **running** (and `redis`, `rabbitmq` if you started the full stack). To list only containers:

```bash
docker ps --filter "name=postgres"
```

**Postgres readiness**

If you have `pg_isready` (ships with PostgreSQL client tools):

```bash
pg_isready -h 127.0.0.1 -p 5433 -U auctit
```

Exit code `0` means the server is accepting connections.

**Quick connection test**

```bash
docker compose -f infra/docker-compose.yml exec postgres psql -U auctit -d auctit -c "SELECT 1"
```

Or, with `psql` installed locally and the same URL as in `.env`:

```bash
psql "postgresql://auctit:auctit@127.0.0.1:5433/auctit" -c "SELECT 1"
```

**Prisma**

From the repo root (loads `DATABASE_URL` from `apps/api/.env`):

```bash
pnpm --filter api exec prisma migrate status
```

If Postgres is down, this command fails with a connection error.

## Connect with TablePlus (or another SQL GUI)

Start Postgres first (`docker compose -f infra/docker-compose.yml up -d`). Then create a **PostgreSQL** connection with:

| Field              | Value        |
|--------------------|--------------|
| **Host**           | `127.0.0.1`  |
| **Port**           | `5433`       |
| **User**           | `auctit`     |
| **Password**       | `auctit`     |
| **Database**       | `auctit`     |
| **SSL**            | Off / disable (local Docker) |

In TablePlus: **Create a new connection** → choose **PostgreSQL** → fill the fields above → **Test** → **Connect**.

You can also paste this URL if your client supports it (same as [`apps/api/.env.example`](apps/api/.env.example)):

```text
postgresql://auctit:auctit@127.0.0.1:5433/auctit
```

If connection fails, confirm the container is running and that `DATABASE_URL` uses port **5433** (not `5432`, unless you removed the local Postgres and remapped Docker back to `5432`).

### Troubleshooting: `FATAL: role "auctit" does not exist`

That message almost always means the client is talking to a **different** PostgreSQL than the Docker one (for example Postgres.app or Homebrew Postgres on macOS). Those installs only have the default superuser (often `postgres`), not `auctit`. This repo maps Docker Postgres to host port **5433** so `127.0.0.1:5432` can stay your local Postgres.

**1. Confirm the Docker database has the role**

From the repo root (with the stack running):

```bash
docker compose -f infra/docker-compose.yml exec postgres psql -U auctit -d auctit -c "SELECT current_user"
```

- If this **succeeds**, Docker is fine; use TablePlus on **port 5433** (or `...@127.0.0.1:5433/auctit`). If you connect to **5432**, you’re on the local Postgres, not Docker.
- If this **fails** with the same `role "auctit" does not exist`, recreate the volume so the image can create the user again (this **wipes** local DB data):

  ```bash
  docker compose -f infra/docker-compose.yml down -v
  docker compose -f infra/docker-compose.yml up -d
  pnpm db:migrate
  pnpm --filter api exec prisma db seed
  ```

**2. Port conflicts**

Default setup uses **5433** on the host for Docker. Check listeners:

```bash
lsof -i :5433
```

If you changed [`infra/docker-compose.yml`](infra/docker-compose.yml) back to `5432:5432`, ensure a local Postgres is not already bound to `127.0.0.1:5432` (see `lsof -i :5432`).

**3. You intentionally use only local (non-Docker) Postgres**

Connect as your superuser (e.g. `postgres`) in TablePlus and run:

```sql
CREATE USER auctit WITH PASSWORD 'auctit';
CREATE DATABASE auctit OWNER auctit;
```

Then align `apps/api/.env` `DATABASE_URL` with that instance.

## Scripts

| Command        | Description                |
|----------------|----------------------------|
| `pnpm dev`     | Turbo dev (web + api)      |
| `pnpm build`   | Production build           |
| `pnpm db:migrate` | Prisma migrate dev     |
| `pnpm db:push` | Prisma db push (no migrate)|

## Auth (dummy OTP)

`POST /v1/auth/otp/request` then `POST /v1/auth/otp/verify` with OTP `123456` (or value of `OTP_DUMMY_CODE` in development).

## Seller KYC (local / dev)

Listing and auction routes use `requireVerifiedSeller` only when **`requireSellerKyc`** is true (see [`apps/api/src/env.ts`](apps/api/src/env.ts)):

| `REQUIRE_SELLER_KYC` | `NODE_ENV`   | Enforced? |
|----------------------|--------------|-----------|
| (unset)              | `development` | **No**    |
| (unset)              | `production`  | **Yes**   |
| `false`              | any          | **No**    |
| `true`               | any          | **Yes**   |

Set `REQUIRE_SELLER_KYC=false` in [`apps/api/.env`](apps/api/.env.example) to make the override explicit locally.

To mark **all** seller KYC profiles as verified in Postgres (e.g. local/dev), run:

```sql
UPDATE "SellerKycProfile"
SET status = 'verified',
    "reviewedAt" = NOW()
WHERE status <> 'verified';
```

## Admin KYC

```bash
curl -X POST http://127.0.0.1:4000/v1/admin/kyc/<userId>/verify \
  -H 'Content-Type: application/json' \
  -H "x-admin-secret: $ADMIN_SECRET" \
  -d '{"status":"verified"}'
```

## Architecture notes

- Bids are published to RabbitMQ queue `bids.incoming`; a worker processes them and publishes updates on Redis channel `auction:<id>`. The web client opens a WebSocket to `/v1/ws/auctions/:auctionId` which subscribes to those Redis messages. If RabbitMQ is down, the API falls back to **inline** bid processing.
- Visit fee and Cashfree flows include **stub** responses; wire real Cashfree order/session APIs using the same `payment_orders` rows and webhook verification.

## Security

- Helmet, CORS, JWT auth, global rate limiting (Redis-backed when Redis is available).
- Prisma parameterized queries; Zod validation on inputs.
- Cashfree webhook route verifies HMAC when `CASHFREE_WEBHOOK_SECRET` is set.

## Breakpoints (UI)

Tailwind defaults: **mobile** &lt; `md` (768px), **tablet** `md`–`lg`, **desktop** `lg+` (1024px).
