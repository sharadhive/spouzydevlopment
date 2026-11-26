# SPOUZY — Fix Brief for the Coding Agent

You are working LIVE on the SPOUZY project (repo root = the folder that contains `website/`, `backend/`, `admin/`, `docs/`).
This brief comes from a full audit of the code (website forms → `website/js/spouzy-api.js` → Express routes → Sequelize/MySQL → React admin).
Every "Verified fact" below was checked in the code or by running the server. Read the WHOLE file before changing anything.

---

## 0. Ground rules (follow strictly)

1. **One phase at a time, in order (Phase 1 → 4).** Inside a phase, do the tasks in the listed order.
   After each task: list the files you changed and the test you ran with its result.
   After each phase: **STOP** and wait for the user to test and reply "continue".
2. **Do not redesign anything.** Keep the HTML structure, CSS classes, colours (`#FFFACD` page background), teddy cursors, animations and wording.
   New UI must reuse existing classes (e.g. `.sp-review-whatsapp-btn`, `.sp-review-edit-btn`, `.sp-career-checkbox-label`, `.sp-form-input-modern`, `.sp-form-label-modern`, `.sp-api-banner`). No new CSS files.
3. **Keep the WhatsApp hand-off**, but it becomes the step AFTER a successful save and must carry the reference number.
4. **Never edit an applied migration** (`backend/src/migrations/20261118000001-*.js`, `20261118000002-*.js`).
   All schema changes go into ONE new migration `backend/src/migrations/20261118000003-fix-forms-and-permissions.js`,
   written idempotently with the same `addColumnIfNotExists` helper pattern used in migration 2.
   Add every new column to the matching model in `backend/src/models/index.js` too.
5. **Do not touch:** `scratch/`, `node_modules/`, `spouzyahaha.zip`, `backend/.env` (never print its values), `admin/dist/` (only regenerate it with `npm run build:admin`).
6. The server serves `website/index.htm` as the home page. Edit `index.htm` only. Do not edit `website/index.html`; ask the user later whether to delete it.
7. **No `git commit`, `git push`, `git reset`, table drops or migration rollbacks without the user's OK.**
   Before Phase 1, ask the user to commit the current folder restructure (git currently shows ~160 deleted root files and untracked `website/ backend/ admin/ docs/`).
8. Find code by **search strings** (function names, element IDs). Line numbers in this brief are approximate.
9. The user is on **Windows / PowerShell**: use `curl.exe` (not `curl`) for multipart/GET tests and `Invoke-RestMethod` for JSON POSTs.
10. If the code you find contradicts this brief, **stop and tell the user** instead of guessing.
11. After changing backend code, the server must be restarted (`npm run dev` has no auto-reload).
12. Update `docs/API.md` and `docs/INTEGRATION-MAP.md` whenever you change an endpoint or a field.

---

## 1. Project map

| Area | Path | Notes |
| --- | --- | --- |
| Public site | `website/*.htm` (51 pages), `website/js/spouzy-modern.js` (UI, validation, WhatsApp), `website/js/spouzy-api.js` (API calls), `website/js/banner-tips.js` | Static HTML + jQuery. `spouzy-api.js` is loaded only on: `join-doctor.htm`, `join-counsellor.htm`, `careers.htm`, `contactus.htm`, `book-appoinment.htm`, `faq.htm` |
| Backend | `backend/src/app.js`, `server.js`, `routes/*.routes.js`, `services/*.service.js`, `models/index.js`, `middlewares/*`, `seeders/content-manifest.json` | Express 4 + Sequelize 6 + MySQL 8. Serves `website/` at `/` and `admin/dist` at `/admin` |
| Admin | `admin/src/pages/*.jsx`, `admin/src/components/Layout.jsx`, `admin/src/services/api.js`, `admin/src/services/authAdapter.js` | React 18 + Vite, HashRouter, base `/admin/` |
| Route mounts | `backend/src/routes/index.js` | `/api/auth`, `/api/enquiries`, `/api/clinical-applications`, `/api/careers` (+ alias `/api/career-applications`), `/api/scheduling`, `/api/appointments`, `/api/content`, `/api/payments`, `/api/media`, `/api/admin` |

## 2. How to run and test

- MySQL 8 must be running; `backend/.env` is already configured.
- After adding migration 3: `npm run db:migrate`.
- Backend + website: `npm run dev` → website `http://localhost:5000/`, admin `http://localhost:5000/admin`, health `http://localhost:5000/api/health`.
- Admin with hot reload: `npm run dev:admin` → `http://localhost:5173` (proxies `/api` to port 5000). Or `npm run build:admin` and use `http://localhost:5000/admin`.
- **Always test the website at `http://localhost:5000/...`.** Do NOT use VS Code Live Server (port 5502): relative `/api/...` calls go to the wrong port and every form fails.
- Backend tests: `npm test` (creates database `spouzy_test`). Keep it green and add tests for new behaviour in `backend/tests/`.
- Staff test logins: admin via `npm run admin:create`; dev staff via `npm run seed:dev-users` (`operations@spouzy.test`, `clinical@spouzy.test`, `content@spouzy.test` — the script prints their passwords).

