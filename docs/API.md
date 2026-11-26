# SPOUZY Backend API Reference

## Base URL
- Local: `http://localhost:5000/api`
- Production: `https://your-domain.com/api`

---

## 1. Authentication Endpoints

### `POST /api/auth/login`
Admin, clinical director, and operations staff authentication.
- **Body**:
  ```json
  {
    "email": "admin@spouzy.com",
    "password": "AdminPass123!"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Login successful",
    "token": "d7486e92-3c82-411d-8cb5-961019128fbe",
    "user": {
      "id": 1,
      "email": "admin@spouzy.com",
      "name": "PSG Administrator",
      "role": "admin",
      "permissions": ["all"]
    }
  }
  ```
  *Also sets an HTTP-only cookie `spouzy_session`.*

### `POST /api/auth/customer/register`
Public client portal registration.
- **Body**: `{ "name": "...", "email": "...", "phone": "...", "password": "..." }`

### `POST /api/auth/customer/login`
Client portal login.

### `GET /api/auth/me`
Returns current session profile. Requires Bearer header or HTTP-only session cookie.

### `POST /api/auth/logout`
Terminates current session and clears cookie.

---

## 2. Public Submission Endpoints

### `POST /api/enquiries`
Submits confidential website inquiry from `contactus.htm` or floating contact widget.
- **Rate Limit**: 60 requests / hour / IP.
- **Body**:
  ```json
  {
    "name": "Pooja Verma",
    "email": "pooja.verma@example.com",
    "phone": "+91 98765 43210",
    "whatsapp": "+91 98765 43210",
    "preferred_clinic": "Mulund Flagship Clinic, Mumbai",
    "service_interest": "Couples Counselling",
    "preferred_contact_method": "WhatsApp",
    "subject": "Couples Counselling",
    "message": "Inquiry details...",
    "consent": true,
    "source": "contact_page"
  }
  ```
`consent` is required. `source` is `contact_page` (default) or `floating_widget` (call-back form; email optional).
The same details sent again within 10 minutes return the first reference (`duplicate: true`).
Validation errors return `400 { success: false, message, errors: { field: reason } }`.
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Enquiry submitted successfully. Our team will contact you shortly.",
    "data": {
      "id": 1,
      "referenceNo": "SP-ENQ-26-XXXXXX",
      "name": "Pooja Verma",
      "createdAt": "2026-11-18T07:00:00.000Z"
    }
  }
  ```

### `POST /api/clinical-applications`
Doctor and Counsellor empanelment registration with multipart file attachments (`join-doctor.htm` & `join-counsellor.htm`).
- **Content-Type**: `multipart/form-data`
- **Fields**:
  - `role_type`: `"doctor"` or `"counsellor"`
  - `title`: `"Dr"`, `"Mr"`, `"Ms"`, etc.
  - `first_name`, `last_name`, `gender`, `dob`, `mobile`, `whatsapp`, `email`
  - `practice_status`, `experience_years`, `institution_name`, `specialisation`
  - `primary_qualification`, `primary_college`, `primary_year`, `primary_grade`
  - `pg_qualification`, `pg_college`, `pg_year`, `pg_grade`
  - `council_name`, `registration_number`, `state_jurisdiction`, `registration_year`, `valid_until`
  - `declaration_agreed`: `true`
  - `typed_signature`: Candidate typed signature
- **File Attachments**:
  - `photo`: JPG/PNG portrait (max 10 MB)
  - `primary_cert`: Degree certificate (PDF/JPG, max 10 MB)
  - `pg_cert`: Post-graduate certificate (optional)
  - `council_cert`: Medical council or professional registration certificate
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Application submitted successfully.",
    "data": {
      "id": 1,
      "referenceNo": "SP-DOC-XXXXX",
      "roleType": "doctor",
      "fullName": "Dr Vikram Mehta"
    }
  }
  ```

