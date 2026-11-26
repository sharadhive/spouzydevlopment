# SPOUZY Integration Map (website ↔ backend ↔ admin)

How each website feature reaches the backend and where staff manage it. Every form saves online first,
shows a reference number, and only then offers the WhatsApp button (the WhatsApp message carries the reference).

## 1. Website forms

| Feature | Page / form | API | Saved in | Admin screen (permission) |
|---|---|---|---|---|
| Contact enquiry | `contactus.htm` `#spContactForm` | `POST /api/enquiries` (source `contact_page`, consent required) | `Enquiry` | Enquiries CRM (`enquiries:view/edit/export`) |
| Call-back widget | every page, `#spFloatingQuickEnquiry` | `POST /api/enquiries` (source `floating_widget`, email optional) | `Enquiry` | Enquiries CRM, filter "Call-back widget" |
| Doctor application | `join-doctor.htm` `#spJoinAppForm` | `POST /api/clinical-applications` (multipart: photo, certificates, additional certificates, signature) | `ClinicalApplication`, private `MediaAsset` | Clinical Staff (`clinical_apps:*`; documents `clinical_apps:download_docs`) |
| Counsellor application | `join-counsellor.htm` `#spJoinAppForm` | same, `role=counsellor` (council certificate optional with "Not Applicable") | same | Clinical Staff |
| Careers application | `careers.htm` `#spCareersForm` | `POST /api/career-applications` (multipart resume) | `CareerApplication` | Careers Desk (`careers:*`; resumes `careers:download`) |
| Quick booking | `appointment.htm` | passes choices to `book-appoinment.htm?mode&date&practitioner` | — | — |
| Booking | `book-appoinment.htm` | `GET /api/scheduling/config`, `/services`, `/practitioners`, `/availability`; `POST /api/appointments` | `Appointment`, `AppointmentStatusHistory` | Appointments (`appointments:*`) |
| Online payment | `book-appoinment.htm` payment step | `GET /api/payments/config`, `POST /create-order`, `POST /verify`, webhook | `PaymentOrder` | Settings → Payment Driver (`settings:gateway`) |
| Ask a question | `faq.htm` `#spAskQuestionForm` | `POST /api/content/faqs/ask` | `VisitorQuestion` | Website Content → FAQs → Visitor questions (`moderation:*`) |
| Customer sign-up / login | `create-account.htm` `#spSignupForm`, `register.htm` `#spLoginForm` | `POST /api/auth/customer/register`, `/login` | `User` (role customer), `Session` | Packages & Orders → Customers (`orders:view/edit`) |
| Packages, cart, checkout | `packages.htm`, `cart.htm`, `account.htm` (`js/spouzy-shop.js`) | `GET /api/packages`, `/api/customer/cart`, `/checkout`, `/orders` | `Package`, `CartItem`, `PackageOrder`, `PaymentOrder` | Packages & Orders → Orders / Packages & Prices (`packages:edit` admin only) |
| Offers popup | every page (`js/spouzy-offers.js`, loaded by `js/spouzy-content.js`); offer notes on package cards | `GET /api/offers`; offer prices reach `GET /api/packages`, cart and checkout | `Offer` (linked `Package`) | Packages & Orders → Offers (`offers:view/edit`; offer price also `packages:edit`) |
| Homepage packages | `index.htm` "Specialized Care" section (`[data-live-packages]`) | `GET /api/packages` (first six live packages; original cards stay if the server is not reachable) | `Package`, `Offer` | Packages & Orders → Packages & Prices (order = position) |
| Bills | after every payment; customers: `account.htm#bills`, `invoice.htm?id=` (`js/spouzy-invoice.js`, `css/spouzy-invoice.css`) | created by `billing.service` on payment; `GET /api/customer/invoices`, `/:id`; staff `/api/admin/invoices*`, `/billing-profiles*` | `Invoice`, `BillingProfile`, `CustomerBillingDetail` | Packages, Bills & Orders → Bills (`orders:view`; prepare and send `orders:edit`) |
| Admin notifications | every event above (payments, orders, sign-ups, bookings, enquiries, call-backs, applications, questions, stories) | `notification.service.notify()`; `GET /api/admin/notifications*` | `Notification`, `NotificationRead` | Bell in the admin header, Notifications page, Dashboard (each role sees only its kinds) |
| Share a story | "Share your story" on the homepage carousel, `testimonials-policy.htm`, `account.htm#stories` (`js/spouzy-stories.js`; login popup from `js/spouzy-shop.js`) | `GET/POST/PUT/DELETE /api/customer/stories` (login required) | `VisitorStory` (`user_id`) | Website Content → Client Stories (approve, edit, hide/show, delete, add) |
| Student / ex-servicemen ID | optional box in `create-account.htm` (opens with `?benefit=student` / `?benefit=esm`), `account.htm#id-verification`, notices on `book-appoinment.htm`, links on `students.htm` / `military-families.htm` (`js/spouzy-verify.js`, loaded by `js/spouzy-content.js`) | `POST/GET /api/customer/verification`; benefit in `GET /api/scheduling/config` | `IdVerification`, private `MediaAsset` | Student & Ex-servicemen IDs (`verifications:view/edit`) |
| Website chat | every page, floating chat button (`js/spouzy-chat.js`, loaded by `js/spouzy-content.js`) | `POST /api/customer/chat/start`, `/message`, `/end`; login/sign-up inside the chat via `/api/auth/customer/*` | `ChatConversation`, `ChatMessage`, `Enquiry` (call-back requests), `CustomerActivity` | Website Chat (`enquiries:view`; teaching answers `moderation:edit`), Settings → Website chat |

