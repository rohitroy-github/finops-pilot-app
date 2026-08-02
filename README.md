# FinOps Pilot

FinOps Pilot is an autonomous procurement and payment-recovery agent for engineering teams.

It detects production failures caused by vendor billing boundaries, determines the minimum viable upgrade plan, executes checkout safely with constrained payment instruments, and helps restore service without manual intervention.

## The Problem

Modern applications depend on third-party APIs for core workloads such as LLMs, payments, and data processing.

When those APIs fail due to quota or payment boundaries (for example HTTP 429 or HTTP 402), teams are forced into a slow and risky manual process:

- stop engineering work
- inspect pricing pages manually
- find and share corporate payment credentials
- upgrade vendor plans by hand
- retry broken flows

Conventional AI assistants can diagnose the issue, but they usually stop at recommendations and do not execute the full recovery path.

## The Solution

FinOps Pilot acts as a self-healing procurement layer inside your application workflow.

At runtime it can:

1. Intercept quota or payment failures in real time.
2. Analyze vendor pricing and choose the minimum required upgrade plan.
3. Create controlled payment sessions through Prava.
4. Execute checkout automation with browser actions.
5. Report status and stream operational events to a live dashboard.
6. Enable transparent recovery and retry paths.

This reduces downtime and removes the need to expose raw corporate cards to scripts or distributed teams.

## Core Capabilities In This Repo

- Event-driven orchestration for incident-to-recovery flow.
- OpenAI-assisted plan and selector inference.
- Prava session creation and payment result handling.
- Merchant checkout automation via Playwright.
- Mandate setup flow with approval step through Prava-hosted iframe.
- Active mandate listing through Prava mandates API.
- LINQ notifications for user-facing status and payment-link delivery.
- Real-time event logging and dashboard visibility.

## Project Snapshot

<table>
	<tr>
		<td><img alt="dashboard_with_console" src="https://github.com/user-attachments/assets/ecdac31f-a364-402d-bd3e-46e108f5e85b" /></td>
		<td><img alt="Screenshot (78)" src="https://github.com/user-attachments/assets/c7f6f9d0-17ee-43f5-9e64-7243eac2f32d" /></td>
		<td><img alt="Screenshot (1)" src="https://github.com/user-attachments/assets/a4658142-1dbb-4e33-8ecc-ad3e51635db3" /></td>
	<tr>
		<td><img alt="Screenshot (83)" src="https://github.com/user-attachments/assets/7b63ea51-a02f-4990-a042-957020be41be" /></td>
			<td><img alt="Screenshot (1)" src="https://github.com/user-attachments/assets/a4658142-1dbb-4e33-8ecc-ad3e51635db3" /></td>
		<td><img alt="Screenshot (85)" src="https://github.com/user-attachments/assets/2e170b21-277f-4cdd-9926-3f0cff97c08e" /></td>
		</tr>
		<tr>
			<td><img alt="Screenshot (85)" src="https://github.com/user-attachments/assets/2e170b21-277f-4cdd-9926-3f0cff97c08e" /></td>
		<td></td>
</table>


## High-Level Flow

1. Incident enters the system via API route.
2. Planner analyzes vendor context and cost strategy.
3. Prava session is created for payment or mandate authorization.
4. User approves when required (iframe flow), or automation proceeds.
5. Merchant checkout is completed and outcome is verified.
6. Status is reported and surfaced in live logs and dashboard views.

## Tech Stack

- Next.js 16 (App Router + API routes)
- TypeScript
- OpenAI SDK
- Prava APIs
- LINQ APIs
- Playwright
- MySQL via mysql2

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- MySQL (local)
- Optional: ngrok for public callback/preview testing

### 1) Install dependencies

```bash
npm install
```

### 2) Create environment file

Copy the template and fill values:

```bash
cp .env.example .env.local
```

Minimum required variables:

- PRAVA_SECRET_KEY
- NEXT_PUBLIC_PRAVA_PUBLISHABLE_KEY
- PRAVA_API_BASE_URL
- OPENAI_API_KEY
- LOCAL_DB_HOST
- LOCAL_DB_USER
- LOCAL_DB_PASSWORD
- LOCAL_DB_NAME

Required for LINQ notifications:

- LINQ_API_BASE_URL
- LINQ_API_V3_API_KEY
- LINQ_AGENT_FROM_CONTACT_NUMBER
- LINQ_AGENT_TO_CONTACT_NUMBER

You can keep the demo mandate/session values for local testing.

### 3) Run development server

```bash
npm run dev
```

App URL:

- http://localhost:3000

## Mandate Flow Notes

Mandate creation uses Prava session creation with mandate_setup payload.

- Create Mandate triggers server-side call to Prava /v1/sessions.
- Response contains session_id and iframe_url.
- UI presents an Approve Mandate button that opens the iframe URL.
- Active mandates are fetched from Prava /v1/mandates using customer_id from route username.

## Observability

Operational events are emitted through a centralized event logger and displayed in the dashboard Active Logs panel.

Examples include:

- mandate_create_start
- mandate_create_success
- mandate_create_error
- mandate_list_start
- mandate_list_success
- mandate_list_error

## Local Networking (Optional)

If you need a public URL for external callbacks or provider-facing local tests:

```bash
ngrok http 3000
```

Then update your base URL variables in .env.local.

## Security Notes

- Keep all secrets only in local env files or secure vaults.
- Never commit real API keys to source control.
- Prefer constrained and scoped payment flows over reusable corporate credentials.

## Status

This repo is an active pilot implementation. Flows are functional for local demos and integration iterations, and can be extended with stricter production controls such as stronger schema validation, retries, audit trails, and policy-driven budget caps.