### `POST /api/career-applications`
Careers candidate application (`careers.htm`).
- **Content-Type**: `multipart/form-data`
- **Fields**: `role_title`, `career_opening_id`, `full_name`, `email`, `mobile`, `whatsapp`, `city`, `experience_level`, `current_role`, `highest_qualification`, `skills`, `portfolio_url`, `notice_period`, `expected_compensation`, `statement_of_purpose`.
- **File Attachment**: `resume` (PDF or DOC/DOCX, max 10 MB).
- **Response**: `{ "success": true, "data": { "referenceNo": "SP-CAR-XXXXX" } }`

---

## 3. Scheduling, Appointments & Payments

All dates are `YYYY-MM-DD` and times `HH:MM` in IST (Asia/Kolkata).

### `GET /api/scheduling/config`
Today's IST date, booking windows and the public payment status:
`{ today, timezone, free: { earliestDate, latestDate, minMonthsAhead }, paid: { earliestDate, latestDate, holdMinutes }, payment: { enabled, message | keyId, checkoutScript } }`.
Free consultations start two calendar months from today; paid bookings start today.
When the request carries a customer session cookie the response also has
`account: { benefit, verification: { status, category, admin_message } | null, active_booking | null }` and, for a customer
with an approved student / ex-servicemen ID, `free.earliestDate` is today and `minMonthsAhead` is 0 (`Cache-Control: private, no-store`).
`GET /api/scheduling/availability?bookingType=free` applies the same benefit.

**One consultation at a time** (logged-in customers, every booking type): `POST /api/appointments` answers
`409 { code: "ACTIVE_BOOKING", message }` while the customer (account or its email) has a confirmed/rescheduled consultation
today or later, or a live payment hold. The next booking is possible after it has taken place (completed / no-show) or was cancelled.

### `GET /api/scheduling/services` / `GET /api/scheduling/practitioners?serviceSlug=`
Active services with `price_30_inr`, `price_60_inr`, `practitioner_types`; practitioners allowed for a service
(counselling → counsellors, intimacy clinic → doctors, mediation → mediators).

### `GET /api/scheduling/availability`
- **Query**: `date` (required), `duration` `30|60`, `serviceSlug` or `serviceId`, `practitionerId` (optional), `bookingType` `free|paid`.
- **Response**: `{ date, booking_type, earliest_date, latest_date, is_closed, reason, operating_hours, slots: [{ start_time, end_time, label, duration, period, status }] }`
  where `status` is `available`, `booked`, `blocked` or `passed`. A slot is available when at least one eligible practitioner is free.

### `POST /api/appointments`
```json
{
  "serviceSlug": "couples-therapy",
  "practitionerId": "any",
  "bookingType": "paid",
  "date": "2026-12-15",
  "startTime": "10:00",
  "duration": 30,
  "consultationMode": "video",
  "clientName": "Sunil Kumar",
  "clientEmail": "sunil.kumar@example.com",
  "clientMobile": "+91 98100 99887",
  "clientNotes": "Communication guidance",
  "consent": true
}
```
`consultationMode` accepts `video`, `phone`, or a clinic (`mumbai`, `pune`, `delhi`, `bengaluru`) for in-person.
The server picks a free eligible practitioner inside a transaction (409 if the slot was just taken).
Response `201`: `{ referenceNo, status, bookingType, practitioner, service, payment: { required, onlineEnabled, amountInr, message } }`.
- Free → `confirmed`, payment `not_required`.
- Paid with the payment driver on → `hold` for 15 minutes until paid.
- Paid with the driver off → `confirmed`, payment `pending` ("coming soon" message).

### `GET /api/appointments/lookup/:referenceNo?email=`
Booking status for the client (email must match).

### Payments (`/api/payments`)
- `GET /config`: `{ enabled: false, message }` or `{ enabled: true, keyId, mode, checkoutScript }` (never secrets).
- `POST /create-order` `{ appointmentReference }`: Razorpay order; the amount always comes from the booking.
- `POST /verify` `{ gatewayOrderId, gatewayPaymentId, gatewaySignature }`: HMAC check, confirms the booking.
- `POST /webhook`: Razorpay webhook (`payment.captured`, `order.paid`), signed with the webhook secret.

---

## 4. Public Content Endpoints (`/api/content`)

