/**
 * Help text for every admin page and tab.
 * Shown in the "How this works" box at the top of each page and on the Admin Guide page.
 * Keep it short and practical: what it is for, how to do the common jobs, what to watch out for.
 */
export const GUIDES = {
  dashboard: {
    title: 'Dashboard',
    what: 'A live overview of the business: bookings, enquiries, sales, customers, chats and applications, with charts for the period you choose.',
    steps: [
      'Pick 7, 30 or 90 days at the top to change every chart.',
      'Click a number card to open that list (for example, new enquiries).',
      'Hover over a chart to see exact values for a day or a slice.'
    ],
    tips: [
      'You only see the numbers your role is allowed to see.',
      'Numbers update every time the page is opened; press Refresh to update without leaving.'
    ]
  },
  contentHub: {
    title: 'Content Hub',
    what: 'A summary of the website content: banners, tips, blog articles, FAQs and visitor questions waiting for an answer.',
    steps: ['Use the shortcuts to jump to the item you want to edit in Content & Media.'],
    tips: []
  },
  'content.banners': {
    title: 'Hero Banners',
    what: 'The large slides at the top of the homepage. Only slides that are Live and Published appear, in the order shown.',
    steps: [
      'Click "Add Banner", fill in the headline, second line, description and button text and link.',
      'Upload a desktop image (1920 × 1080 px) and, if you like, a separate phone image (1080 × 1620 px).',
      'Set the Order number (lower shows first), set Status to Published and tick Active, then Save.',
      'Use Show/Hide to take a slide off the website without deleting it, and Copy to start a new slide from an existing one.'
    ],
    tips: [
      'Keep faces in the upper half of the photo and towards the right: the text covers the left side.',
      'A red "Image missing" box means the photo file is gone; upload it again.',
      'Changes appear on the website straight away; refresh the homepage to check.'
    ],
    where: 'index.htm (homepage slider)'
  },
  'content.sections': {
    title: 'Homepage Titles',
    what: 'The headings and short introductions of the homepage blocks (services, testimonials, questions).',
    steps: ['Edit the title or subtitle of a block and Save.', 'Switch a block off to hide it from the homepage.'],
    tips: ['Keep titles short: one line on a phone is about 30 characters.'],
    where: 'index.htm'
  },
  'content.tips': {
    title: 'Relationship Tips',
    what: 'The rotating "Daily Tip For You" card next to the homepage slider. Each tip has a short sentence and a portrait photo.',
    steps: [
      'Click "Add Tip", write one short sentence (under 60 characters reads best) and upload a portrait photo (800 × 1200 px).',
      'Set the order and "Seconds on screen", and tick Active. Inactive tips are kept but not shown.'
    ],
    tips: ['If a tip photo is missing, the website shows one of the built-in photos instead.'],
    where: 'index.htm (Daily Tip card)'
  },
  'content.blogs': {
    title: 'Blog',
    what: 'Articles on the website blog: a sliding banner at the top of the Blog page, picture cards for every article, and an article page with its banner. Drafts stay private until you publish them.',
    steps: [
      'Click "New Article", add a title, a short summary (shown in the list) and the article body.',
      'Choose a category (or type a new one), then add the pictures: a Banner 16:9 (1600 × 900 px) for the top of the article and the sliding banner, and a Thumbnail 16:9 (1280 × 720 px) for the card on the Blog list. The picture inside the article is optional, as before.',
      'Tick "Show this article in the sliding banner" to include it in the moving banner at the top of the Blog page.',
      'Leave "Published" off to save a draft; switch it on to publish. The publish date is set the first time.'
    ],
    tips: [
      'Start each article with a two- or three-sentence direct answer: search engines and AI assistants quote that part.',
      'Do not promise results ("guaranteed", "100%", "best"): these are not allowed for doctors under NMC rules.'
    ],
    where: 'blog.htm'
  },
  'content.faqs': {
    title: 'FAQs',
    what: 'All questions and answers: the FAQ page (with search and filters), the homepage questions, and the FAQ box on each "What We Do" page. Also the questions visitors send.',
    steps: [
      'Many questions: click "Sample file", fill one question per row in Excel (Category, Question, Answer, and Yes/No for each page), then "Upload Excel". Check the preview and click Import.',
      'One question: "Add question", write the answer, tick where it should show (FAQ page, Homepage questions, and any What We Do pages).',
      'To change many at once: tick them in the list, then Show / Hide / Add to page / Remove from page / Set category / Delete.',
      'Homepage questions tab: the short list on the homepage. Use the arrows to set the order.',
      'Visitor questions tab: answer questions sent from the FAQ page and add the good ones to the FAQ page.'
    ],
    tips: [
      '"Download all" gives you an Excel copy. Edit it and upload it again: rows keep their ID, so questions are updated, not doubled.',
      'In answers: empty line = new paragraph, "- " = bullet point, **bold**, [link text](page.htm).',
      'Rows with a problem are listed by Excel row number and skipped; the rest are imported.',
      'The chat assistant learns new answers immediately.'
    ],
    where: 'faq.htm, index.htm (homepage questions) and the What We Do pages'
  },
  'content.stories': {
    title: 'Client Stories',
    what: 'Stories shown on the homepage and on the Reviews & Testimonials page. Customers share them from their account (login needed); nothing appears until you approve it.',
    steps: [
      'A new story arrives in "Waiting for approval" and in your notifications. Read it, edit it if needed, then "Approve & publish".',
      'Live stories can be hidden, shown again, edited, deleted, or taken off the homepage. Use the arrows to set the homepage order.',
      '"Add story" adds one yourself (for example from a written feedback form with consent).'
    ],
    tips: [
      'The website never shows the real name: "Rohit & Priya S." appears as "R***t & P***a S.", or "Anonymous". Email, phone and account stay private.',
      '"Used SPOUZY care" is ticked automatically when the account has a completed or paid appointment or package.',
      'NMC rules (October 2026) do not allow patient testimonials promoting doctors. Keep approved stories general and never about a named doctor or medical result.'
    ],
    where: 'index.htm and testimonials-policy.htm'
  },
  'content.media': {
    title: 'Media Library',
    what: 'All public images uploaded for the website. Upload once, then copy the path into a banner, tip or article.',
    steps: [
      'Click "Choose images" (you can pick several). Large photos are shrunk and converted to WebP automatically.',
      'Click "Copy path" on an image and paste it into an image field anywhere in the admin.'
    ],
    tips: [
      'Never upload private documents here: everything in this library is public.',
      'Open "Image sizes for each spot on the website" to see the best size for each place.'
    ]
  },
  'content.social': {
    title: 'Social Links',
    what: 'The Facebook, Instagram, LinkedIn and X buttons in the website footer.',
    steps: ['Paste the full address of each profile (for example https://www.instagram.com/yourpage) and Save.', 'Leave a field empty to hide that button.'],
    tips: ['Only the official sites are accepted, and share links (like "tweet this") are refused.'],
    where: 'Footer on every page'
  },
  enquiries: {
    title: 'Enquiries CRM',
    what: 'Every message sent from the contact form, the call-back widget and the chat call-back requests.',
    steps: [
      'Open an enquiry to see the details and add notes after you call or reply.',
      'Move it through the statuses: New → Contacted → In Progress → Resolved or Closed.',
      'Search by reference, name, email or phone, filter by status or source, and export to CSV (if your role allows it).'
    ],
    tips: ['Reply to new enquiries the same working day; the dashboard shows how many are waiting.']
  },
  clinical: {
    title: 'Clinical Staff applications',
    what: 'Applications from doctors and counsellors who want to join, with their certificates and photo.',
    steps: [
      'Switch between the Doctors and Counsellors tabs.',
      'Open an application to read it and download documents (only roles with document access can download).',
      'Update the status: Submitted → Under Review → Interview Scheduled → Approved or Rejected, and add notes.'
    ],
    tips: ['Documents are private: they are never on the public website and every download is logged.']
  },
  careers: {
    title: 'Careers Desk',
    what: 'Job openings shown on the careers page and the applications people send.',
    steps: [
      'Openings tab: add a role with job title, department, employment type, location and a short summary; switch it off when filled.',
      'Applications tab: open an application, download the resume and update the status with notes.'
    ],
    tips: [],
    where: 'careers.htm'
  },
  appointments: {
    title: 'Appointments',
    what: 'All bookings from the website, with the tools to manage the calendar.',
    steps: [
      'Use the filters (date, status, free or paid, payment) to find bookings; click View for details.',
      'In the booking details, change the status (Confirmed, Completed, Cancelled or No-show) and add a note. Reschedule moves it to a free slot.'
    ],
    tips: [
      'Awaiting Payment means a paid slot is held for 15 minutes while the customer pays; it is released automatically if they do not.',
      'While online payment is switched off, paid bookings are reserved with Payment Pending.'
    ]
  },
  'appointments.blocks': {
    title: 'Blocked Time',
    what: 'Holidays, leave and breaks. Blocked time can never be booked.',
    steps: ['Add a block for one practitioner or everyone, with a start and end time and a reason.'],
    tips: ['Existing bookings inside a new block are not cancelled automatically; reschedule them first.']
  },
  'appointments.practitioners': {
    title: 'Practitioners & Hours',
    what: 'The doctors, counsellors and mediators customers can book, and their weekly working hours.',
    steps: [
      'Add a practitioner with name, title, type, qualifications and a square photo (800 × 800 px).',
      'Set working hours for each day, or mark a day off. Switch a practitioner off to stop new bookings.'
    ],
    tips: ['Show each doctor\'s registration number in their profile: Indian telemedicine rules require it for online consultations.']
  },
  'appointments.services': {
    title: 'Services & Prices',
    what: 'The services customers can book and their session prices. These prices also appear in the chat assistant\'s answers.',
    steps: ['Edit a service to change its name, description, consultation modes and the price for 30-minute and 60-minute sessions, then Save.'],
    tips: ['Prices are in rupees. A change applies to new bookings only.']
  },
  verifications: {
    title: 'Student & Ex-servicemen IDs',
    what: 'ID proofs uploaded by students and ex-servicemen / defence personnel. An approved ID lets them book the free consultation from today instead of waiting 2 months.',
    steps: [
      'Waiting for review: click Review, open the front (and back) of the ID, and check that the name matches the account and the ID is genuine.',
      'Students: check the valid-until date on the card and correct it if the customer typed it wrong, then Approve. The benefit ends on that date by itself.',
      'Ex-servicemen / defence: there is no expiry. Approve once the ESM / service ID is clear.',
      'If something is wrong, click Reject, pick a ready-made reason (or write your own) saying what to upload instead. The customer sees it on their account and booking page and can upload again.',
      'Yearly reminders: ex-servicemen who are due for their yearly check-in appear here (and in the notification bell). Send a WhatsApp reminder, then click "Mark yearly reminder done".'
    ],
    tips: [
      'Only the admin can open the ID files; they are stored privately and never shown on the website.',
      'Everyone (free, paid, student and ex-servicemen) can have only one consultation booked at a time. The next one can be booked after the first has taken place.',
      'When a student ID expires the customer sees the normal options again: the paid consultation, or the free one from 2 months ahead, until a new ID is approved.',
      'Approved by mistake? Open it and use "Withdraw benefit" with a message.'
    ]
  },
  chats: {
    title: 'Website Chat',
    what: 'Conversations customers had with the automatic chat assistant, and the questions it could not answer.',
    steps: [
      'Conversations tab: click View to read a chat. Use "Follow up on WhatsApp" to continue with the customer.',
      'Questions to answer tab: click "Add an answer" to write an FAQ; the assistant uses it immediately.'
    ],
    tips: ['Chat on/off and how long it waits before closing are in Settings.']
  },
  'shop.orders': {
    title: 'Orders',
    what: 'Package orders customers placed on the website.',
    steps: [
      'Open an order to see the customer, items and payment.',
      'Record payment received for offline payments, Mark completed when the package is used, or Cancel / Mark refunded.'
    ],
    tips: [
      'When online payment is on, paid orders are confirmed automatically by Razorpay, and their bill is made at once (see the Bill column).',
      'Record payment received also makes the bill. For an older paid order without a bill, press Create bill.'
    ]
  },
  'shop.packages': {
    title: 'Packages & Prices',
    what: 'The packages shown on the Packages page: name, price, what is included and which services they cover.',
    steps: [
      'Edit a package to change its price, old price (shown crossed out), sessions, validity and the list of what is included.',
      'Switch a package off to hide it. Only admins can change packages.'
    ],
    tips: [
      'Write what is included as short, factual lines; avoid promises about results.',
      'The homepage "Packages" section shows the first six packages that are switched on, in the order you set here.',
      'A package with a live offer shows an "Offer" note in the price column.'
    ],
    where: 'packages.htm and the Packages section on the homepage'
  },
  'shop.bills': {
    title: 'Bills',
    what: 'A bill is made automatically for every payment (online, or recorded by staff). You check its details and send it; the customer then sees it under My bills in their account, with the SPOUZY logo, ready to print or save as PDF.',
    steps: [
      'When a payment comes in, the bell at the top shows "Payment received". Press Send bill (or open Bills and press Prepare & send).',
      'Bill from: choose your saved business details in the dropdown, or pick "+ Enter new details" and type the business name, address, GSTIN and GST rate. New details are saved and appear in the dropdown next time.',
      'Bill to: the customer\'s name, email and phone come from their account. Choose "+ Add billing address / GSTIN" when they want a company name, address or GSTIN on the bill; it is saved for their next bill.',
      'Check the bill on the right (or press View bill), then press Save & send to customer.'
    ],
    tips: [
      'Bill numbers run per financial year (April to March): SPZ/2026-27/0001, 0002 and so on. They are given when the payment arrives, so there are no gaps.',
      'Prices already include GST. With a GSTIN and a GST rate, the bill shows the GST inside the amount: CGST + SGST, or IGST when the customer\'s GSTIN is from another state. Without a GSTIN the bill shows no GST. Ask your accountant which rate applies to your services.',
      'Mark one saved "Bill from" as the default (★); new bills start with it. Removing saved details never changes bills already made.',
      'A sent bill cannot be changed. Check the details before sending.',
      'Customers who booked without an account cannot see bills in an account: open the bill and print or save it as PDF to share it.'
    ],
    where: 'My Account → My bills, and the bill page (invoice.htm)'
  },
  notifications: {
    title: 'Notifications',
    what: 'Everything that happens, newest first: payments, bills, orders, free package claims, new customer accounts, bookings, enquiries, call-back requests, doctor and job applications, visitor questions and stories. You see only the kinds your role allows.',
    steps: [
      'The bell at the top shows how many are unread. Click it to see the newest; click one to open the right page.',
      'Payments have a Send bill button that opens the bill, ready to check and send.',
      'Open Notifications in the menu for the full list. Filter by type or show unread only. Mark all as read when you have seen everything.'
    ],
    tips: [
      'While the admin is open, a small note pops up at the bottom right when something new arrives (it checks every 25 seconds).',
      'Read or unread is kept for each staff member separately.'
    ]
  },
  'shop.offers': {
    title: 'Offers',
    what: 'Offer cards you upload. While an offer is live, the website shows it in a popup and on the package it belongs to. With no live offer there is no popup.',
    steps: [
      'Press Add Offer. Give it a title, a badge such as "20% OFF" and one short line of text.',
      'Upload the offer card image: best 1080 × 1350 px (4:5 portrait) or 1080 × 1080 px (square). The whole image is shown; nothing is cut off.',
      'Optional: choose the package the offer is for. Admins can also enter an offer price; customers then pay that price in the cart and the normal price shows crossed out.',
      'Without a package, enter the page the button should open (for example pre-marriage.htm).',
      'Set the first and last day. The offer starts and ends by itself at midnight India time.',
      'Check the preview on the right, then Save. Use Turn off to pause an offer without deleting it.'
    ],
    tips: [
      'The popup opens a few seconds after a page loads, once per visit. Closing it keeps it closed; visitors can reopen it from the small "Offers" tab at the bottom left.',
      'The popup does not open by itself on the Packages, cart, login, account or booking pages, so it never gets in the way of a purchase (the Packages page shows offers on the cards).',
      'Several live offers show as slides in one popup, in the order you set.',
      'Put the offer words inside the image in large letters and keep about 60 px free at the edges, so they stay readable on phones.',
      'Only admins can set or change an offer price. Content editors can add offers that show on a card at the normal price.',
      'Avoid promises such as "guaranteed results" or "100% cure" in offer images.'
    ],
    where: 'Popup on every page except Packages, cart, login, account and booking; the linked package card on the homepage and packages.htm'
  },
  'shop.customers': {
    title: 'Customers',
    what: 'Customer accounts, who was active today, and each customer\'s activity trail.',
    steps: [
      'Search by name, email or phone. Click Activity to see the pages they opened, buttons they pressed and bookings.',
      'Edit fixes contact details; Reset password sets a new password (send it to them privately) and logs them out everywhere.'
    ],
    tips: ['Activity is kept for 180 days. It never includes what customers type into forms.']
  },
  settings: {
    title: 'Website settings',
    what: 'Contact details, announcement bar, booking rules and chat options used across the whole website.',
    steps: [
      'Phone, WhatsApp and support email: change them here and every page, the chat and the footer update.',
      'Booking needs an account: when on, customers log in or create an account when they confirm a booking.',
      'Website chat assistant: switch it on or off and choose after how many seconds without a reply it closes.'
    ],
    tips: ['Write phone numbers with the country code, for example +91 85919 45055.']
  },
  'settings.gateway': {
    title: 'Payment Driver (Razorpay)',
    what: 'Switches online payments on or off and stores the Razorpay keys.',
    steps: [
      'Start in Test mode with rzp_test_ keys and make a test booking.',
      'Tick "Driver active", paste the Key ID and Key Secret, and the Webhook secret you set in Razorpay, then Save.',
      'In Razorpay add the webhook https://yourdomain.com/api/payments/webhook with the events payment.captured and order.paid.',
      'When Razorpay approves your live account, switch to Live mode with the rzp_live_ keys.'
    ],
    tips: ['While the driver is off, the website shows "Online payment integration is coming soon" and paid items wait in the cart.']
  },
  users: {
    title: 'Staff accounts',
    what: 'Logins for your team. Each person gets a role that decides what they can see and do.',
    steps: [
      'Create User: name, email, role and a temporary password; ask them to change it after the first login.',
      'Edit a user to change their role, set a new password, or untick Active when someone leaves.'
    ],
    tips: ['Give each person the smallest role that lets them do their job. Never share one login between people.']
  },
  'users.roles': {
    title: 'Roles & Permissions',
    what: 'What each role is allowed to see and change.',
    steps: ['Pick a role, tick or untick permissions, and Save permissions.'],
    tips: ['The Administrator role always has every permission.']
  },
  'users.audit': {
    title: 'Audit Trail',
    what: 'A record of important actions: logins, changes, document downloads and settings changes.',
    steps: ['Browse the list, newest first, to see who did what and when.'],
    tips: []
  }
};