Packages: anyone can see them; adding to the cart needs a customer account. The free package can be claimed once per
account at any time. Paid packages stay in the cart until the payment driver is switched on; then checkout opens Razorpay.

Booking needs an account (Admin → Settings can switch this off): visitors pick a service, date and time first; **Confirm
Appointment** opens a popup that checks the email/mobile — existing account → log in, new → create account — then books
straight away with the account's name, email and mobile (locked on the form). Bookings appear in My Account → My appointments.
While customers are logged in, the pages they open and buttons they press are recorded (plus the steps taken just before
logging in on that visit) and shown in Admin → Packages & Orders → Customers → Activity. Records are kept 180 days.

Chat: the assistant needs a customer login (log in or create the account inside the chat, including agreeing to the
Terms; the visitor is then logged in on the website too). It answers prices, what each package includes, booking,
timings, clinics, email, phone/WhatsApp, refunds, privacy, online sessions, careers and joining, with page links.
No reply for 30 seconds (Settings) ends the chat with a thank-you. Unanswered questions appear in Admin → Website Chat.

Booking rules: free consultations from two calendar months ahead; paid from today. Students and ex-servicemen /
defence with an ID approved by the admin: free consultations from today (students until the valid-until date of their ID;
ex-servicemen without expiry, with a yearly reminder for the team). Every logged-in customer can have one consultation
booked at a time; the next one after it has taken place. Counselling services use
counsellors, the intimacy clinic doctors, mediation mediators; "Any specialist" picks a free one.
Paid bookings: driver on → 15-minute hold until paid; driver off → reserved with payment pending and the
"coming soon" message.

## 2. Content managed in the admin

| Website element | Loaded by `js/spouzy-content.js` from | Admin screen |
|---|---|---|
| Homepage hero slides (images, text, pills, buttons; any number of slides) | `/api/content/hero-banners` | Website Content → Hero Banners (photo upload) |
| Homepage block titles (services, testimonials, questions) | `/api/content/homepage-sections` | Website Content → Homepage Titles |
| Relationship tips (homepage) | `/api/content/tips` (`js/banner-tips.js`) | Website Content → Relationship Tips |
| Blog: sliding banner of 16:9 article banners, 16:9 thumbnail cards, article page with banner (`blog.htm`, `blog.htm?article=slug`, `js/spouzy-blog.js`) | `/api/content/blogs` (`banner_image`, `thumbnail_image`, `show_in_banner`, `cover_image`) | Website Content → Blog → Pictures |
| FAQ page by topic: topics → questions → answer popup, one at a time, no select/copy (`faq.htm`, `js/spouzy-faqs.js`; `js/spouzy-guard.js` on every page blocks right-click and the developer-tools shortcuts), homepage questions (`index.htm` `[data-faq-list="home"]`), FAQ box on the 7 What We Do pages (`[data-faq-page]`) | `/api/content/faqs` (questions), `/api/content/faqs/:id` (one answer), `?for=home`, `?for=<page>` | Website Content → FAQs (Excel upload/download, Homepage questions) |
| Approved stories: homepage carousel (`index.htm` `[data-live-stories]`) and `testimonials-policy.htm` | `/api/content/stories`, `?home=1` | Website Content → Client Stories |
| Job cards and role dropdown on `careers.htm` | `/api/careers/openings` | Careers Desk → Openings |
| Announcement bar, phone, WhatsApp, email, cursor on all pages | `/api/content/settings` | Settings → Website Contact & Display |
| Footer social links | `/api/content/social-links` | Website Content → Social Links |
| Services, prices, practitioners, working hours, blocked time | `/api/scheduling/*` | Appointments → Services & Prices / Practitioners & Hours / Blocked Time |

If the API is unreachable, every page keeps its built-in text, so the site never shows empty sections.

## 3. Privacy boundaries

- Student / ex-servicemen ID proofs are private files too; only `verifications:view` (administrators) can open them.
- Certificates, photos and resumes are stored in `backend/storage/uploads/private/` and downloaded only through
  `GET /api/media/private/:id` by staff with the matching permission.
- Admin-uploaded website images go to `backend/storage/uploads/public/` and are served at `/media/public/…`.
  The public library accepts only JPG, PNG and WebP.
- Visitor emails and phone numbers on questions and stories are never returned by public APIs.
- Duplicate protection: the same enquiry within 10 minutes, application within 15 minutes, returns the first reference.