- `GET /hero-banners`: published, active banners in display order.
- `GET /homepage-sections`: homepage block titles (`headline`, `subheadline`, `content_json.kicker`, `content_json.emphasis`).
- `GET /tips`, `GET /tips/today`: relationship tips.
- `GET /blogs?page=&limit=&category=&search=`, `GET /blogs/:slug`: published articles (used by `blog.htm` via `js/spouzy-blog.js`).
  Pictures: `banner_image` (16:9, top of the article and the sliding banner when `show_in_banner`), `thumbnail_image` (16:9 card; falls back to the banner), `cover_image` (picture inside the article).
- `GET /faqs`: the FAQ page (`faq.htm`): every published question **without its answer** `[{ id, category, question, pages }]` and `total`.
  `?for=home` = homepage questions with answers (in their own order); `?for=<page key>` (`pre-marriage`, `post-marriage`, `relationships`, `intimate-health`, `intimate-aesthetics`,
  `divorce-mediation`, `harassment-support`) = a "What We Do" page box: the first 8
  with answers, `total` (also in `X-Total-Count`) = how many that page has.
- `GET /faqs/:id`: one published answer `{ id, category, question, answer_html, pages }` (FAQ page popup); 150 per 15 minutes per visitor.
- `POST /faqs/ask` `{ question (15+ chars), name?, email?, category?, consent }`.
- `GET /stories`: approved, visible client stories `{ id, name (masked, e.g. "R***t & P***a S." or "Anonymous"), quote, rating, badge, verified, tag, service, date }`.
  `?home=1` = only the ones chosen for the homepage (max 12). Never contains email, phone, account or the real name.
- `POST /stories/submit`: no longer accepts stories; answers `401 { code: "login_required" }` (stories are shared from a customer account).
- `GET /settings`: public settings (`announcement_text`, `whatsapp_number`, `contact_phone`, `support_email`, cursor keys).
- `GET /social-links`.
- `GET /api/careers/openings`: active job openings (careers page cards and role dropdown).

---

## 4b. Customer Accounts, Packages & Cart

Customers use the website pages `register.htm` (login), `create-account.htm`, `packages.htm`, `cart.htm` and `account.htm`.
Sessions use the same HTTP-only cookie as staff; a readable `spouzy_customer=1` cookie tells the website to show "My Account".
All `/api/customer/*` writes need the `X-CSRF-Token` header (value of the `spouzy_csrf` cookie).

- `POST /api/auth/customer/register` `{ name, email, phone, password, consent }` → `201`, signed in. Password: 8+ characters with upper-case, lower-case and a number. Existing email → `409`.
- `POST /api/auth/customer/login` `{ identifier, password }` (email **or** mobile number) → `200` or `401`. Staff accounts cannot log in here.
- `POST /api/auth/customer/check` `{ email?, phone? }` → `{ exists, matched_by: 'email'|'phone', masked_email, can_login }` (used by the booking popup to choose "Log in" or "Create account"; 30 checks per 15 minutes).
- One customer account per mobile number: registering an existing email or mobile returns `409` with the field in `errors`.
- `POST /api/auth/logout`, `POST /api/auth/change-password` `{ currentPassword, newPassword }`.
- `GET /api/packages?service=` (public): `{ packages: [{ id, slug, name, price_inr, compare_at_inr, is_free, sessions_included, session_minutes, validity_days, features[], service_slugs[], badge, offer }], services, payment: { enabled, message } }` (`offer`: see Offers below).
- `GET /api/customer/cart`: `{ items: [{ package, quantity, line_total_inr }], count, total_inr, has_free, has_paid, payment, can_checkout }`.
- `POST /api/customer/cart` `{ packageSlug | packageId, quantity }` (1–5; a free package only once), `PATCH /api/customer/cart/:packageId` `{ quantity }`, `DELETE /api/customer/cart/:packageId`.
- `POST /api/customer/checkout` `{ freeOnly?, note? }`:
  - only free packages → order `confirmed`, `payment_status: not_required` (one free package per customer);
  - paid packages while the payment driver is off → `409` "Online payment integration is coming soon", nothing saved;
  - paid packages with the driver on → order `pending_payment` plus a Razorpay order (`payment.gatewayOrderId`, `amount`, `keyId`); confirm with `POST /api/payments/verify`. The webhook also marks the order paid.
