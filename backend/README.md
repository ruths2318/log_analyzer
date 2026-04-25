# Backend

Minimal Flask API for the log analyzer application.

## Local Setup

From the repository root:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
.venv/bin/python backend/app.py
```

Health check:

```bash
curl http://localhost:5000/api/health
```

## PostgreSQL Setup

Install PostgreSQL on Ubuntu:

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql
```

Create the local application database and user:

```bash
sudo -u postgres psql
```

Run this inside `psql`:

```sql
CREATE USER log_analyzer WITH PASSWORD 'log_analyzer_dev';
CREATE DATABASE log_analyzer OWNER log_analyzer;
GRANT ALL PRIVILEGES ON DATABASE log_analyzer TO log_analyzer;
\q
```

Create a local backend environment file:

```bash
cp backend/.env.example backend/.env
```

Default local database URL:

```text
postgresql+psycopg2://log_analyzer:log_analyzer_dev@localhost:5432/log_analyzer
```

Raw uploaded log files should be stored on disk under `UPLOAD_STORAGE_DIR`.
PostgreSQL should store upload metadata, parsed events, analysis runs, timeline
items, and anomaly findings.

Initialize database tables:

```bash
.venv/bin/python backend/init_db.py
```

Tables are defined as SQLAlchemy models in Python. The init script creates the
tables from those models inside the configured PostgreSQL database.
