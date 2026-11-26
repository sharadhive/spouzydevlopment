# Prompt for Antigravity: apply the SPOUZY update and verify it

Copy everything below the line into Antigravity.

---

You are working in the SPOUZY project at `D:\DOWNLOADS\spouzynew25` (Windows, npm workspaces: `backend/`, `admin/`, `website/`).
The source code has already been updated and tested. Your job is ONLY to run the update commands and check the results.

## Strict rules
- Do NOT edit, rewrite, "fix" or reformat any source file (`backend/`, `admin/src/`, `website/`, `docs/`).
- Do NOT run `git commit`, `git checkout`, `git reset`, `git stash`, `git clean` or `npm audit fix`.
- Do NOT delete anything in `scratch/` (it holds the backups `scratch/claude-backup-2026-11-19*/`).
- Do NOT print the contents of `backend/.env` (it has passwords). You may only check that the DB_* keys exist.
- Do NOT run `npm install` (no dependencies changed).
- If any command fails, STOP, and report the exact command and the full error text. Do not try to fix code.
- Do NOT run the scripts in `backend/tests/` directly (`node tests/...`). The only test command is `npm test`.
  (An old test script run against the real database is what created the broken "Rebuilding Marital Connection" slides.)
- Do NOT add or change navbar, loader, cursor, chat, offers, bills, notification, FAQ or story features: they are already built.
- Do NOT create test offers, bills, payments, FAQs or stories in the real database, and do not upload Excel files.

## Step 1: Stop the running servers (important: an old server keeps serving old code)
Stop only the SPOUZY processes, not every Node process (Antigravity itself uses Node).
1. If a terminal is running `npm run dev` or `npm run dev:admin`, stop it with Ctrl+C.
2. Then check that ports 5000 and 5173 are free (PowerShell):
   `netstat -ano | findstr ":5000 :5173" | findstr LISTENING`
   If a line is still listed, stop only that PID: `taskkill /PID <pid> /F`
   (or run: `Get-NetTCPConnection -LocalPort 5000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`)

## Step 2: Check the database is reachable
- Make sure the local MySQL server is running (Windows Services → MySQL80, or XAMPP/WAMP MySQL).
- Confirm `backend/.env` contains `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` (do not show the values).

## Step 3: Run the update commands from the project root, one at a time
Run in `D:\DOWNLOADS\spouzynew25`:

1. `npm run db:migrate`
   Expected: it applies any of these that have not run yet and finishes without errors:
   `20261118000003-fix-forms-and-permissions.js`, `20261119000004-customer-packages-and-orders.js`,
   `20261119000005-account-booking-and-activity.js` (links bookings to accounts, adds the activity log),
   `20261119000006-chat-assistant.js` (adds the website chat tables and the settings `chat_enabled`, `chat_idle_seconds`),
   `20261120000007-offers.js` (adds the offers table and offer permissions),
   `20261120000008-bills-and-notifications.js` (adds bills, saved bill details and admin notifications).
   `20261121000009-stories-and-faq-pages.js` (client stories from customer accounts; FAQ places: FAQ page, homepage,
   What We Do pages; copies the questions written in index.htm/faq.htm into the admin and the 3 old homepage stories as HIDDEN).
   `20261121000010-blog-banner-and-thumbnail.js` (blog article Banner 16:9, Thumbnail 16:9 and "show in sliding banner").
   `20261121000011-id-verification.js` (student / ex-servicemen ID proofs: adds the `id_verifications` table).
   "No pending migrations" is also fine.
2. `npm run db:seed`
   Expected: prints ` - Example customer packages seeded.` and ends with `Finished executing 1 seeder(s).`
   It only adds missing content and never overwrites edits.
3. `npm run content:check`
   It lists images that do not exist and test records left by old test scripts. It changes nothing.
   Copy its full output into your report.
4. `npm run content:clean-test-data`
   Removes ONLY the test records listed by step 3 (the "Rebuilding Marital Connection" slides with the
   missing image `/image/banner1.jpg` and the test tip with `/image/tips/tip1.jpg`). Nothing else is changed.
