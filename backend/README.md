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