---

## 3. Shared front-end change (do this FIRST in Phase 1)

**Verified problem:** every form has two independent handlers. `spouzy-modern.js` validates and opens WhatsApp; `spouzy-api.js` separately attaches its own listeners and posts to the API. They race, failures are silent (`console.warn` only), the reference number never reaches WhatsApp, and every extra WhatsApp click creates a duplicate record. Uploaded files are kept in closure variables inside `spouzy-modern.js` (`attachedFiles`, `attachedResume`), so `spouzy-api.js` reading `input.files` misses drag-and-dropped files.

**Target design — exactly ONE submit path per form: validate → save via API → show reference → then WhatsApp.**

1. In `spouzy-modern.js` create one global state object and keep it in sync:
   ```js
   window.SpouzyFormState = window.SpouzyFormState || { clinicalFiles: null, careerResume: null, hasDrawnSignature: false };
   ```
   - Join forms: right after `const attachedFiles = {` is declared, set `window.SpouzyFormState.clinicalFiles = attachedFiles;` (same object reference). Keep `hasDrawnSignature` mirrored into `SpouzyFormState.hasDrawnSignature` wherever it changes (search `hasDrawnSignature =`).
   - Careers: wherever `attachedResume` is assigned (search `let attachedResume`, `renderResumePreview`), also assign `window.SpouzyFormState.careerResume`.
2. In `spouzy-api.js` expose one API object and REMOVE the old listeners it attaches (`initClinicalApplicationApi`, `initCareersApplicationApi`, `initContactFormApi`, `initAppointmentBookingApi` listeners):
   ```js
   window.SpouzyApi = { submitClinical, submitCareer, submitEnquiry, bookAppointment, getAvailability, getServices, getOpenings, askQuestion, submitStory };
   ```
   Every function resolves to `{ ok: true, referenceNo, data }` or `{ ok: false, message, errors }` and never throws. `errors` = the backend's per-field object when present.
3. `spouzy-modern.js` calls `window.SpouzyApi.*` at click time (it loads before `spouzy-api.js`, so never read `SpouzyApi` at load time).
4. **Popup blockers:** `window.open` after an `await` is blocked. So use two clicks in the review modals:
   - Add a new primary button before the WhatsApp button: `<button type="button" class="sp-review-whatsapp-btn" id="spReviewSubmitBtn">Submit Application</button>` (careers: `id="spCareerReviewSubmitBtn"`).
   - Click Submit → disable it + spinner → `await SpouzyApi.submitX()`.
   - Success → green notice at the top of the modal body with the reference (`SP-DOC-…`, `SP-COU-…`, `SP-CAR-…`), prepend `Reference: <ref>` as the FIRST line of the prepared WhatsApp message, enable "Continue on WhatsApp". Submit stays disabled (no duplicates).
   - Failure → red notice with the server message and field errors; re-enable Submit; keep WhatsApp available but relabel it "Send via WhatsApp instead (not saved online)".
   - "Continue on WhatsApp" is disabled until a save succeeds or fails.
   - The "Copy application text" button must also include the reference once saved.

---

## Phase 1 — Make every public form save correctly

### 1.1 Careers (`website/careers.htm`) — currently saves NOTHING

Verified facts:
- `spouzy-api.js` posts to `/api/career-applications` → **404** (the real route is `POST /api/careers/applications`, multer field `resume`).
- `spouzy-api.js` reads IDs that don't exist on the page: `spCareerName`, `spCareerPhone`, `spCareerQual`, `spCareerSalary`, `spCareerSop`, `spCareerResumeInput`.
- Country-code selects and the consent checkbox are never sent. Job openings are hard-coded in the `<select id="spCareerRole">`.

Tasks:
1. `submitCareer()` posts multipart to **`/api/careers/applications`** with this exact mapping:

   | FormData key | Source |
   | --- | --- |
   | `role_title` | `#spCareerRole` value |
   | `career_opening_id` | `data-opening-id` of the selected `#spCareerRole` option (when present) |
   | `full_name` | `#spCareerFullName` |
   | `email` | `#spCareerEmail` |
   | `mobile` | `#spCareerMobileCode` + ' ' + `#spCareerMobile` |
   | `whatsapp` | `#spCareerWaCode` + ' ' + `#spCareerWhatsapp` |
   | `city` | `#spCareerCity` |
   | `experience_level` | `#spCareerExp` |
   | `current_role` | `#spCareerCurrentRole` |
   | `highest_qualification` | `#spCareerHighestQual` |
   | `skills` | `#spCareerSkills` |
   | `portfolio_url` | `#spCareerPortfolio` |
   | `notice_period` | `#spCareerNotice` |
   | `expected_compensation` | `#spCareerExpectedComp` |
   | `statement_of_purpose` | `#spCareerWhy` |
   | `consent` | `'true'` if `#spCareerConsent` is checked |
   | `resume` | `window.SpouzyFormState.careerResume` (a File) |
