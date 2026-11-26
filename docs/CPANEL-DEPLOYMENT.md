# SPOUZY cPanel Production Deployment Guide

One Node.js application serves everything on your domain:

| URL | What it is |
|---|---|
| `https://your-domain.com/` | Public website (`website/` folder, `index.htm`) |
| `https://your-domain.com/admin` | Admin panel (pre-built React app in `admin/dist/`) |
| `https://your-domain.com/api/...` | Backend API used by the website and admin |
| `https://your-domain.com/media/public/...` | Images uploaded in the admin (banners, tips, blog covers) |

Private documents (doctor/counsellor certificates, resumes) are never public. Staff download them
through the admin panel only.

---

## 1. Build the admin panel on your computer

cPanel installs only production packages, and the admin build tool (Vite) is a development package.
Build the admin on your Windows computer before uploading:

```bash
cd D:\DOWNLOADS\spouzynew25
npm install
npm run build:admin
```

This creates `admin/dist/`. Upload that folder with the project. Rebuild and re-upload `admin/dist/`
every time the admin source code changes.

---

## 2. Upload the project

Upload the project to a folder **outside** `public_html`, for example `/home/cpaneluser/spouzy`:

```
/home/cpaneluser/spouzy/
├── package.json            (root workspaces file)
├── backend/                (API; startup file backend/src/server.js)
│   ├── .env                (create on the server, see step 4; never upload your local one)
│   └── storage/uploads/
│       ├── private/        (certificates, resumes; never web-accessible)
│       └── public/         (admin-uploaded website images)
├── website/                (public pages, css, js, images)
└── admin/dist/             (built admin panel from step 1)
```

Do not upload `node_modules/`, `backend/.env` from your computer, `backend/storage/uploads/*` test files,
or the unused `website/index.html` (the homepage is `index.htm`).

---

## 3. Create the MySQL database

1. cPanel → **MySQL® Databases**.
2. Create a database, e.g. `spouzy_prod` (cPanel names it `cpaneluser_spouzy_prod`).
3. Create a user with a strong password, e.g. `cpaneluser_spouzy_user`.
4. Add the user to the database with **ALL PRIVILEGES**.

---

## 4. Create `backend/.env` on the server

Use cPanel **File Manager** to create `/home/cpaneluser/spouzy/backend/.env`:

```ini
NODE_ENV=production

DB_HOST=localhost
DB_PORT=3306
DB_NAME=cpaneluser_spouzy_prod
DB_USER=cpaneluser_spouzy_user
DB_PASSWORD=your-database-password

# Three different random secrets. The server refuses to start in production with weak values.
SESSION_SECRET=<64 random characters>
CSRF_SECRET=<64 random characters>
ENCRYPTION_KEY=<exactly 64 hex characters>

PUBLIC_URL=https://your-domain.com
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
TRUST_PROXY=1

STORAGE_PATH=./storage

SPOUZY_WHATSAPP_NUMBER=+918591945055
SPOUZY_SUPPORT_EMAIL=care@spouzy.com

# Leave Razorpay empty: keys are entered in Admin → Settings → Payment Driver.
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
```