/** Everyday tasks, answered in one place (Admin Guide page) */
export const COMMON_TASKS = [
  { q: 'Change a session price', a: 'Appointments → Services & Prices → Edit the service → change the price → Save. The website and the chat use the new price at once.' },
  { q: 'Change a package price or what it includes', a: 'Packages, Bills & Orders → Packages & Prices → Edit → Save. Only admins can do this.' },
  { q: 'Send a bill to a customer', a: 'Click the bell → Send bill on the payment (or Packages, Bills & Orders → Bills → Prepare & send). Pick or type the "Bill from" and customer details, check the bill, then Save & send to customer. It appears in their account under My bills.' },
  { q: 'Add your GST number to bills', a: 'Open any bill that is ready to send → Bill from → "+ Enter new details" (or Edit these saved details) → add the GSTIN and choose the GST rate → tick "Use as the default" → Save details. Later bills start with it.' },
  { q: 'Run an offer with a popup', a: 'Packages, Bills & Orders → Offers → Add Offer. Upload a 1080 × 1350 px offer card, choose the package and offer price if any, set the first and last day, Save. The popup appears on the website on the first day and stops by itself after the last day.' },
  { q: 'Stop the offer popup', a: 'Packages, Bills & Orders → Offers → Turn off (or set a last day). With no live offer the website shows no popup.' },
  { q: 'Add a new homepage slide', a: 'Content & Media → Hero Banners → Add Banner. Upload a 1920 × 1080 px photo, tick Live, choose Published, Save.' },
  { q: 'Change the phone, WhatsApp number or email', a: 'Settings & Gateway → Website Contact & Display → edit → Save. All pages update automatically.' },
  { q: 'Publish a blog article', a: 'Content & Media → Blog → New Article (or Edit a draft) → switch Published on → Save.' },
  { q: 'Teach the chat assistant a new answer', a: 'Website Chat → Questions to answer → Add an answer. Or add a published FAQ in Content & Media → FAQs.' },
  { q: 'Add 400 FAQs from Excel', a: 'Content & Media → FAQs → Sample file. Fill one question per row (Category, Question, Answer; Yes in the page columns where it should also show), save as .xlsx, then Upload Excel → check the preview → Import.' },
  { q: 'Show an FAQ on a service page (for example Pre-Marriage)', a: 'Content & Media → FAQs → Edit the question → tick the page under "What We Do pages" → Save. For many at once: tick them in the list → choose the page → Add to page.' },
  { q: 'Change the questions on the homepage', a: 'Content & Media → FAQs → Homepage questions. Add, edit, hide or reorder them with the arrows.' },
  { q: 'Approve a customer story', a: 'Click the bell (or Content & Media → Client Stories → Waiting for approval) → read it, Edit if needed → Approve & publish. The website shows only the first and last letters of the name.' },
  { q: 'Block a holiday or leave', a: 'Appointments → Blocked Time → add the dates for one practitioner or everyone.' },
  { q: 'Turn on online payments', a: 'Settings & Gateway → Payment Driver. Follow the steps in the help box there; test with Test keys first.' },
  { q: 'Give a new team member access', a: 'Staff & Audit Logs → Staff Accounts → Create User, choose their role, share the temporary password privately.' },
  { q: 'See what a customer did on the website', a: 'Packages, Bills & Orders → Customers → Activity on their row.' },
  { q: 'Check that no image is broken', a: 'On the server run npm run content:check. In the admin, a red "Image missing" box marks any broken image.' }
];

/** Rules every editor should know */
export const SAFETY_RULES = [
  'Do not write "guaranteed", "100% success", "best", "No. 1" or "first and only" about doctors or treatments: the NMC guidelines of October 2026 forbid them.',
  'Do not publish patient testimonials, before-and-after pictures or reviews you paid for.',
  'Never name medicines or remedies for sexual performance on the website (Drugs and Magic Remedies Act).',
  'Only public pictures go in the Media Library. Certificates, resumes and personal documents stay in the private application areas.',
  'Never share your password. If someone leaves, switch their account off the same day.'
];
