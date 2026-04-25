# AuctIt

## Local Setup

### 1) Use Node from `.nvmrc`

```bash
nvm install
nvm use
```

### 2) Enable pnpm

```bash
corepack enable
corepack prepare pnpm@9 --activate
pnpm install
```

### 3) Start local infra (Postgres, Redis, RabbitMQ)

```bash
cd infra && docker compose up -d
```

### 4) Create API env

```bash
cp apps/api/.env.example apps/api/.env
```

Ensure `DATABASE_URL` in `apps/api/.env` points to:

```bash
DATABASE_URL="postgresql://auctit:auctit@localhost:5433/auctit"
```

### 5) Run DB migrations and seed

```bash
pnpm db:migrate
pnpm --filter api exec prisma db seed
```

### 6) (Optional) Create web env

```bash
echo 'NEXT_PUBLIC_API_URL=http://127.0.0.1:4000' > apps/web/.env.local
```

## Start Servers (Local)

From repo root:

```bash
pnpm dev
```

- Web: `http://localhost:3000`
- API: `http://127.0.0.1:4000`
- RabbitMQ UI: `http://localhost:15672` (user/pass: `auctit` / `auctit`)