Generate the secrets in the cPanel Terminal (each command prints one value):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # use for ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"   # SESSION_SECRET, CSRF_SECRET
```

> **Keep `ENCRYPTION_KEY` safe and never change it later.** The saved Razorpay secret is encrypted with it;
> if it changes you must re-enter the Razorpay keys in the admin.

---

## 5. Create the Node.js application

1. cPanel → **Setup Node.js App** → **Create Application**.
2. **Node.js version**: 20.x (18.x also works).
3. **Application mode**: Production.
4. **Application root**: `spouzy`.
5. **Application URL**: your domain.
6. **Application startup file**: `backend/src/server.js`.
7. Click **Create**. cPanel sets the port automatically; do not set `PORT` yourself.

Then click **Run NPM Install** (or in the Terminal, after entering the app's virtual environment with the
command cPanel shows at the top of the page):

```bash
cd ~/spouzy
npm install --omit=dev
```

---

## 6. Prepare the database and the first admin account

In the Terminal, inside the app's virtual environment:

```bash
cd ~/spouzy
npm run db:setup          # creates tables and loads the starting content
ADMIN_EMAIL=you@your-domain.com ADMIN_PASSWORD='a-strong-password' npm run admin:create
mkdir -p backend/storage/uploads/private backend/storage/uploads/public backend/storage/logs
chmod 755 backend/storage backend/storage/uploads backend/storage/uploads/private backend/storage/uploads/public
```

If cPanel's MySQL user cannot create databases, `db:setup` reports it; the database from step 3 already
exists, so run `npm run db:migrate` and `npm run db:seed` instead.

Restart the app in **Setup Node.js App** after every upload or `.env` change.

### Updating an existing installation later

```bash
cd ~/spouzy
npm install --omit=dev
npm run db:migrate        # adds new tables/columns/permissions (e.g. offers, bills, notifications, FAQ pages, stories, blog banners, student / ex-servicemen IDs); keeps all existing data
npm run db:seed           # adds missing starting content only; never overwrites your edits
npm run content:check     # reports any image that does not exist (changes nothing)
```

Then upload the new `admin/dist/` and restart the app.

---

## 7. Release expired payment holds (cron job)

The app releases unpaid 15-minute holds every 2 minutes while it runs. Add a cron job as a backup, because
Passenger may put an idle app to sleep:

cPanel → **Cron Jobs** → every 5 minutes (`*/5 * * * *`):

```bash
cd /home/cpaneluser/spouzy && /home/cpaneluser/nodevenv/spouzy/20/bin/node backend/src/jobs/holdCleanup.job.js >/dev/null 2>&1
```

Adjust the Node path to the one shown in **Setup Node.js App**.

---

## 8. Switch on online payments (when you are ready)

1. Razorpay Dashboard → **Settings → API Keys**: create a Test or Live key.
2. Admin panel → **Settings → Payment Driver**: tick **Driver active**, choose the mode matching the key
   (`rzp_test_…` = Test, `rzp_live_…` = Live), paste the Key ID and Key Secret, save.
3. Razorpay Dashboard → **Webhooks** → add `https://your-domain.com/api/payments/webhook` with events
   `payment.captured` and `order.paid`, set a webhook secret, and paste the same secret into the admin form.

While the driver is off, the booking page says "Online payment integration is coming soon", paid slots are
still reserved (payment pending), and staff see them under Appointments → payment pending.

---

## 9. HTTPS and `.htaccess`

Turn on AutoSSL in cPanel. cPanel writes the Passenger lines into `.htaccess` itself; you can add the
HTTPS redirect below them:

```apache
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
Options -Indexes
```

---

## 10. Check everything after going live

0. In the Terminal (inside the app's environment) run `npm run content:check`. It must end with
   `Result: all content images are OK.` It lists any banner, tip, blog or staff photo whose image file
   does not exist, and test records left by old test scripts; `npm run content:clean-test-data` removes
   only those test records. Saving an item with a missing image is refused in the admin, and the website
   falls back to its built-in photo, so visitors never see a broken image.
1. `https://your-domain.com/api/health` returns `{"status":"ok"}`.
2. The homepage loads with its banners; announcement, phone and WhatsApp match Admin → Settings.
3. `https://your-domain.com/admin` shows the login page; sign in with the account from step 6.
4. Submit the contact form, a doctor application and a careers application; each shows a reference
   (`SP-ENQ-…`, `SP-DOC-…`, `SP-CAR-…`) and appears in the admin.
5. Book a **free** consultation (dates start two months ahead) and a **paid** one (from today); both appear
   under Appointments with the right type and payment status.
6. Upload a banner photo in Admin → Website Content → Hero Banners and check the homepage.
7. Create a customer account on `create-account.htm`, add a package on `packages.htm`, and check the cart shows
   "Online payment coming soon" (until the payment driver is on) and the order list in Admin → Packages & Orders.
8. Back up the database and `backend/storage/uploads/` regularly (cPanel → Backup).
