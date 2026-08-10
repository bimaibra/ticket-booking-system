# Local PostgreSQL Setup & Migration Guide

This document describes how to install PostgreSQL locally, create the `ticket_db`
database used by the API, and run the Prisma migrations plus seed data.

> **Why this matters for M1**
> The implementation plan mandates that the schema, the migration, the seed, and
> the Prisma client all work end-to-end against a real PostgreSQL instance.
> The schema is validated (`prisma validate`) and the migration SQL is generated
> (`prisma migrate diff`) at build time, but the actual *apply* step requires a
> live database. Use the steps below before running the API server.

## 1. Install PostgreSQL 15+

Pick the option that matches your platform.

### Option A — Windows installer (recommended)
1. Download PostgreSQL 15 or 16 from <https://www.postgresql.org/download/windows/>.
2. During installation, set a `postgres` superuser password (you will reuse it
   in `.env`). Default port `5432` is fine.
3. Make sure the **pgAdmin** and **Command Line Tools** components are checked.
4. After install, confirm the service is running:
   ```powershell
   Get-Service postgresql-x64-15
   # or for v16:
   Get-Service postgresql-x64-16
   ```
   Start it with `Start-Service postgresql-x64-15` if it is stopped.

### Option B — Docker (cross-platform)
If you have Docker Desktop installed:
```powershell
docker run --name ticket-pg `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_DB=ticket_db `
  -p 5432:5432 `
  -d postgres:16
```

## 2. Create the application database

Open a shell (`psql` or `pgAdmin`) and run:
```sql
CREATE DATABASE ticket_db;
```
If you used Docker above, the database is created automatically.

## 3. Configure `.env`

Copy the example file and adjust the credentials so they match your local
installation:
```powershell
Copy-Item .env.example .env
```
Edit `.env`:
```
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@127.0.0.1:5432/ticket_db?schema=public"
```
Replace `YOUR_PASSWORD` with the value you set during install.

## 4. Install Node dependencies

```powershell
npm install
```

## 5. Generate Prisma client and apply migration

```powershell
npm run db:generate    # npx prisma generate
npm run db:migrate     # npx prisma migrate dev (creates + applies migration)
npm run db:seed        # npx prisma db seed  (loads admin/user/event/tickets)
```

The seed creates the following accounts (passwords are bcrypt-hashed):

| Username | Password   | Role  |
|----------|------------|-------|
| admin    | admin123   | ADMIN |
| user     | user123    | USER  |

## 6. Verify the connection

```powershell
npx prisma db execute --stdin --schema prisma/schema.prisma <<< "SELECT 1;"
```
A successful response confirms the API can talk to PostgreSQL.

## 7. Common pitfalls

- **`P1001 Can't reach database server`** — the service is stopped, the port is
  blocked, or the password is wrong. Double-check `.env` and `Get-Service`.
- **`P3014 PrismaMigrationError`** — the migration history diverged from the
  shadow database. Use `npm run db:reset` during local development (it drops
  and re-creates the database).
- **`prisma.config.ts` not found** — run commands from the project root, not
  from inside `prisma/`.

## 8. Teardown

To drop the database and start fresh:
```powershell
npm run db:reset
```

For Docker:
```powershell
docker rm -f ticket-pg
```
