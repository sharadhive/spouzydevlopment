# SPOUZY Management System - Setup & Developer Guide

## System Overview
SPOUZY is a full-stack, enterprise-grade clinical management and public advisory platform built for Problem Solver Group (PSG).

The project is structured into three clean workspaces:
- `website/`: Public HTML pages, CSS, JS, fonts, images, WebM animations, and client API scripts.
- `backend/`: Node.js + Express + Sequelize ORM + MySQL 8.0 backend API.
- `admin/`: React 18 + Vite responsive Single Page Application (SPA) with administrative CRM, scheduling, and moderation consoles.
- `docs/`: Comprehensive API, deployment, and integration documentation.

---

## Prerequisites
- **Node.js**: v18+ (tested on Node v20 & v24)
- **npm**: v9+ (npm workspaces enabled)
- **MySQL Server**: 8.0+

---

## Quick Start (Local Development)

### 1. Install Dependencies
From the project root:
```bash
npm install
```
This installs dependencies across the root, backend, and admin workspaces.

### 2. Configure Environment Variables
Copy `backend/.env.example` to `backend/.env` (or configure root `.env`):
```bash
cp backend/.env.example backend/.env
```
Ensure your MySQL credentials match:
```ini
NODE_ENV=development
PORT=5000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=spouzy_dev
DB_NAME_TEST=spouzy_test
DB_USER=root
DB_PASSWORD=root

SESSION_SECRET=dev_session_secret_32_chars_long_12345
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
CSRF_SECRET=dev_csrf_secret_32_chars_long_12345

```

Leave the `RAZORPAY_*` variables empty. Payment keys are entered later in the admin panel
(**Settings → Payment Driver**). Until the driver is switched on there, the website shows
"Online payment integration is coming soon" and paid slots are reserved with payment pending.

### 3. Initialize & Seed Database
Run the idempotent database setup script:
```bash
npm run db:setup
```
This will:
1. Create database `spouzy_dev` if it does not exist (`npm run db:create`).
2. Run database migrations (`npm run db:migrate`).
3. Seed production manifest content idempotently (`npm run db:seed`):
   - 5 roles: `admin`, `operations_staff`, `clinical_director`, `content_editor`, `customer`.
   - 4 hero banners matching the live homepage slides, and the homepage section titles.
   - Relationship tips, blog categories, FAQs, career openings.
   - 5 services with 30/60-minute prices, 4 practitioners with 09:00–21:00 working hours.
   - Site settings (phone, WhatsApp, support email, announcement bar, cursors).

On an existing database run `npm run db:migrate` and then `npm run db:seed`; both are safe to repeat
and never overwrite content you have edited in the admin panel.

### 4. Create Initial Admin Account
```bash
npm run admin:create
```
It asks for the email and password (or reads `ADMIN_EMAIL` / `ADMIN_PASSWORD`).
Optional test accounts for each staff role: `npm run seed:dev-users` (prints one-time passwords;
those users must change their password after the first login).

### 5. Build React Admin Panel
```bash
npm run build:admin
```
Compiles the React SPA into `admin/dist/` which is served directly by the backend at `/admin`.

### 6. Start the Backend Server
```bash
npm start
```
The server starts at `http://localhost:5000/`:
- **Public Website**: `http://localhost:5000/`
- **Admin Panel**: `http://localhost:5000/admin`
- **API Health Check**: `http://localhost:5000/api/health`

### 7. Run Development Mode with Hot Reloading
To run the React Vite development server alongside the backend:
- Backend: `npm run dev` (runs Express on port 5000)
- Admin SPA: `npm run dev:admin` (runs Vite dev server on port 5173 with proxy to port 5000)

---

## Running the Automated Test Suite
To run the automated integration test suite:
```bash
npm test
```
The test suite creates `spouzy_test`, runs migrations, seeds twice (idempotency) and checks, among others:
1. Login, sessions, CSRF on cookie sessions, role permissions for every staff role.
2. Every website form: enquiry (consent), doctor/counsellor applications with files, careers, questions, stories, duplicate protection.
3. Booking: live availability, overlap protection, free consultations only from 2 months ahead, practitioner type per service.
4. Payments: "coming soon" when the driver is off, server-side amounts, Razorpay HMAC signature and webhook, 15-minute hold cleanup, switching the driver off and on.
5. Admin content: banner photo upload, blog publishing, FAQ answers, settings allow-list, dashboard sections per role.
6. Private document access rules and CSV formula-injection protection.