5. `npm run content:check` again.
   Expected last line: `Result: all content images are OK.`
   If it still lists "Missing images in your own content", do NOT delete anything: report the list to me.
6. `npm run build:admin`
   Expected: Vite prints `✓ built in ...` and creates `admin/dist/index.html` and `admin/dist/assets/`.
7. `npm run dev`
   Start it in a separate/background terminal and keep it running.
   Expected: `[Database] Connected successfully.` and the server on port 5000.

## Step 4: Verify (PowerShell; use `curl.exe`, not `curl`)
Wait about 5 seconds after the server starts, then run each and report the result:

1. `curl.exe -s http://localhost:5000/api/health`
   Expect `"status":"ok"`.
2. `curl.exe -s http://localhost:5000/api/scheduling/config`
   Expect `"payment":{"enabled":false,...coming soon...}` (until Razorpay keys are added in the admin),
   `free.earliestDate` about two months after today, and `paid.earliestDate` = today.
3. `curl.exe -s http://localhost:5000/api/content/hero-banners`
   Expect 4 banners with headlines "Space to Talk.", "Sensitive Questions.", "A Difficult Decision.", "Strong Foundations."
   (banners already edited in the admin keep their own text; that is also a PASS).
4. `curl.exe -s http://localhost:5000/api/content/homepage-sections`
   Expect 3 sections: services, testimonials, questions.
5. `curl.exe -s -o NUL -w "%{http_code}" http://localhost:5000/admin/`
   Expect `200`.
6. `curl.exe -s http://localhost:5000/api/packages`
   Expect 4 packages: Free First Consultation (price_inr 0), Single Session (1999), Couple Care Plan (5499),
   Complete Care Program (9999), and `"payment":{"enabled":false,...}`.
7. Open in the browser and confirm each page loads without console errors:
   http://localhost:5000/packages.htm, /create-account.htm, /register.htm, /cart.htm, /account.htm
   (account.htm sends you to the login page when you are not logged in; that is correct).
8. `curl.exe -s http://localhost:5000/api/content/settings`
   Expect `"booking_requires_account":"true"`, `"chat_enabled":"true"` and `"chat_idle_seconds":"30"` in the data.
9. `curl.exe -s -X POST http://localhost:5000/api/auth/customer/check -H "Content-Type: application/json" -d "{\"email\":\"nobody@example.com\"}"`
   Expect `"exists":false`.
10. `curl.exe -s "http://localhost:5000/api/scheduling/availability?date=<today YYYY-MM-DD>&duration=30&serviceSlug=couples-therapy&bookingType=paid"`
   Expect a `slots` list with `available` / `passed` statuses.
11. `curl.exe -s -o NUL -w "%{http_code}" http://localhost:5000/js/spouzy-chat.js`
   Expect `200`.
12. `curl.exe -s -o NUL -w "%{http_code}" -X POST http://localhost:5000/api/customer/chat/start`
   Expect `401` or `403` (the chat needs a customer login; that is correct).
13. Open http://localhost:5000/admin → Content & Media → Hero Banners and Relationship Tips.
   Expect no broken-image icons. An item whose photo file is missing shows a red "Image missing" box.
14. Open http://localhost:5000/index.htm?intro=1 in a private window: the hugging-teddy welcome plays (about 2.5 s),
   then the teddies fly into the navbar logo; every 3 s the logo and teddies swap.
15. In the browser open http://localhost:5000/index.htm, click the round chat button at the bottom right.
   Expect a chat window "SPOUZY Assistant" asking to log in or create an account, with Log in / Create account buttons.
   (Do not create test accounts unless I ask.)
16. Open http://localhost:5000/admin (Dashboard). Expect an "Analytics" section with 7 / 30 / 90 days buttons and
   animated charts, a "How this works" box at the top of every admin page, and "Admin Guide" at the bottom of the left menu.
17. Content & Media → Hero Banners → Add Banner: the image box shows "Best 1920 × 1080 px…". Do not save a test banner.
18. `curl.exe -s http://localhost:5000/api/offers`
   Expect `{"success":true,"data":{"offers":[]}}` (no offer uploaded yet, so the website shows no offer popup).
