# Full-Stack Cybersecurity Application

SOC-style log analysis application for uploading proxy logs, parsing them into structured events, surfacing analyst-friendly insights, and generating anomaly-driven investigation views.

## 🚀 Live Demo

The application is deployed and accessible live at:
**[http://log_analyzer.ruthura.com](http://log_analyzer.ruthura.com)**

---

## What This Project Does

This application lets a user:

- log in with basic authentication
- upload a log file
- parse the file into structured events
- review events in a SOC-oriented workspace
- use pivots, filters, tables, timelines, and configurable widget analysis
- review backend-generated insights and anomaly detections
- use AI-generated investigation views to jump into useful analyst workflows faster

The current implementation is built around Zscaler web proxy style logs. A sample file is included at [data/synthetic_zscaler_web.log](/home/rmeedima/log_analyzer/data/synthetic_zscaler_web.log).

## Tech Stack

- Frontend: React + TypeScript + Vite
- Backend: Flask + SQLAlchemy
- Database: PostgreSQL
- Charts: Recharts
- Deployment path: Docker Compose

## Repository Structure

- [frontend/](/home/rmeedima/log_analyzer/frontend): React application
- [backend/](/home/rmeedima/log_analyzer/backend): Flask API and analysis services
- [data/](/home/rmeedima/log_analyzer/data): example log files
- [docker-compose.yml](/home/rmeedima/log_analyzer/docker-compose.yml): local containerized deployment

## Running Locally

### Option 1: Docker Compose

This is the easiest way to run the full stack locally or on an EC2 instance.

1. Make sure Docker and Docker Compose are installed.
2. Update [backend/.env](/home/rmeedima/log_analyzer/backend/.env) with your desired values (including your `OPENAI_API_KEY`).
3. Start the stack:

```bash
sudo docker compose up --build
```

Services:

- Frontend: `http://localhost:80`
- Backend API: `http://localhost:5000`
- PostgreSQL: `localhost:5432`

Notes:

- The backend container reads environment variables from `backend/.env`.
- Docker overrides `DATABASE_URL` internally so the backend connects to the `db` container instead of `localhost`.
- Uploaded raw files are stored in a Docker volume mounted at `/app/uploads`.

### Option 2: Manual Local Setup

#### Backend

1. Create a virtual environment and install dependencies:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
```

2. Copy and edit the backend environment file:

```bash
cp backend/.env.example backend/.env
```

3. Create PostgreSQL database and user:

```bash
sudo -u postgres psql
```

```sql
CREATE USER log_analyzer WITH PASSWORD 'log_analyzer_dev';
CREATE DATABASE log_analyzer OWNER log_analyzer;
GRANT ALL PRIVILEGES ON DATABASE log_analyzer TO log_analyzer;
\q
```

4. Initialize the database:

```bash
.venv/bin/python backend/init_db.py
```

5. Start the backend:

```bash
.venv/bin/python backend/app.py
```

Backend health check:

```bash
curl http://localhost:5000/api/health
```

#### Frontend

1. Install dependencies:

```bash
cd frontend
npm ci
```

2. Start the frontend dev server:

```bash
npm run dev
```

The frontend will be available at `http://localhost:5173` in local dev mode and proxies `/api` to the Flask backend on `http://localhost:5000`.

## Authentication

The application supports basic session-based authentication:

- register a new user
- log in
- log out
- optional admin view for user and upload visibility

## Log Parsing and Data Flow

When a file is uploaded:

1. The raw log file is stored on disk.
2. The backend parses the file into structured events.
3. Parsed events are written into PostgreSQL.
4. The initial upload request returns after event storage.
5. Insights, anomalies, and AI review run asynchronously in the background.
6. The frontend polls for those results and updates the workspace when they are ready.

This keeps upload UX responsive while still allowing heavier analysis to happen after parse.

## Frontend Analyst Workflow

The frontend is intentionally designed as an analyst workbench rather than a basic file/table CRUD view.

Main features:

- upload rail with collapsible file list
- timeline with configurable time buckets
- multi-column pivots
- configurable widget analysis
- expandable event rows with extra parsed fields
- sortable event table
- anomaly-only filtering
- backend-generated insights surfaced at the top
- AI-generated suggested investigation tabs

## Anomaly Detection Approach

This project uses an explainable hybrid anomaly detection approach rather than a black-box model.

Implemented detectors include:

- request burst by client IP
- blocked burst by client IP
- unusually broad destination spread by user
- error spikes by host
- rare user-to-host combinations

Each anomaly includes:

- title
- reason
- detector confidence score
- severity
- optional linked row, group, or time range context

Anomalous events are highlighted in the results table, and row-level evidence can be reviewed in expanded event rows.

## How AI Is Used

AI is used as an analyst-assist layer, not as the primary parser and not as a row-by-row detector.

### 1. AI Review Summary

AI generates:

- executive summary
- analyst summary
- top concerns
- recommended next steps

This is intended to help a SOC analyst quickly understand what matters in the upload without reading every row first.

### 2. AI-Generated Investigation Views

This is the main AI workflow feature in the application.

Instead of giving one static recommendation, the backend asks AI to generate multiple suggested investigation views for the SOC analyst.

Each suggested view contains:

- a title
- a one-line summary
- a set of widget fields
- a set of pivots
- optional time range
- recommended table fields
- whether anomaly-only mode should be enabled

When the user selects an AI-suggested tab, the frontend applies that workspace state directly:

- pivots
- widget analysis fields
- table columns
- anomaly-only mode
- time range, when provided

This is meant to reduce analyst setup time and quickly open meaningful perspectives such as:

- blocked burst review
- host error spike review
- risky user review
- category-focused review
- threat-family review

Important implementation note:

- AI is constrained to use exact frontend-supported field keys
- it is not allowed to invent synthetic widget ids or unsupported table fields
- backend normalizes fuzzy field names where possible before the frontend consumes them

### 3. AI Anomaly Triage

For top anomalies, AI also generates:

- AI confidence score
- threat hypothesis
- why the anomaly matters
- recommended pivot field/value

This is used to enrich anomaly cards in the workspace.

## Why AI Is Structured This Way

I intentionally did not use AI for per-row classification of the entire log file.

Instead:

- deterministic logic performs parsing, insights, and anomaly detection
- AI is used for review synthesis, triage, and investigation guidance

This makes the system:

- easier to explain
- cheaper to run
- more predictable
- better aligned with SOC workflows

## AI Request Pattern

AI review is currently split into three parallel calls:

1. summary generation
2. suggested investigation views
3. anomaly review / AI confidence generation

This split was chosen so the AI-generated view recommendations can have their own token budget and are less likely to be truncated by summary text.

## Environment Variables

Key backend environment values:

- `DATABASE_URL`
- `UPLOAD_STORAGE_DIR`
- `SECRET_KEY`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `AI_REVIEW_FALLBACK_ENABLED`
- `OPENAI_TIMEOUT_SECONDS`
- `OPENAI_SUMMARY_MAX_OUTPUT_TOKENS`
- `OPENAI_VIEWS_MAX_OUTPUT_TOKENS`
- `OPENAI_ANOMALY_MAX_OUTPUT_TOKENS`

See [backend/.env.example](backend/.env.example).

## Example Test Data

Included example file:

- [data/synthetic_zscaler_web.log](data/synthetic_zscaler_web.log)

This file can be uploaded directly through the UI for testing the end-to-end flow.
