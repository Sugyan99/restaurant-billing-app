# Setup Guide (Beginner-Friendly)

This guide explains how to run this project on your own computer to test it.
Follow each step in order — don't skip any.

## Step 1: Install required software (one-time only)

1. **Node.js** — download from https://nodejs.org (choose the LTS version) and
   install it like any normal app.
2. **PostgreSQL** — download from https://www.postgresql.org/download/ and
   install it. During install, it'll ask you to set a password — remember it,
   you'll need it below. Default port is 5432.
3. **Git** — download from https://git-scm.com/downloads

To check everything installed correctly, open a terminal (Command Prompt /
PowerShell on Windows, Terminal on Mac) and run:
```
node -v
npm -v
git -v
```
Each should print a version number.

## Step 2: Get the project code

If you cloned this from GitHub:
```
git clone <your-repo-url>
cd restaurant-billing
```

## Step 3: Install project dependencies

Inside the project folder, run:
```
npm install
```
This downloads all the libraries the project needs (takes 1-2 minutes).

## Step 4: Set up your environment file

1. Find the file called `.env.example` in the project folder
2. Make a copy of it and rename the copy to `.env`
3. Open `.env` in any text editor and fill in:
   - `DATABASE_URL` — your Postgres connection string. Format:
     `postgresql://postgres:YOUR_PASSWORD@localhost:5432/restaurant_billing`
     (replace YOUR_PASSWORD with the password you set during Postgres install)
   - `JWT_SECRET` — type any long random string of letters/numbers (e.g. mash
     your keyboard for 40 characters)
   - `GROQ_API_KEY` — we'll get this when we add the AI feature (Phase 7)

## Step 5: Create the database

Open a tool called **pgAdmin** (installed alongside Postgres) or use the
terminal:
```
psql -U postgres
CREATE DATABASE restaurant_billing;
\q
```

## Step 6: Push the schema to your database

This creates all the tables (users, orders, menu, etc.) based on
`prisma/schema.prisma`:
```
npx prisma generate
npx prisma db push
```

## Step 7: Create your first (Owner) account

Once the app is running (next step), send a POST request to
`/api/auth/register` with your name, email, and password — since no users
exist yet, this first one automatically becomes the Owner. We'll build a
proper signup page for this in a later phase; for now this can be tested with
a tool like Postman, or we'll add a simple form before you need it.

## Step 8: Run the app

```
npm run dev
```
Open your browser to **http://localhost:3000** — the app should load.

## If something goes wrong

- "Cannot connect to database" → double check your DATABASE_URL password and
  that Postgres is actually running
- "Port 3000 already in use" → close other apps using that port, or run
  `npm run dev -- -p 3001` to use a different port
- Any other error → copy the exact error message and ask, we'll debug it
  together