2. On page load call `GET /api/careers/openings`; rebuild the `#spCareerRole` options from it (`value` = title, `data-opening-id` = id). Keep the current 3 hard-coded options if the call fails.
3. Backend (`career.routes.js`, `career.service.js`):
   - Migration 3: add `career_applications.consent_agreed TINYINT(1) NOT NULL DEFAULT 0`; add to the model.
   - Validate BEFORE `uploadService.storeFile` (so failed requests leave no orphan files). Required: `role_title`, `full_name`, valid `email`, `mobile`, `whatsapp`, `city`, `experience_level`, `skills`, `notice_period`, `statement_of_purpose` (min 20 chars), `consent` = true, `resume` present (PDF/DOC/DOCX ≤ 10 MB).
   - Error response format for ALL forms: HTTP 400 `{ success:false, message:'Please correct the highlighted fields.', errors:{ field: 'reason' } }`.
   - Duplicate guard: same email + role_title within 15 minutes → return the existing `referenceNo` with `duplicate: true` (HTTP 200), don't create a new row.

Acceptance:
```powershell
curl.exe -s -X POST http://localhost:5000/api/careers/applications -F role_title="Sales Coordinator" -F full_name="Test User" -F email=test@example.com -F mobile="+91 9876543210" -F whatsapp="+91 9876543210" -F city=Mumbai -F experience_level="1-3 years" -F skills="CRM" -F notice_period=Immediate -F statement_of_purpose="I want to join SPOUZY because..." -F consent=true -F "resume=@C:\path\to\any.pdf"
```
→ 201 with `SP-CAR-…`. Then submit via the real page (drag-and-drop the resume), and confirm it appears in Admin → Careers with a downloadable resume.

### 1.2 Doctor & Counsellor (`join-doctor.htm`, `join-counsellor.htm`)

Verified facts:
- Saves to `POST /api/clinical-applications` only when "Continue on WhatsApp" is clicked; duplicates on repeated clicks; silent failures.
- Not sent: `#spWorkMode`, `#spDeclDate`, `#spSignName`, the drawn signature (`#spSigCanvas`), additional qualifications (`.sp-qual-card` with `.sp-add-degree`, `.sp-add-college`, `.sp-add-year`, `.sp-add-grade`, attribute `data-qual-id`) and their certificate files (`attachedFiles['addCert_' + qualId]`).
- Backend only requires first name, last name, email, mobile. Multer allows max 5 files per request.
- Counsellor page only: `#spNaRegCheck` ("Not applicable") → `council_name = 'Not Applicable'`.

Tasks:
1. Two-step modal per section 3 (`#spReviewSubmitBtn` before `#spReviewWhatsappBtn` on BOTH pages).
2. `submitClinical()` builds FormData with all current fields PLUS:
   - files from `SpouzyFormState.clinicalFiles` (NOT `input.files`): `photo`→`photo`, `primaryCert`→`primary_cert`, `pgCert`→`pg_cert`, `councilCert`→`council_cert`;
   - `consultation_modes` = `JSON.stringify([#spWorkMode value])`;
   - `declaration_date` = `#spDeclDate` value or today (YYYY-MM-DD); `signed_name` = `#spSignName`;
   - `additional_qualifications` = JSON array `[{degree, college, year, grade, cert_index}]` from each `.sp-qual-card` with degree+college filled; append each card's file as `additional_certs` in the same order (`cert_index` = position among the appended files, or `null`);
   - if `SpouzyFormState.hasDrawnSignature`, append `#spSigCanvas` as PNG via `canvas.toBlob` → field `signature_image`.
3. Backend:
   - `upload.middleware.js`: raise `limits.files` from 5 to 12.
   - `clinical.routes.js`: add multer fields `additional_certs` (maxCount 5) and `signature_image` (maxCount 1). Store as private MediaAssets; write `cert_asset_id` into the matching `additional_qualifications` item; save `signature_asset_id`.
   - Migration 3 on `clinical_applications`: `declaration_date VARCHAR(10) NULL`, `signed_name VARCHAR(150) NULL`, `signature_asset_id INT NULL` (FK → `media_assets.id`). Update the model + an `as: 'signature'` association.
   - Validation BEFORE storing files. Required: `role_type`, `title`, `first_name`, `last_name`, `gender`, `dob`, `mobile`, `whatsapp`, valid `email`, `practice_status`, `experience_years`, `institution_name`, `specialisation`, `objective`, `primary_qualification`, `primary_college`, `primary_year`, `primary_grade`, `preferred_hours_from` < `preferred_hours_to`, `typed_signature`, `declaration_agreed` = true.
     Files: `photo` (JPG/PNG/WebP ≤ 5 MB) and `primary_cert` (≤ 10 MB) always; `council_cert` (≤ 10 MB) when `role_type='doctor'`, or counsellor with `council_name !== 'Not Applicable'`. These limits match `setupFileUploader(...)` calls in `spouzy-modern.js`.
   - Duplicate guard: same email + role_type within 15 minutes → return existing reference with `duplicate: true`.