- `GET /api/customer/orders`, `GET/PUT /api/customer/profile` `{ name, phone }`.
- `GET /api/customer/appointments`: appointments booked while logged in (reference, date, time, service, practitioner, mode, type, status, payment).
- `POST /api/customer/activity` `{ events: [{ event: 'page_view'|'click'|'booking_step', page, label, href, title, at, beforeLogin }] }` (max 40 per call; sent by `js/spouzy-content.js`). Form contents are never sent.

### Offers (popup and package cards)
Offers are uploaded in Admin → Packages & Orders → Offers. With no live offer the website shows no popup and no "Offers" tab.

- `GET /api/offers` (public) → `{ offers: [{ id, title, description, image_url, image_alt, badge_text, terms, start_date, end_date,
  show_popup, cta_label, cta_url, package: { id, slug, name, price_inr, offer_price_inr, is_free } | null }] }`.
  Only live offers: switched on, today (India time) between `start_date` and `end_date` (both inclusive, either may be empty),
  image file present, and the linked package (if any) switched on.
- A live offer linked to a package with an offer price changes that package everywhere: `GET /api/packages` returns
  `price_inr` = offer price, `compare_at_inr` = normal price and `offer: { id, title, badge_text, end_date, has_price, save_inr }`;
  the cart and checkout charge the offer price, and order items record `list_price_minor` and `offer: { id, title }`.
  When the offer ends the normal price applies again automatically.
- Website (`js/spouzy-offers.js`, loaded on every page by `js/spouzy-content.js`): the popup opens once per visit about
  6 seconds after the page loads (after the first-visit intro), never by itself on packages, cart, login, account or booking
  pages; closing keeps it closed for 24 hours (until a new offer is added); the "Offers" tab (bottom left) reopens it.
  `?offers=1` opens it straight away. On the homepage the "Specialized Care" section shows the first six live packages
  in the same card design, with any linked offer on its card.
- Admin endpoints: `GET /api/admin/offers` (`offers:view`), `POST /api/admin/offers`, `PUT /api/admin/offers/:id`,
  `DELETE /api/admin/offers/:id` (`offers:edit`). Fields: `title`*, `image_path`*, `description`, `image_alt`, `badge_text`,
  `package_id`, `offer_price_inr`, `cta_label`, `cta_url` (our page such as `pre-marriage.htm` or `https://…`), `terms`,
  `start_date`, `end_date` (`YYYY-MM-DD`), `show_popup`, `is_active`, `sort_order`. Setting or changing `offer_price_inr`
  also needs `packages:edit` (administrators); it must be at least ₹1 and lower than the package's normal price.
- The chat assistant answers "any offers / discount?" from the live offers.

### My stories (customer login)

- `GET /api/customer/stories` → `{ stories: [{ id, story_text, shown_as, rating, service_key, state: pending|live|hidden|rejected, customer_message, edited_by_team, … }], verified, services, suggested_name }`
- `POST /api/customer/stories` `{ story_text (40–3000), service_key, rating 1–5, display_name | is_anonymous, city?, tag_line?, consent: true }`:
  saved as pending, the admin gets a "visitor_story" notification. Max 3 waiting per customer.
- `PUT /api/customer/stories/:id`: any change sends it back for review (a live story leaves the website until approved again).
- `DELETE /api/customer/stories/:id`: withdraw (deleted).
- "Verified" is set automatically when the account (or its email) has a completed or paid appointment, or a paid/completed package order.

### Student / ex-servicemen ID verification (customer login)

- `GET /api/customer/verification` → `{ latest: { id, category, category_label, institution_name, service_branch, id_number, expiry_date, expiry_text, status: pending|approved|rejected, admin_message, submitted_at, files: [{ name, type, size }] } | null, benefit, active_booking, can_upload, categories, service_branches }`.
  `benefit` = `{ active, category, label, valid_until, valid_until_text, expired_on, approved_on, last_consultation*, next_reminder*, reminder_due* }` (* ex-servicemen).