19. Open http://localhost:5000/index.htm and scroll to "Specialized Care for Life's Most Sensitive Decisions":
   the cards now show the packages with prices (same card design) and a "Compare all packages" button below.
20. Admin → "Packages, Bills & Orders": tabs Orders, Packages & Prices, Bills, Offers, Customers. Offers → Add Offer opens a form
   with "Offer card image · Best 1080 × 1350 px" and a popup preview on the right. Close it without saving.
21. Admin header: a bell icon is shown left of your name; the left menu has "Notifications". Both open without errors.
22. `curl.exe -s -o NUL -w "%{http_code}" "http://localhost:5000/invoice.htm"` → `200`, and
   `curl.exe -s -o NUL -w "%{http_code}" http://localhost:5000/api/customer/invoices` → `401` (needs a customer login; correct).
23. `curl.exe -s "http://localhost:5000/api/content/faqs?for=home"` → the homepage questions (about 4).
   `curl.exe -s http://localhost:5000/api/content/faqs` → the FAQ page questions.
24. `curl.exe -s "http://localhost:5000/api/content/stories?home=1"` → `"data":[]` until a story is approved or shown in the admin
   (the 3 old homepage stories are in the admin as Hidden). Names in this list are always masked like `R***t & P***a S.`.
25. Open http://localhost:5000/index.htm: the stories carousel shows a "Share your story" card (and approved stories, if any).
   Open http://localhost:5000/faq.htm: a search box and topic buttons above the questions. Do not submit anything.
26. Admin → Content & Media → FAQs: three tabs "FAQ page & service pages", "Homepage questions", "Visitor questions";
   "Upload Excel", "Sample file" and "Download all" buttons. Do NOT upload any file.
27. Admin → Content & Media → Client Stories: tabs Waiting for approval / Live on website / Hidden / Not approved / All;
   the 3 old homepage stories are under Hidden. Do not approve, delete or add stories.
28. Open http://localhost:5000/blog.htm: every article shows as a card with a picture (or a coloured card with its first letter
   when it has no picture yet). The sliding banner at the top appears only after articles have a 16:9 Banner in the admin.
   Admin → Content & Media → Blog → Edit: a "Pictures" box with Banner (16:9), Thumbnail (16:9), "Show this article in the
   sliding banner" and the picture inside the article. Do not upload or save anything.
29. Admin left menu: "Student & Ex-servicemen IDs" opens a page with tabs Waiting for review / Approved / Expired / Rejected /
   Yearly reminders / All (empty lists are fine). The Dashboard shows a card "Student / ex-servicemen IDs to check".
30. Open http://localhost:5000/create-account.htm: above the Terms checkbox there is a box "Student or ex-serviceman / defence?".
   Click it: choices Neither / Student / Ex-serviceman / Defence; Student shows college name, ID number, ID upload (front, back)
   and "ID valid until"; Ex-serviceman shows Service, ID number and the uploads (no date). Do not create an account.
31. `curl.exe -s "http://localhost:5000/api/scheduling/config"` → still contains `"minMonthsAhead":2` and `"account":null`
   (when not logged in). Open http://localhost:5000/book-appoinment.htm and choose Free Consultation: a note "Student or
   ex-serviceman / defence? Create your account with your ID…" appears under the two buttons.

## Step 5: Optional automated tests
Run `npm test` only if the MySQL user can create databases (it uses a separate `spouzy_test` database and does not touch
your real data). Expected last line: `ALL TESTS PASSED WITH 100% SUCCESS.`
If it fails because the user cannot create a database, report that and skip it.

## Step 6: Admin account
Open http://localhost:5000/admin and sign in with the existing admin account.
If no admin account exists yet, do NOT invent a password. Tell me, and I will run `npm run admin:create` myself.
After signing in, confirm the left menu shows "Website Chat" and that page opens (Conversations / Questions to answer tabs),
and that "Packages, Bills & Orders" → Bills opens ("No bills yet" is correct until the first payment).

## Step 7: Report back
Give me a short table: each command / check, PASS or FAIL, and for any FAIL the exact error text.
Do not change any files while reporting.