4. Admin `ClinicalPage.jsx` detail panel: show consultation mode, declaration date, signed name, signature image, and each additional qualification with its certificate download link (`/api/media/private/:id`).

Acceptance: submit both pages with drag-and-dropped files + one additional qualification → 201, reference shown, WhatsApp message starts with `Reference: SP-DOC-…` / `SP-COU-…`; clicking Submit again does nothing; Admin → Clinical shows all fields and every file opens.

### 1.3 Contact (`contactus.htm`)

Verified facts: the only form that saves today. But the preferred contact method is stored in `preferred_clinic`, appended into `message`, `whatsapp` is a copy of phone, there is no consent, and WhatsApp opens even if the save fails (two submit listeners).

Tasks:
1. Migration 3 on `enquiries`: `preferred_contact_method VARCHAR(100) NULL`, `service_interest VARCHAR(200) NULL`, `consent_agreed TINYINT(1) NOT NULL DEFAULT 0`, `source VARCHAR(50) NOT NULL DEFAULT 'contact_page'`. Update the model, `enquiry.routes.js`, `enquiry.service.js`, the CSV export and the Admin Enquiries detail view.
2. Add a required consent checkbox `#cfConsent` above the submit button (copy the markup pattern of `#spCareerConsent` in `careers.htm`, link to `privacy-policy.htm`).
3. One submit path in `spouzy-modern.js` `initSpouzyContactForm`: validate → `await SpouzyApi.submitEnquiry({ name, email, phone, whatsapp: phone, subject: cfService value, service_interest: cfService value, preferred_contact_method: cfPreferredContact value, message: cfMessage value, consent: true, source: 'contact_page' })` → on success show the reference in `#spContactFeedback` with a "Continue on WhatsApp" button (message includes the reference; opened by the user's click). On failure show the error and a WhatsApp fallback button.
4. Backend validation: name, valid email, phone, message (min 10 chars — if empty, the front end sends "General enquiry about <service>"), consent = true.

### 1.4 Appointment booking (`book-appoinment.htm`)

Verified facts:
- The slot picker stores the LABEL (e.g. `"09:00 AM – 09:30 AM"`) in `#spSelectedTimeSlot` (search `selectedSlotInput.value = slot.label`) and the API receives it as `startTime` → backend parses `NaN`, column `start_time` is `VARCHAR(5)` → booking fails.
- Slots are fake: `SpouzyAvailabilityProvider.getBookedIntervals()` in `spouzy-modern.js` hard-codes booked times per day offset. `window.fetchRealAvailability` in `spouzy-api.js` is never called.
- `GET /api/scheduling/services` returns **500**: `scheduling.service.js → getServices()` selects `duration_minutes` and `price_inr`, which don't exist on the Service model.
- Front end hard-codes `serviceMap` (slug → id 1–5) and always sends `practitionerId: 1`.
- `#spConsultMode` values are `virtual | mumbai | pune | delhi | bengaluru`; Service `modes` are `in-person | video | phone`; nothing validates.
- `appointment.routes.js` passes `requiresPaymentHold` but `appointment.service.js createAppointment()` reads `requirePayment` → holds/payments never apply.
- Availability without a practitioner blocks a slot if ANY practitioner is booked; booking then checks only practitioner 1 → mismatch.

Tasks:
1. Fix `getServices()` attributes to: `['id','name','slug','description','duration_options','price_30_minor','price_60_minor','modes','sort_order']`.
2. `appointment.routes.js`: pass `requirePayment: requiresPaymentHold === true || requiresPaymentHold === 'true'`.
3. `createAppointment()` accepts `serviceSlug` OR `serviceId`, and validates: date `YYYY-MM-DD` not before today **in Asia/Kolkata**; `startTime` matches `^\d{2}:\d{2}$`; duration 30 or 60; client name, valid email, mobile present; mode allowed by the service; the slot is `available` according to `schedulingService.getAvailability()` for that service. Return 400 with `errors` otherwise.
4. Practitioner assignment by service. Add a constant in `backend/src/config/services.js` (**confirm this mapping with the user before relying on it**):
   ```js
   module.exports.SERVICE_ROLE_MAP = { 'couples-therapy': ['counsellor'], 'premarital': ['counsellor'], 'general': ['counsellor'], 'intimacy-clinic': ['doctor'], 'mediation': ['mediator'] };
   ```
   - `getAvailability({ date, duration, serviceId })`: when no `practitionerId` but a service is given, a slot is `available` if at least ONE eligible active practitioner is free (respecting each practitioner's weekly schedule, overrides and blocked intervals).
   - `createAppointment`: if no `practitionerId`, pick the first eligible practitioner (lowest id) free for that slot, inside the existing transaction/lock.
5. Mode mapping: migration 3 adds `appointments.clinic_location VARCHAR(50) NULL`. Front end maps `virtual` → `consultationMode:'video'`; `mumbai|pune|delhi|bengaluru` → `consultationMode:'in-person'` + `clinicLocation:<value>`.
6. Front end (`spouzy-modern.js` scheduler section + `spouzy-api.js`):
   - Load services from `GET /api/scheduling/services` into `#spServiceSelect` (`value` = slug); keep current options as fallback.
   - Replace `SpouzyAvailabilityProvider` data with real data: when the service, duration or visible 7-day window changes, fetch `GET /api/scheduling/availability?date=YYYY-MM-DD&duration=30|60&serviceId=<id>` for the 7 visible dates, cache by `date|duration|serviceId`, then let `calculateSlots()` / `renderDateTabs()` / `renderSlotGrid()` read from the cache. API slot fields: `start_time`, `end_time`, `label`, `period`, `status` (`available | booked | blocked | passed`). Show a loading state while fetching. If the API fails, show "Live availability is unavailable — please book via WhatsApp" — do NOT show the fake demo slots.
   - On slot click store `HH:MM` in `#spSelectedTimeSlot` and the label in `data-label`; update every place that compares/displays `selectedSlotInput.value` (summary, re-render check) to use `dataset.label` for display.
   - Submit once via `SpouzyApi.bookAppointment({ serviceSlug, date, startTime, duration, consultationMode, clinicLocation, clientName, clientEmail, clientMobile, clientWhatsapp, clientNotes })`, then show the `SP-APT-…` confirmation and a "Continue on WhatsApp" button containing the reference. Remove the separate WhatsApp-on-submit path for this form.
7. Do NOT enable online payment in this phase (send `requiresPaymentHold: false`). Payment is Phase 4.

Acceptance:
```powershell
curl.exe -s http://localhost:5000/api/scheduling/services
curl.exe -s "http://localhost:5000/api/scheduling/availability?date=2026-12-15&duration=30&serviceId=1"   # use the couples-therapy id returned by the services call
Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/appointments -ContentType 'application/json' -Body '{"serviceSlug":"couples-therapy","date":"2026-12-15","startTime":"10:00","duration":30,"consultationMode":"video","clientName":"Test","clientEmail":"t@example.com","clientMobile":"+91 9876543210"}'
```
→ services 200, availability shows `10:00` available, booking 201 `SP-APT-…`; repeating the same booking → 400 slot unavailable; the slot now shows `booked` on the page and in Admin → Appointments / Dashboard "Today's Schedule" when the date is today.

### 1.5 Quick booking (`appointment.htm`)

Verified: this page does not load `spouzy-api.js`; its slot pills (`.sp-slot-pill`) are static; it only opens WhatsApp.
Task: on submit, redirect to `book-appoinment.htm?service=<slug>&mode=<virtual|mumbai|...>&date=<YYYY-MM-DD>` and make `book-appoinment.htm` pre-select those values from the query string. Remove the static fake pills or label them clearly as examples. (Ask the user if they prefer a full booking flow on this page instead.)

### 1.6 "Ask a question" and "Share your story"

Verified: backend routes are `POST /api/content/faqs/ask` and `POST /api/content/stories/submit`. `spouzy-api.js` posts to `/api/faqs/ask` and `/api/stories/submit` → **404**. The forms `#spAskQuestionForm` and `#spSubmitStoryForm` don't exist on any page. `testimonials-policy.htm` doesn't load `spouzy-api.js`. Errors are swallowed (`catch (e) {}`).

Tasks:
1. `faq.htm`: inside `<main class="guide-page"> … <div class="guide-body">`, after the FAQ `<details>` list, add a form `id="spAskQuestionForm"` with fields `name="question"` (textarea, required, min 15 chars), `name="category"` (select: General, Relationships, Intimate Health, Mediation, Other), `name="name"` (optional), `name="email"` (optional, "kept private, never published"), `name="consent"` checkbox (required). Reuse existing form classes.
2. `testimonials-policy.htm`: add `id="spSubmitStoryForm"` with `name="story_text"` (required, min 50 chars), `name="display_name"` (optional; empty = anonymous), `name="private_email"`, `name="private_phone"` (both private), `name="publish_consent"` checkbox (required). Add `<script src="js/spouzy-api.js"></script>` after `spouzy-modern.js` on this page.
3. `askQuestion()` → `POST /api/content/faqs/ask` `{ question, category, submitter_name, submitter_email, consent }`; `submitStory()` → `POST /api/content/stories/submit` `{ story_text, display_name, is_anonymous, private_email, private_phone, consent }`. Show success AND error banners (`showBanner`).
4. Backend `content.service.js` `submitVisitorQuestion` / `submitVisitorStory`: enforce the min lengths and consent; never return private email/phone in public `GET` endpoints.
5. Fix `backend/src/middlewares/csrf.middleware.js` exemption paths to the real paths (`/api/content/faqs/ask`, `/api/content/stories/submit`, `/api/careers/applications`) — needed for Phase 4.

### Phase 1 done when
- All 7 forms (doctor, counsellor, careers, contact, booking, ask a question, story) save from the real pages at `http://localhost:5000`, show a reference or a clear error, and never create duplicates on repeated clicks.
- Each record appears in its admin screen. `npm test` passes.

---

## Phase 2 — Correct admin access (permissions, roles, statuses, settings)

### 2.1 One permission vocabulary
Verified: role permissions in `seeders/content-manifest.json` and migration 2 use names the routes never check (`applications:*`, `schedules:*`, `faqs:*`), and `media.routes.js` requires role `staff`, which does not exist.

Canonical permissions (exactly what `admin.routes.js` checks, plus downloads):
`enquiries:view|edit|export`, `clinical_apps:view|edit|export|download_docs`, `careers:view|edit|download`, `appointments:view|edit|reschedule`, `scheduling:view|edit`, `practitioners:view|edit`, `content:view|edit|delete`, `blogs:view|edit|delete`, `moderation:view|edit`, `media:view|edit`, `settings:content`, `settings:gateway`, `users:manage`.

Role sets (**show this table to the user and get confirmation before applying**):

| Role slug | Permissions |
| --- | --- |
| `admin` | `all` |
| `operations_staff` | `enquiries:view,edit,export`, `clinical_apps:view`, `careers:view,edit,download`, `appointments:view,edit,reschedule`, `scheduling:view,edit`, `practitioners:view` |
| `clinical_director` | `clinical_apps:view,edit,export,download_docs`, `practitioners:view,edit`, `scheduling:view,edit`, `appointments:view,edit,reschedule`, `blogs:view,edit`, `moderation:view,edit` |
| `content_editor` | `content:view,edit,delete`, `blogs:view,edit,delete`, `moderation:view,edit`, `media:view,edit`, `settings:content` |
| `customer` | `customer:self` |

Tasks:
1. Migration 3: `UPDATE roles SET permissions = ? WHERE slug = ?` for each role above, and INSERT any missing role. (The seeder uses `findOrCreate`, so editing the manifest alone does NOT change existing databases.)
2. Update `content-manifest.json` roles to the same sets and add `clinical_director` there.
3. `media.routes.js`: replace `requireRole(['admin','clinical_director','staff'])` with a check that finds which record owns the asset: clinical application asset (incl. additional certs/signature) → `clinical_apps:download_docs`; career resume → `careers:download`; otherwise `media:view`. Admin always allowed.
4. `SETUP.md` / `API.md`: replace the role names `staff` with the real slugs.

### 2.2 Add-user role dropdown (CRITICAL)
Verified: `UsersAuditPage.jsx` hard-codes role ids (`2` Content Editor, `3` Operations, `5` Clinical Director, `1` Administrator). On a fresh `npm run db:setup`, migration 2 inserts `clinical_director` FIRST (id 1), so id 2 = **admin** → "Content Editor" creates an administrator.
Task: load roles from `GET /api/admin/roles`, options `value = role.id`, label `role.name`, exclude `customer`, default to `content_editor` by slug. Backend `POST /admin/users`: validate `role_id` exists and is not `customer`.

### 2.3 Status values must match the database
Model enums (source of truth):
- ClinicalApplication: `submitted, under_review, interview_scheduled, approved, rejected`
- CareerApplication: `submitted, under_review, interview_scheduled, offered, rejected`
- Appointment: `hold, confirmed, completed, cancelled, rescheduled, no_show`
- Enquiry: `new, contacted, in_progress, resolved, closed` (already correct)

Verified wrong values: `ClinicalPage.jsx` (`shortlisted`, `interviewed`), `CareersPage.jsx` (`shortlisted`, `interviewed`, `hired`), `AppointmentsPage.jsx` filter (`booked`, `in_progress`) and quick buttons (`in_progress`).
Tasks: use the enums above in dropdowns, filters and buttons (Appointments quick buttons: confirmed, completed, cancelled, no_show). Put the lists in one shared file `admin/src/constants/statuses.js`. Backend services reject unknown statuses with 400 + the allowed list. Update `StatusBadge.jsx` labels for every value.

### 2.4 Settings page keys
Verified: `SettingsPage.jsx` edits `contact_whatsapp`, `contact_email`, `cursor_trail_enabled`, `consultation_fee_inr`; seeded keys are `announcement_text`, `whatsapp_number`, `contact_phone`, `support_email`, `cursor_enabled`, `cursor_normal_path`, `cursor_normal_hotspot_x/y`, `cursor_pointer_path`, `cursor_pointer_hotspot_x/y`. Only `contact_phone` matches.
Tasks: use the seeded keys; add an "Announcement bar text" field (`announcement_text`); remove `consultation_fee_inr` (prices belong to services); remove `cursor_trail_enabled` (verified: nothing in `website/js` reads it). Backend `contentService.updateSettings`: accept only keys from an allow-list (seeded keys + `social_links` + gateway keys for `settings:gateway`); reject others with 400.

### 2.5 Small admin fixes
- `ContentPage.jsx` FAQ list: badge from `is_published` (currently always "Published").
- Export CSV links (`/api/admin/enquiries/export/csv`, `/api/admin/clinical-applications/export/csv`): hide when the user lacks the `:export` permission.

Phase 2 done when: logging in as each dev user shows only the menus they can use, every action they see works (no 403), every status change saves, and new users get the role that was picked.

---

## Phase 3 — Build the dashboard properly

Verified problems in `GET /api/admin/dashboard/stats` + `DashboardPage.jsx`: returns every count + 5 recent enquiries (name/email/phone) to anyone with ANY of `enquiries:view`, `clinical_apps:view`, `appointments:view`; "today" uses `new Date().toISOString()` (UTC, wrong for IST 00:00–05:30); `questionsPending` / `storiesPending` are returned but not shown; the `isContentOnly` switch hides the operational view from mixed roles.

### 3.1 Backend
1. `backend/src/config/time.js`:
   ```js
   const TZ = 'Asia/Kolkata';
   function todayIST() { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date()); } // YYYY-MM-DD
   function istDayStartUtc(ymd) { return new Date(`${ymd}T00:00:00+05:30`); }
   module.exports = { TZ, todayIST, istDayStartUtc };
   ```
   Use it in the dashboard and anywhere "today" is computed (`scheduling.service.js` has its own IST offset — switch it to this helper).
2. New endpoint `GET /api/admin/dashboard/overview` (keep `/stats` until the UI is switched, then remove it). Include ONLY the sections the user may see:
   - `enquiries` (`enquiries:view`): `total`, `new`, `today`, `last7Days`, `bySource`, `recent` (5 latest, with contact details).
   - `clinical` (`clinical_apps:view`): `total`, `byStatus`, `byRole {doctor, counsellor}`, `awaitingReview` (= submitted), `last7Days`.
   - `careers` (`careers:view`): `total`, `byStatus`, `byOpening`, `last7Days`.
   - `appointments` (`appointments:view`): `today` (list with time, client name, service, practitioner, mode, status), `upcoming7Days`, `activeHolds`, `noShowsThisMonth`.
   - `payments` (`settings:gateway` or admin): `paidThisMonthMinor`, `pendingCount` (from PaymentOrder / Appointment.payment_status).
   - `moderation` (`moderation:view`): `questionsPending`, `storiesPending`.
   - `content` (`content:view` or `blogs:view`): same data as `/dashboard/content-summary`.
   - `trend` (any section above): last 14 IST days `[{ date, enquiries, applications, appointments }]`, each series only if allowed.
   Use `createdAt >= istDayStartUtc(...)` for date filters (timestamps are stored in UTC).
3. Add tests: each dev role gets only its sections; "today" is correct for an IST date.

### 3.2 Admin UI (`DashboardPage.jsx`)
- Remove `isContentOnly`. Render a card for each section returned, in this order: Enquiries, Applications (doctor / counsellor / careers), Today's consultations, Holds & payments, Moderation, Content.
- Each card links to its page with filters applied: `/enquiries?status=new`, `/clinical?status=submitted&role=doctor`, `/careers?status=submitted`, `/appointments?date=<today>`, `/content?tab=faqs`, `/content?tab=stories`. Make those pages read their initial filters from the URL (`useSearchParams` from `react-router-dom`).
- 14-day trend: small inline SVG line or bar chart (no new dependency), one colour per series, with a legend.
- Keep the existing look (`.sp-stats-grid`, `.sp-stat-card`, `.sp-card`, `.sp-table`). Loading and error states as today.

Phase 3 done when: each role sees only its cards, numbers match the database, today's schedule is right at 01:00 IST, and every card opens the filtered list.

---

## Phase 4 — Website content from the CMS, missing admin screens, security

### 4.1 Show admin content on the website (with HTML fallback)
Verified: only `banner-tips.js` reads the API (`/api/content/tips`). Everything else is hard-coded.
1. New `website/js/spouzy-content.js`, loaded on all 51 pages after `spouzy-modern.js`. It fetches `GET /api/content/settings` once and replaces, only when a value exists: announcement text (`.sp-topbar-sentence`), `tel:` links, `wa.me/…` links (keep the `?text=` part), `mailto:` links, footer social links (`GET /api/content/social-links`). If the API fails, leave the HTML untouched.
2. Page loaders (same fallback rule): hero slides on `index.htm` (`.sp-hero-banner-slides .sp-hero-banner-slide`, keep markup/classes) from `/api/content/hero-banners`; FAQ `<details>` on `faq.htm` from `/api/content/faqs`; approved stories on `testimonials-policy.htm` from `/api/content/stories`; job cards `.sp-job-card` on `careers.htm` from `/api/careers/openings`; blog list on `blog.htm` from `/api/content/blogs`.
3. `banner-tips.js`: start rotating only after the fetch settles (today the first round always uses the built-in list).
4. Seed `homepage_sections`: one row per content block on `index.htm` (use the scratch helper idea in `scratch/inventory-homepage.js` only as reference) so Admin → Content → Homepage Sections is not empty; then render them via `/api/content/homepage-sections`.
5. Remove the duplicate "Careers" link under "Join Our Team" in the mobile drawer (`.sp-drawer-sublink[href="careers.htm"]` appears twice on 37 pages).

### 4.2 Missing admin screens (routes already exist unless noted)
- Blogs: create / edit / delete + categories (`POST/PUT/DELETE /admin/blogs`, `GET/POST /admin/blog-categories`), with `sanitize-html` on `body_html`.
- FAQs: create / edit / delete (`POST/PUT/DELETE /admin/faqs`).
- Practitioners + weekly hours (`GET/POST/PUT /admin/practitioners`; add weekly-schedule routes).
- Blocked time list + remove (`GET /admin/schedules/blocks`, `DELETE /admin/schedules/blocks/:id`).
- Career openings: edit + deactivate (`PUT /admin/career-openings/:id`).
- Users: edit, deactivate, reset password, custom permissions (`PUT /admin/users/:id/permissions`); roles editor (`PUT /admin/roles/:id`).
- Media upload (new `POST /admin/media`, public uploads) and image pickers for hero banners.
- Services & prices (new routes + screen).

### 4.3 Security before going live
1. Payments: `POST /api/payments/create-order` must take an appointment reference and compute the amount from `appointments.amount_minor_units` — never from the request body. Then (only if the user wants online payment) add Razorpay checkout to the booking page: create hold → create order → checkout → `POST /api/payments/verify` → confirm.
2. CORS (`app.js`): allow only `ALLOWED_ORIGINS` (+ localhost only when `NODE_ENV !== 'production'`); remove the unconditional `callback(null, true)`.
3. CSRF: mount `csrfProtection` on `/api/admin` and `/api/auth/logout` (the admin `api.js` already sends `X-CSRF-Token`).
4. `app.set('trust proxy', 1)` in production (cPanel/Passenger), so rate limits are per visitor.
5. Honour `STORAGE_PATH` from `.env` in `config/environment.js`.
6. Future schema changes = real migrations (no `sequelize.sync()`).
7. Remind the user to: reset the 3 dev staff passwords, delete the 11-byte test files in `backend/storage/uploads/private/`, and never deploy `scratch/`.

---

## Appendix — quick reference of verified facts

| # | Fact | Where |
| --- | --- | --- |
| 1 | `POST /api/career-applications` → 404; real route `POST /api/careers/applications` | `routes/index.js`, `career.routes.js` |
| 2 | 6 wrong careers IDs (see 1.1) | `spouzy-api.js` `initCareersApplicationApi` |
| 3 | Slot label sent as `startTime` → NaN | `spouzy-modern.js` `selectedSlotInput.value = slot.label` |
| 4 | Fake availability | `spouzy-modern.js` `SpouzyAvailabilityProvider` |
| 5 | `GET /api/scheduling/services` → 500 | `scheduling.service.js` `getServices` |
| 6 | `requiresPaymentHold` vs `requirePayment` | `appointment.routes.js` / `appointment.service.js` |
| 7 | FAQ/story URLs 404, forms missing | `spouzy-api.js` `initFaqAndStoryApi` |
| 8 | Clinical fields not sent: work mode, declaration date, signed name, signature, additional qualifications + certs | `spouzy-api.js` `initClinicalApplicationApi` |
| 9 | Role permission names ≠ route names; role `staff` missing | `content-manifest.json`, migration 2, `media.routes.js` |
| 10 | Hard-coded role ids in Add User | `UsersAuditPage.jsx` |
| 11 | Status values not in DB enums | `ClinicalPage.jsx`, `CareersPage.jsx`, `AppointmentsPage.jsx` |
| 12 | Settings keys mismatch | `SettingsPage.jsx` vs `content-manifest.json` |
| 13 | Dashboard: all counts + enquiry PII to any staff role; UTC "today" | `admin.routes.js` `/dashboard/stats`, `DashboardPage.jsx` |
| 14 | Homepage sections never seeded | seeders |
| 15 | Website reads only tips from the CMS | `website/js/*` |
| 16 | CORS allows all origins with credentials; CSRF middleware unused; no `trust proxy`; payment amount from client | `app.js`, `csrf.middleware.js`, `payment.routes.js` |