- `POST /api/customer/verification` (multipart, 12 per hour): `category` `student|ex_servicemen`, `id_number?`, students `institution_name` + `expiry_date`
  (`YYYY-MM-DD`, today or later), ex-servicemen `service_branch` (Army, Navy, Air Force, Coast Guard, CAPF, Other defence service);
  files `front` (required) and `back` (optional), JPG/PNG/WebP/PDF up to 8 MB, stored privately. A new upload while one is
  pending replaces its files. The admin gets an `id_verification` notification.
- Benefit while approved and not expired: free consultation from today. Student benefit ends after `expiry_date`; ex-servicemen
  have no expiry. A daily job (09:05 IST) raises an `esm_reminder` notification 12 months after an ex-serviceman's last
  consultation (or approval), once per year.

### Bills (invoices) and My bills
A bill is created automatically when a payment succeeds (`POST /api/payments/verify`, the Razorpay webhook, or staff
recording a package order as paid). Bill numbers run per Indian financial year: `SPZ/2026-27/0001`. Staff check the
"Bill from" and customer details and send it; only sent bills are visible to the customer.

- Customer (session + CSRF as above): `GET /api/customer/invoices` → `[{ id, invoice_no, issued_at, sent_at, total_inr, items[], is_new }]`;
  `GET /api/customer/invoices/:id` → the full bill (seller, customer, items, totals, `tax`, `amount_in_words`, `payment`) and marks it seen.
  Website: My Account → My bills, and `invoice.htm?id=…` (print / save as PDF, A4).
