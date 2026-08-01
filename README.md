# FinOps Pilot App

An AI agent powered by **OpenAI** and **Prava Payments** — built to automate and manage payment flows. It integrates the Prava payments API for card and session management, and uses OpenAI to plan and execute financial operations autonomously.

## Stack

- **Next.js 16** — app router, API routes
- **Prava SDK** — card management, sessions, payments
- **OpenAI** — AI agent / planner
- **MySQL** — database via `mysql2`
- **Playwright** — browser automation / scraping

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env.local` file:

   ```env
   PORT=3000
   PRAVA_SECRET_KEY=sk_test_...
   NEXT_PUBLIC_PRAVA_PUBLISHABLE_KEY=pk_test_...
   OPENAI_API_KEY=your_openai_api_key
   NEXT_PUBLIC_BASE_URL=http://localhost:3000
   DEMO_PRAVA_SESSION_USER_ID=user_finops_pilot
   DEMO_PRAVA_SESSION_EMAIL=user_finops_pilot@gmail.com
   DEMO_PRAVA_SESSION_NUMBER=9999999999
   PRAVA_API_BASE_URL=https://sandbox.api.prava.space
   ```

3. Run the dev server:
   ```bash
   npm run dev
   ```

App runs at `http://localhost:3000`.

## Local Details

### ngrok

Prava webhooks require a public URL. Expose the local server with:

```bash
ngrok http 3000
```

Update `NEXT_PUBLIC_BASE_URL` in `.env.local` with the generated `https://` URL.

### MySQL

Create a local database and update the connection string in `app/lib/db.ts`. Run any migrations or seed scripts if present before starting the app.
