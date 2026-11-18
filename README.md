# School Management System

A FastAPI + SQLAlchemy school portal with Admin, Teacher and Student roles.

## Features
- Secure username/password login with hashed passwords and JWT sessions.
- Public registration is disabled.
- Only Admin can create Admin, Teacher and Student accounts.
- Admin can view accounts, create fee records and mark received fees as paid.
- Admin and Teacher can record attendance.
- Students can only view their own attendance and fee records.
- Responsive mobile-friendly interface.
- SQLite for local testing; PostgreSQL supported through `DATABASE_URL`.

## Run locally
1. Install Python 3.10 or newer.
2. Create a virtual environment and install dependencies:
   `pip install -r requirements.txt`
3. Copy `.env.example` to `.env`.
4. Set a long random `SECRET_KEY`, a strong `ADMIN_PASSWORD`, and an `ADMIN_USERNAME`.
5. Start:
   `uvicorn app.main:app --host 0.0.0.0 --port 8000`
6. Open `http://127.0.0.1:8000`.

The first Admin is created on startup from `ADMIN_USERNAME` and `ADMIN_PASSWORD` if that username does not already exist. Do not use weak passwords or publish `.env`.

## Deployment notes
- Set environment variables in your hosting provider: `SECRET_KEY`, `DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_FULL_NAME`.
- Use managed PostgreSQL for production. Serverless local SQLite storage may be temporary and is not suitable for persistent school records.
- Use HTTPS in production.
- This starter project has not been independently security-audited or load-tested. Test with dummy data before using real student records.

## API
- `POST /api/auth/token` — login (OAuth2 form fields: username, password)
- `GET /api/auth/me` — current account
- `POST /api/users/` — Admin creates account
- `GET /api/users/` — Admin lists accounts
- `GET /api/users/students` — Admin/Teacher lists students
- `POST /api/attendance/` and `GET /api/attendance/`
- `POST /api/fees/`, `GET /api/fees/`, `PATCH /api/fees/{id}/pay`
- `GET /docs` — interactive API documentation

Note: Marking a fee as Paid is an administrative record only. It does not process an online payment.