- Staff: `GET /api/admin/invoices?status=ready|sent&search&page` (`orders:view`), `GET /api/admin/invoices/:id` →
  `{ invoice, profiles[], customer_details[] }` (saved "Bill from" details and this customer's saved billing details for the dropdowns);
  `PUT /api/admin/invoices/:id` (`orders:edit`) `{ seller: { profile_id } | { business_name*, address*, gstin, gst_rate, sac_code, phone, email, website, footer_note, make_default },
  customer: { name*, company, email, phone, address, gstin }, notes }` — new details are saved for next time;
  `POST /api/admin/invoices/:id/send` (`orders:edit`; needs business name and address); a sent bill cannot be changed (`409`).
  `POST /api/admin/package-orders/:id/invoice` creates the bill of an older paid order. Saved details:
  `GET /api/admin/billing-profiles`, `POST /api/admin/billing-profiles/:id/default`, `DELETE /api/admin/billing-profiles/:id`.
  Staff view of any bill: `invoice.htm?id=…&staff=1`.
- GST: prices include GST. With a GSTIN and rate on the "Bill from" details the bill shows the taxable value and
  CGST + SGST (same state, or no customer GSTIN) or IGST (customer GSTIN from another state), titled "Tax Invoice".

### Admin notifications
Every event creates a notification that staff with the matching permission see (bell in the admin header, Notifications page,
Dashboard → Latest notifications), newest first; read state is per staff member.
Types: `payment_received` (with its bill), `payment_failed`, `bill_sent` (`orders:view`); `order_placed`, `free_claimed`,
`customer_signup` (`orders:view`); `appointment_booked` (`appointments:view`); `enquiry`, `callback` (`enquiries:view`);
`clinical_application` (`clinical_apps:view`); `career_application` (`careers:view`); `visitor_question`, `visitor_story` (`moderation:view`).

- `GET /api/admin/notifications?limit&before&category=payments|orders|bookings|enquiries|applications|website&unread=1`
  → `{ notifications: [{ id, type, category, level, title, message, link, created_at, read, bill_status? }], has_more }`
- `GET /api/admin/notifications/summary` → `{ unread, latest_id, latest[] }` (the admin polls it every 25 seconds)
- `POST /api/admin/notifications/read` `{ ids: [..] }` or `{ all: true }`

### Booking with an account
While the setting `booking_requires_account` is `true` (default; Admin → Settings), `POST /api/appointments` returns
`401 { code: 'LOGIN_REQUIRED' }` unless a customer is logged in (session cookie **and** matching `X-CSRF-Token`).
For a logged-in customer the name, email and mobile are taken from the account (whatever the form sends), the booking
is linked to the account and appears under My appointments, and a `booking` activity is recorded.

### Website chat assistant
The floating chat button on every page opens the SPOUZY assistant (`js/spouzy-chat.js`). It is rule-based (no outside AI
service): it answers from the live prices (Appointments → Services & Prices), packages, FAQs (admin FAQs plus `faq.htm`),
contact settings and the clinic list on `contactus.htm`, and adds links to the matching website pages. A customer login is
required; visitors can log in or create an account inside the chat (name → email → mobile → password → agree to the Terms).
All calls need the customer session and `X-CSRF-Token`; 40 messages per minute per customer.

- `POST /api/customer/chat/start` `{ conversationId?, page? }` → `{ conversationId, resumed, idleSeconds, messages[] | history[] }`
  (re-opens the customer's open chat with its `history`, or starts a new one with a greeting in `messages`).
- `POST /api/customer/chat/message` `{ conversationId, text }` (up to 500 characters; empty → `400`) →
  `{ conversationId, restarted, ended, messages: [{ text, links[{ label, url }], chips[] }] }`.
  If the chat had already ended, a new conversation starts and `restarted` is `true`.
- `POST /api/customer/chat/end` `{ conversationId, reason: 'idle'|'user' }` → `{ ended: true, messages: [thank-you note] }`.
- Settings (Admin → Settings → Website chat): `chat_enabled` (`true`/`false`) and `chat_idle_seconds` (15–600, default 30):
  with no reply for that long the chat ends with a thank-you note; typing again starts a new chat.
- Questions it cannot answer are flagged. Admin → Website Chat lists conversations and "Questions to answer";
  "Add an answer" saves an FAQ that the assistant uses straight away.
- Admin endpoints (`enquiries:view`): `GET /api/admin/chats?page&limit&search&unanswered=true`, `GET /api/admin/chats/:id`,
  `GET /api/admin/chat-unanswered?days=30`.
- Safety: messages about self-harm, abuse or an emergency always get the emergency number (112) and Tele-MANAS (14416) first.

---

## 5. Protected Admin Endpoints (`/api/admin/*`)

Requires a staff session (HTTP-only cookie plus `X-CSRF-Token` header for writes, or a Bearer token).
Each endpoint checks a permission; administrators have all permissions.

| Area | Endpoints | Permission |
|---|---|---|
| Dashboard | `GET /dashboard/overview` (sections per role + 14-day trend), `GET /dashboard/stats`, `GET /dashboard/content-summary` | per section |
| Enquiries | `GET /enquiries?status=&source=&search=`, `GET /enquiries/:id`, `PATCH /enquiries/:id`, `POST /enquiries/:id/notes`, `GET /enquiries/export/csv` | `enquiries:view/edit/export` |
| Doctor & counsellor applications | `GET /clinical-applications?role=&status=`, `GET /clinical-applications/:id`, `PATCH /clinical-applications/:id`, `GET /clinical-applications/export/csv` | `clinical_apps:view/edit/export` |
| Careers | `GET/POST /career-openings`, `PUT /career-openings/:id`, `GET /career-applications`, `GET/PATCH /career-applications/:id` | `careers:view/edit` |
| Appointments | `GET /appointments?date=&status=&bookingType=&paymentStatus=`, `GET /appointments/:id`, `PATCH /appointments/:id/status`, `POST /appointments/:id/reschedule` | `appointments:view/edit/reschedule` |
| Student / ex-servicemen IDs | `GET /verifications?state=pending|approved|expired|rejected|reminders|all&q=`, `GET /verifications/:id` (with earlier uploads and the benefit), `POST /verifications/:id/approve` `{ expiry_date?, internal_note? }`, `POST /verifications/:id/reject` `{ message (10+ chars, shown to the customer), internal_note? }`, `POST /verifications/:id/reminded`; ID files via `GET /api/media/private/:id` | `verifications:view/edit` (administrators only for now) |
| Scheduling | `GET /schedules/blocks`, `POST /schedules/block`, `DELETE /schedules/blocks/:id`, `GET /services`, `PUT /services/:id` (prices in paise) | `scheduling:view/edit` |
| Practitioners | `GET/POST /practitioners`, `PUT /practitioners/:id`, `GET/PUT /practitioners/:id/schedule` (weekly hours) | `practitioners:view/edit` |
| Homepage | `GET /homepage-sections`, `PUT /homepage-sections/:key`, history and rollback; `GET/POST /hero-banners`, `PUT/DELETE /hero-banners/:id`, `POST /hero-banners/:id/duplicate`; tips CRUD | `content:view/edit/delete` |
| Blog | `GET /blogs`, `POST /blogs`, `PUT/DELETE /blogs/:id`, `GET/POST /blog-categories` | `blogs:view/edit/delete` |
| FAQs | `GET /faqs`, `GET /faqs/meta`, `POST /faqs`, `PUT/DELETE /faqs/:id` (fields: `question`, `answer_text` (plain text: blank line = paragraph, `- ` bullet, `**bold**`, `[text](page.htm)`), `category`, `is_published`, `show_on_faq_page`, `show_on_home`, `pages[]`, `sort_order`); `POST /faqs/bulk` `{ ids, action: publish\|hide\|delete\|add_page\|remove_page\|set_category\|faq_page_on\|faq_page_off, page?, category? }`; `POST /faqs/reorder` `{ list: home\|faq, ids }`; Excel: `GET /faqs/template` (sample file), `GET /faqs/export` (all FAQs), `POST /faqs/import` multipart `file` (.xlsx/.csv), `mode=preview\|apply`, `strategy=merge\|replace` | view: `moderation:view`; changes: `moderation:edit` |
| Visitor questions | `GET /visitor-questions`, `POST /visitor-questions/:id/answer`, `PATCH /visitor-questions/:id` | `moderation:view/edit` |
| Client stories | `GET /stories?state=pending\|live\|hidden\|rejected\|all&q=`, `GET /stories/:id`, `POST /stories` (admin adds; `publish`), `PUT /stories/:id` (edit any field, badge, verified, homepage), `PATCH /stories/:id` `{ action: approve\|reject\|hide\|show, customer_message?, internal_notes? }`, `DELETE /stories/:id`, `POST /stories/reorder` `{ ids }` | `moderation:view/edit` |
| Media | `GET /media`, `POST /media` (multipart `file`: JPG/PNG/WebP → `/media/public/<file>`) | `media:view/edit` |
| Settings | `GET/PUT /settings` (allow-listed keys only), `GET/PUT /social-links` | `settings:content` |
| Payment driver | `GET/PUT /gateway-config` `{ mode, key_id, secret?, webhook_secret?, is_active }` | `settings:gateway` |
| Packages & orders | `GET /packages`, `POST /packages`, `PUT /packages/:id` (`price_inr`, `features[]`, `service_slugs[]`, `is_active`…), `GET /package-orders?status=&search=`, `PATCH /package-orders/:id` `{ status, payment_status, internal_notes }`, `GET /customers` (with `last_seen`, `active_today`), `PATCH /customers/:id` `{ is_active, password }`, `GET /customers/:id/activity?days=` (timeline + appointments), `GET /customer-activity?day=` (customers active that day) | `packages:view/edit`, `orders:view/edit` |
| Staff | `GET/POST /users`, `PUT /users/:id`, `GET /roles`, `PUT /roles/:id`, `GET /permissions`, `GET /audit-logs` | administrator |

Staff change their own password with `POST /api/auth/change-password` `{ currentPassword, newPassword }`.

---

## 6. Private Media Downloads

### `GET /api/media/private/:id`
Protected file download for resumes, qualification certificates, and medical council registrations stored in `backend/storage/uploads/private/`.
- **Security**: Requires a staff session. Certificates need `clinical_apps:download_docs`, resumes `careers:download`. Direct static access is disabled.
- **Headers**:
  - `Content-Disposition`: `inline; filename="safe_filename.pdf"`
  - `Content-Type`: Checked MIME type
