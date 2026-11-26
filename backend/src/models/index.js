const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// ============================================================================
// 1. AUTH & USERS
// ============================================================================
const Role = sequelize.define('Role', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  slug: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  description: { type: DataTypes.STRING(255) },
  permissions: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
}, { tableName: 'roles' });

const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  email: { type: DataTypes.STRING(191), allowNull: false, unique: true, validate: { isEmail: true } },
  password_hash: { type: DataTypes.STRING(255), allowNull: false },
  first_name: { type: DataTypes.STRING(100), allowNull: false },
  last_name: { type: DataTypes.STRING(100), allowNull: false },
  phone: { type: DataTypes.STRING(50) },
  role_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'roles', key: 'id' } },
  is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  last_login_at: { type: DataTypes.DATE },
  must_change_password: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  custom_permissions: { type: DataTypes.JSON, defaultValue: null },
  name: {
    type: DataTypes.VIRTUAL,
    get() {
      return `${this.first_name || ''} ${this.last_name || ''}`.trim();
    }
  }
}, { tableName: 'users' });

const Session = sequelize.define('Session', {
  id: { type: DataTypes.STRING(128), primaryKey: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
  ip_address: { type: DataTypes.STRING(45) },
  user_agent: { type: DataTypes.STRING(255) },
  expires_at: { type: DataTypes.DATE, allowNull: false },
}, { tableName: 'sessions' });

const PasswordResetToken = sequelize.define('PasswordResetToken', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
  token_hash: { type: DataTypes.STRING(128), allowNull: false },
  expires_at: { type: DataTypes.DATE, allowNull: false },
  used_at: { type: DataTypes.DATE },
}, { tableName: 'password_reset_tokens' });

// ============================================================================
// 2. MEDIA & FILES
// ============================================================================
const MediaAsset = sequelize.define('MediaAsset', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  uuid: { type: DataTypes.STRING(36), allowNull: false, unique: true },
  original_name: { type: DataTypes.STRING(255), allowNull: false },
  stored_filename: { type: DataTypes.STRING(255), allowNull: false },
  mime_type: { type: DataTypes.STRING(100), allowNull: false },
  file_size: { type: DataTypes.INTEGER, allowNull: false },
  storage_type: { type: DataTypes.ENUM('private', 'public'), allowNull: false, defaultValue: 'private' },
  relative_path: { type: DataTypes.STRING(255), allowNull: false },
  alt_text: { type: DataTypes.STRING(255) },
  uploaded_by_user_id: { type: DataTypes.INTEGER, references: { model: 'users', key: 'id' } },
  original_filename: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.original_name;
    }
  }
}, { tableName: 'media_assets' });

// ============================================================================
// 3. PUBLIC CONTENT: HERO BANNERS & TIPS
// ============================================================================
const HeroBanner = sequelize.define('HeroBanner', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  admin_title: { type: DataTypes.STRING(150) },
  tag_eyebrow: { type: DataTypes.STRING(100), defaultValue: 'PSG CLINICAL WING' },
  category_sub: { type: DataTypes.STRING(100) },
  headline: { type: DataTypes.STRING(255), allowNull: false },
  headline_emphasis: { type: DataTypes.STRING(255) },
  description: { type: DataTypes.TEXT, allowNull: false },
  cta_label: { type: DataTypes.STRING(100), defaultValue: 'Book Private Consultation' },
  cta_url: { type: DataTypes.STRING(255), defaultValue: 'book-appoinment.htm' },
  secondary_cta_label: { type: DataTypes.STRING(100) },
  secondary_cta_url: { type: DataTypes.STRING(255) },
  image_path: { type: DataTypes.STRING(255), allowNull: false },
  mobile_image_path: { type: DataTypes.STRING(255) },
  alt_text: { type: DataTypes.STRING(255) },
  focal_point: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'center center' },
  overlay_strength: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0.45 },
  text_alignment: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'left' },
  pills: { type: DataTypes.JSON, defaultValue: [] },
  status: { type: DataTypes.ENUM('published', 'draft', 'disabled'), allowNull: false, defaultValue: 'published' },
  sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  display_start: { type: DataTypes.DATE },
  display_end: { type: DataTypes.DATE },
}, { tableName: 'hero_banners' });

const Tip = sequelize.define('Tip', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  category: { type: DataTypes.STRING(100) },
  tip_text: { type: DataTypes.TEXT, allowNull: false },
  photo_url: { type: DataTypes.STRING(255), allowNull: false },
  alt_text: { type: DataTypes.STRING(255) },
  cta_label: { type: DataTypes.STRING(100) },
  cta_url: { type: DataTypes.STRING(255) },
  sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  rotation_interval: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 6 }, // seconds
}, { tableName: 'tips' });

// ============================================================================
// 4. BLOGS & CATEGORIES
// ============================================================================
const BlogCategory = sequelize.define('BlogCategory', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  slug: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  description: { type: DataTypes.STRING(255) },
  sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { tableName: 'blog_categories' });

const BlogArticle = sequelize.define('BlogArticle', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING(255), allowNull: false },
  slug: { type: DataTypes.STRING(191), allowNull: false, unique: true },
  excerpt: { type: DataTypes.TEXT, allowNull: false },
  body_html: { type: DataTypes.TEXT('long'), allowNull: false },
  category_id: { type: DataTypes.INTEGER, references: { model: 'blog_categories', key: 'id' } },
  cover_image: { type: DataTypes.STRING(255) },        // image inside the article (as before)
  banner_image: { type: DataTypes.STRING(255) },       // 16:9: top of the article and the sliding banner on blog.htm
  thumbnail_image: { type: DataTypes.STRING(255) },    // 16:9: card on the blog list (falls back to the banner)
  show_in_banner: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  alt_text: { type: DataTypes.STRING(255) },
  author_name: { type: DataTypes.STRING(100), defaultValue: 'Problem Solver Group (PSG)' },
  is_published: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  published_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  view_count: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { tableName: 'blog_articles' });

// ============================================================================
// 5. FAQS & VISITOR QUESTIONS (MODERATION)
// ============================================================================
const Faq = sequelize.define('Faq', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  category: { type: DataTypes.STRING(100), allowNull: false, defaultValue: 'General' },
  question: { type: DataTypes.TEXT, allowNull: false },
  answer_html: { type: DataTypes.TEXT, allowNull: false },
  sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
  is_published: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  // Where it shows: the FAQ page (faq.htm), the homepage questions section, and any "What We Do" pages
  show_on_faq_page: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  show_on_home: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  home_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  pages: { type: DataTypes.JSON, defaultValue: null }, // ['pre-marriage', 'divorce-mediation', ...] (config/service-pages.js)
}, { tableName: 'faqs' });

const VisitorQuestion = sequelize.define('VisitorQuestion', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  question: { type: DataTypes.TEXT, allowNull: false },
  category: { type: DataTypes.STRING(100), defaultValue: 'General' },
  submitter_name: { type: DataTypes.STRING(100) },
  submitter_email: { type: DataTypes.STRING(191) }, // Private
  status: { type: DataTypes.ENUM('pending', 'answered', 'published', 'rejected'), defaultValue: 'pending' },
  answer_html: { type: DataTypes.TEXT },
  answered_by_user_id: { type: DataTypes.INTEGER, references: { model: 'users', key: 'id' } },
  internal_notes: { type: DataTypes.TEXT },
  consent_agreed: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'visitor_questions' });

// ============================================================================
// 6. VISITOR STORIES (MODERATION)
// ============================================================================
const VisitorStory = sequelize.define('VisitorStory', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  display_name: { type: DataTypes.STRING(100), defaultValue: 'Anonymous Couple' },
  is_anonymous: { type: DataTypes.BOOLEAN, defaultValue: false },
  private_email: { type: DataTypes.STRING(191) },
  private_phone: { type: DataTypes.STRING(50) },
  story_text: { type: DataTypes.TEXT, allowNull: false },
  status: { type: DataTypes.ENUM('pending', 'approved', 'rejected'), defaultValue: 'pending' },
  internal_notes: { type: DataTypes.TEXT },
  consent_agreed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  approved_at: { type: DataTypes.DATE },
  // Added in migration 9: stories from customer accounts and from the admin
  user_id: { type: DataTypes.INTEGER, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
  source: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'visitor' }, // user | admin | visitor (older public form)
  rating: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 5 },
  service_key: { type: DataTypes.STRING(40) },      // config/service-pages.js STORY_SERVICES
  city: { type: DataTypes.STRING(80) },
  tag_line: { type: DataTypes.STRING(120) },        // e.g. "Married 11 years"
  badge_label: { type: DataTypes.STRING(60) },      // e.g. "Verified Couple"; empty = automatic
  is_verified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  verified_note: { type: DataTypes.STRING(255) },   // private: why it counts as verified
  is_hidden: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  show_on_home: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  customer_message: { type: DataTypes.STRING(500) }, // note from the team, shown to the customer in My stories
  edited_by_team: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, { tableName: 'visitor_stories', indexes: [{ fields: ['status', 'is_hidden'] }, { fields: ['user_id'] }] });

// ============================================================================
// 6b. STUDENT & EX-SERVICEMEN ID VERIFICATION (free consultation without the 2-month wait)
// ============================================================================
const IdVerification = sequelize.define('IdVerification', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
  category: { type: DataTypes.STRING(20), allowNull: false },          // student | ex_servicemen
  institution_name: { type: DataTypes.STRING(150) },                   // college / institution (students)
  service_branch: { type: DataTypes.STRING(60) },                      // Army, Navy, Air Force … (ex-servicemen)
  id_number: { type: DataTypes.STRING(60) },
  expiry_date: { type: DataTypes.STRING(10) },                         // YYYY-MM-DD (students); empty = no expiry
  front_asset_id: { type: DataTypes.INTEGER, references: { model: 'media_assets', key: 'id' }, onDelete: 'SET NULL' },
  back_asset_id: { type: DataTypes.INTEGER, references: { model: 'media_assets', key: 'id' }, onDelete: 'SET NULL' },
  status: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'pending' }, // pending | approved | rejected
  admin_message: { type: DataTypes.TEXT },                             // shown to the customer: why it failed, what to do
  internal_note: { type: DataTypes.TEXT },
  reviewed_by_user_id: { type: DataTypes.INTEGER, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
  reviewed_at: { type: DataTypes.DATE },
  reminder_notified_at: { type: DataTypes.DATE },                      // ex-servicemen: yearly reminder raised for the team
  reminded_at: { type: DataTypes.DATE }                                // ex-servicemen: the team contacted them
}, { tableName: 'id_verifications', indexes: [{ fields: ['user_id'] }, { fields: ['status'] }] });

// ============================================================================
// 7. SERVICES & SCHEDULING
// ============================================================================
const Service = sequelize.define('Service', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(150), allowNull: false },
  slug: { type: DataTypes.STRING(150), allowNull: false, unique: true },
  description: { type: DataTypes.TEXT },
  duration_options: { type: DataTypes.JSON, allowNull: false, defaultValue: [30, 60] }, // [30, 60] minutes
  price_30_minor: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 150000 }, // in paise (e.g. 1500.00 INR)
  price_60_minor: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 250000 },
  modes: { type: DataTypes.JSON, allowNull: false, defaultValue: ['in-person', 'video', 'phone'] },
  is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { tableName: 'services' });

const Practitioner = sequelize.define('Practitioner', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(150), allowNull: false },
  title: { type: DataTypes.STRING(150), allowNull: false },
  role_type: { type: DataTypes.ENUM('doctor', 'counsellor', 'mediator'), allowNull: false, defaultValue: 'counsellor' },
  qualifications: { type: DataTypes.STRING(255) },
  bio: { type: DataTypes.TEXT },
  photo_url: { type: DataTypes.STRING(255) },
  email: { type: DataTypes.STRING(191) },
  phone: { type: DataTypes.STRING(50) },
  is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, { tableName: 'practitioners' });

const WeeklySchedule = sequelize.define('WeeklySchedule', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  practitioner_id: { type: DataTypes.INTEGER, references: { model: 'practitioners', key: 'id' }, onDelete: 'CASCADE' }, // null = default template
  day_of_week: { type: DataTypes.INTEGER, allowNull: false }, // 0 (Sunday) to 6 (Saturday)
  open_time: { type: DataTypes.STRING(5), allowNull: false, defaultValue: '09:00' },
  close_time: { type: DataTypes.STRING(5), allowNull: false, defaultValue: '21:00' },
  is_working_day: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, { tableName: 'weekly_schedules' });

const ScheduleOverride = sequelize.define('ScheduleOverride', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  practitioner_id: { type: DataTypes.INTEGER, references: { model: 'practitioners', key: 'id' }, onDelete: 'CASCADE' },
  override_date: { type: DataTypes.STRING(10), allowNull: false }, // YYYY-MM-DD
  is_closed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  open_time: { type: DataTypes.STRING(5) },
  close_time: { type: DataTypes.STRING(5) },
  reason: { type: DataTypes.STRING(255) },
}, { tableName: 'schedule_overrides' });

const BlockedInterval = sequelize.define('BlockedInterval', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  practitioner_id: { type: DataTypes.INTEGER, references: { model: 'practitioners', key: 'id' }, onDelete: 'CASCADE' },
  block_date: { type: DataTypes.STRING(10), allowNull: false }, // YYYY-MM-DD
  start_time: { type: DataTypes.STRING(5), allowNull: false }, // HH:MM
  end_time: { type: DataTypes.STRING(5), allowNull: false },   // HH:MM
  reason: { type: DataTypes.STRING(255) },
}, { tableName: 'blocked_intervals' });

// ============================================================================
// 8. APPOINTMENTS & STATUS HISTORY
// ============================================================================
const Appointment = sequelize.define('Appointment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  reference_no: { type: DataTypes.STRING(32), allowNull: false, unique: true },
  client_name: { type: DataTypes.STRING(150), allowNull: false },
  client_email: { type: DataTypes.STRING(191), allowNull: false },
  client_mobile: { type: DataTypes.STRING(50), allowNull: false },
  client_whatsapp: { type: DataTypes.STRING(50) },
  user_id: { type: DataTypes.INTEGER, references: { model: 'users', key: 'id' } }, // customer account that booked (null = guest/staff)
  service_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'services', key: 'id' } },
  practitioner_id: { type: DataTypes.INTEGER, references: { model: 'practitioners', key: 'id' } },
  appointment_date: { type: DataTypes.STRING(10), allowNull: false }, // YYYY-MM-DD
  start_time: { type: DataTypes.STRING(5), allowNull: false }, // HH:MM
  end_time: { type: DataTypes.STRING(5), allowNull: false },   // HH:MM
  duration_minutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 30 },
  consultation_mode: { type: DataTypes.STRING(50), defaultValue: 'video' },
  clinic_location: { type: DataTypes.STRING(50) }, // mumbai | pune | delhi | bengaluru (in-person only)
  booking_type: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'paid' }, // free | paid
  status: { 
    type: DataTypes.ENUM('hold', 'confirmed', 'completed', 'cancelled', 'rescheduled', 'no_show'),
    allowNull: false,
    defaultValue: 'confirmed'
  },
  payment_status: {
    type: DataTypes.ENUM('not_required', 'pending', 'paid', 'refunded', 'failed'),
    allowNull: false,
    defaultValue: 'not_required'
  },
  amount_minor_units: { type: DataTypes.INTEGER, defaultValue: 0 },
  hold_expires_at: { type: DataTypes.DATE },
  client_notes: { type: DataTypes.TEXT },
  internal_notes: { type: DataTypes.TEXT },
  cancellation_reason: { type: DataTypes.STRING(255) },
}, { 
  tableName: 'appointments',
  indexes: [
    { fields: ['appointment_date', 'practitioner_id'] },
    { fields: ['status'] },
    { fields: ['reference_no'] }
  ]
});

const AppointmentStatusHistory = sequelize.define('AppointmentStatusHistory', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  appointment_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'appointments', key: 'id' }, onDelete: 'CASCADE' },
  previous_status: { type: DataTypes.STRING(50) },
  new_status: { type: DataTypes.STRING(50), allowNull: false },
  changed_by_user_id: { type: DataTypes.INTEGER, references: { model: 'users', key: 'id' } },
  notes: { type: DataTypes.TEXT },
}, { tableName: 'appointment_status_histories' });

// ============================================================================
// 9. ENQUIRIES & NOTES (CRM)
// ============================================================================
const Enquiry = sequelize.define('Enquiry', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  reference_no: { type: DataTypes.STRING(32), allowNull: false, unique: true },
  name: { type: DataTypes.STRING(150), allowNull: false },
  email: { type: DataTypes.STRING(191), allowNull: false },
  phone: { type: DataTypes.STRING(50), allowNull: false },
  whatsapp: { type: DataTypes.STRING(50) },
  preferred_clinic: { type: DataTypes.STRING(100) },
  subject: { type: DataTypes.STRING(200) },
  service_interest: { type: DataTypes.STRING(200) },
  preferred_contact_method: { type: DataTypes.STRING(100) },
  message: { type: DataTypes.TEXT, allowNull: false },
  consent_agreed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  source: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'contact_page' },
  status: { type: DataTypes.ENUM('new', 'contacted', 'in_progress', 'resolved', 'closed'), defaultValue: 'new' },
  assigned_to_user_id: { type: DataTypes.INTEGER, references: { model: 'users', key: 'id' } },
}, { tableName: 'enquiries' });

const EnquiryNote = sequelize.define('EnquiryNote', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  enquiry_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'enquiries', key: 'id' }, onDelete: 'CASCADE' },
  author_user_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'users', key: 'id' } },
  note_text: { type: DataTypes.TEXT, allowNull: false },
}, { tableName: 'enquiry_notes' });

// ============================================================================
// 10. CLINICAL APPLICATIONS (DOCTORS & COUNSELLORS)
// ============================================================================
const ClinicalApplication = sequelize.define('ClinicalApplication', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  reference_no: { type: DataTypes.STRING(32), allowNull: false, unique: true },
  role_type: { type: DataTypes.ENUM('doctor', 'counsellor'), allowNull: false },
  title: { type: DataTypes.STRING(20) },
  first_name: { type: DataTypes.STRING(100), allowNull: false },
  last_name: { type: DataTypes.STRING(100), allowNull: false },
  gender: { type: DataTypes.STRING(20) },
  dob: { type: DataTypes.STRING(10) },
  mobile: { type: DataTypes.STRING(50), allowNull: false },
  whatsapp: { type: DataTypes.STRING(50), allowNull: false },
  email: { type: DataTypes.STRING(191), allowNull: false },
  
  practice_status: { type: DataTypes.STRING(100) },
  experience_years: { type: DataTypes.STRING(50) },
  institution_name: { type: DataTypes.STRING(200) },
  affiliations: { type: DataTypes.TEXT },
  specialisation: { type: DataTypes.STRING(200) },
  objective: { type: DataTypes.TEXT },

  primary_qualification: { type: DataTypes.STRING(150) },
  primary_college: { type: DataTypes.STRING(200) },
  primary_year: { type: DataTypes.STRING(10) },
  primary_grade: { type: DataTypes.STRING(50) },

  pg_qualification: { type: DataTypes.STRING(150) },
  pg_college: { type: DataTypes.STRING(200) },
  pg_year: { type: DataTypes.STRING(10) },
  pg_grade: { type: DataTypes.STRING(50) },
  additional_qualifications: { type: DataTypes.JSON, defaultValue: [] },

  council_name: { type: DataTypes.STRING(150) },
  registration_number: { type: DataTypes.STRING(100) },
  state_jurisdiction: { type: DataTypes.STRING(100) },
  registration_year: { type: DataTypes.STRING(10) },
  valid_until: { type: DataTypes.STRING(10) },

  photo_asset_id: { type: DataTypes.INTEGER, references: { model: 'media_assets', key: 'id' } },
  primary_cert_asset_id: { type: DataTypes.INTEGER, references: { model: 'media_assets', key: 'id' } },
  pg_cert_asset_id: { type: DataTypes.INTEGER, references: { model: 'media_assets', key: 'id' } },
  council_cert_asset_id: { type: DataTypes.INTEGER, references: { model: 'media_assets', key: 'id' } },

  consultation_modes: { type: DataTypes.JSON, defaultValue: [] },
  preferred_hours_from: { type: DataTypes.STRING(10) },
  preferred_hours_to: { type: DataTypes.STRING(10) },

  declaration_agreed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  declaration_date: { type: DataTypes.STRING(10) },
  signed_name: { type: DataTypes.STRING(150) },
  signature_asset_id: { type: DataTypes.INTEGER, references: { model: 'media_assets', key: 'id' } },
  typed_signature: { type: DataTypes.STRING(150), allowNull: false },
  status: { 
    type: DataTypes.ENUM('submitted', 'under_review', 'interview_scheduled', 'approved', 'rejected'),
    defaultValue: 'submitted' 
  },
  assigned_to_user_id: { type: DataTypes.INTEGER, references: { model: 'users', key: 'id' } },
  internal_notes: { type: DataTypes.TEXT },
}, { tableName: 'clinical_applications' });

// ============================================================================
// 11. CAREERS & OPENINGS
// ============================================================================
const CareerOpening = sequelize.define('CareerOpening', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING(150), allowNull: false },
  department: { type: DataTypes.STRING(150), allowNull: false },
  slug: { type: DataTypes.STRING(150), allowNull: false, unique: true },
  summary: { type: DataTypes.TEXT, allowNull: false },
  responsibilities: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  required_skills: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  preferred_background: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  employment_type: { type: DataTypes.STRING(50), defaultValue: 'Full-time' },
  location: { type: DataTypes.STRING(100), defaultValue: 'Discussed during selection' },
  salary_notes: { type: DataTypes.STRING(255), defaultValue: 'Discussed during selection process' },
  is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { tableName: 'career_openings' });

const CareerApplication = sequelize.define('CareerApplication', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  reference_no: { type: DataTypes.STRING(32), allowNull: false, unique: true },
  career_opening_id: { type: DataTypes.INTEGER, references: { model: 'career_openings', key: 'id' } },
  role_title: { type: DataTypes.STRING(150), allowNull: false },
  full_name: { type: DataTypes.STRING(150), allowNull: false },
  email: { type: DataTypes.STRING(191), allowNull: false },
  mobile: { type: DataTypes.STRING(50), allowNull: false },
  whatsapp: { type: DataTypes.STRING(50), allowNull: false },
  city: { type: DataTypes.STRING(100), allowNull: false },
  experience_level: { type: DataTypes.STRING(100), allowNull: false },
  current_role: { type: DataTypes.STRING(150) },
  highest_qualification: { type: DataTypes.STRING(150) },
  skills: { type: DataTypes.TEXT, allowNull: false },
  portfolio_url: { type: DataTypes.STRING(255) },
  notice_period: { type: DataTypes.STRING(100), allowNull: false },
  expected_compensation: { type: DataTypes.STRING(150) },
  statement_of_purpose: { type: DataTypes.TEXT, allowNull: false },
  resume_asset_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'media_assets', key: 'id' } },
  consent_agreed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  status: {
    type: DataTypes.ENUM('submitted', 'under_review', 'interview_scheduled', 'offered', 'rejected'),
    defaultValue: 'submitted'
  },
  assigned_to_user_id: { type: DataTypes.INTEGER, references: { model: 'users', key: 'id' } },
  internal_notes: { type: DataTypes.TEXT },
}, { tableName: 'career_applications' });

// ============================================================================
// 12. PAYMENTS & GATEWAYS
// ============================================================================
const PaymentGatewayConfig = sequelize.define('PaymentGatewayConfig', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  provider: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'razorpay' },
  mode: { type: DataTypes.ENUM('test', 'live'), allowNull: false, defaultValue: 'test' },
  key_id: { type: DataTypes.STRING(100), allowNull: false },
  encrypted_secret: { type: DataTypes.STRING(255), allowNull: false },
  encrypted_webhook_secret: { type: DataTypes.STRING(255) },
  is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
}, { tableName: 'payment_gateway_configs' });

// ============================================================================
// 12a. CUSTOMER PACKAGES, CART & PACKAGE ORDERS
// ============================================================================
const Package = sequelize.define('Package', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(150), allowNull: false },
  slug: { type: DataTypes.STRING(150), allowNull: false, unique: true },
  tagline: { type: DataTypes.STRING(255) },
  description: { type: DataTypes.TEXT },
  price_minor: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },      // paise; 0 = free
  compare_at_minor: { type: DataTypes.INTEGER },                                     // optional "was" price
  sessions_included: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  session_minutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 60 },
  validity_days: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },     // 0 = no expiry
  features: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },            // what the package contains
  service_slugs: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },       // which services it covers
  badge: { type: DataTypes.STRING(50) },
  is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, { tableName: 'packages' });

const CartItem = sequelize.define('CartItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
  package_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'packages', key: 'id' }, onDelete: 'CASCADE' },
  quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
}, { tableName: 'cart_items', indexes: [{ unique: true, fields: ['user_id', 'package_id'] }] });

const PackageOrder = sequelize.define('PackageOrder', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  order_no: { type: DataTypes.STRING(32), allowNull: false, unique: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'users', key: 'id' } },
  status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'pending_payment' }, // pending_payment, paid, confirmed, completed, cancelled
  payment_status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'pending' }, // not_required, pending, paid, refunded, failed
  total_minor: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  items: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },               // snapshot of packages and prices
  customer_note: { type: DataTypes.TEXT },
  internal_notes: { type: DataTypes.TEXT },
  paid_at: { type: DataTypes.DATE },
}, { tableName: 'package_orders' });

// Offers: a card image the admin uploads. Active offers appear in a popup on the website and,
// when linked to a package, on that package's card. An offer price is charged at checkout.
const Offer = sequelize.define('Offer', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING(120), allowNull: false },
  description: { type: DataTypes.STRING(300) },                                       // short text under the image
  image_path: { type: DataTypes.STRING(255), allowNull: false },                     // the offer card image
  image_alt: { type: DataTypes.STRING(160) },
  badge_text: { type: DataTypes.STRING(40) },                                        // e.g. "Diwali Offer", "20% OFF"
  package_id: { type: DataTypes.INTEGER, references: { model: 'packages', key: 'id' }, onDelete: 'SET NULL' },
  offer_price_minor: { type: DataTypes.INTEGER },                                    // paise; null = no price change
  cta_label: { type: DataTypes.STRING(40) },
  cta_url: { type: DataTypes.STRING(255) },                                          // used when no package is linked
  terms: { type: DataTypes.STRING(500) },                                            // small print
  start_date: { type: DataTypes.DATEONLY },                                          // IST, inclusive; null = from now
  end_date: { type: DataTypes.DATEONLY },                                            // IST, inclusive; null = no end
  show_popup: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, { tableName: 'offers', indexes: [{ fields: ['is_active', 'start_date', 'end_date'] }] });

// ============================================================================
// 12b. BILLS (INVOICES) & SAVED BILL DETAILS
// ============================================================================
// A bill is created automatically when a payment succeeds. Staff check the details and send it;
// only then does the customer see it under My bills. Business and customer details are copied
// onto the bill (snapshot), so later edits never change a bill that was already sent.
const Invoice = sequelize.define('Invoice', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  invoice_no: { type: DataTypes.STRING(40), allowNull: false, unique: true },     // SPZ/2026-27/0001
  fy: { type: DataTypes.STRING(9), allowNull: false },                             // financial year 2026-27
  seq: { type: DataTypes.INTEGER, allowNull: false },
  user_id: { type: DataTypes.INTEGER, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
  payment_order_id: { type: DataTypes.INTEGER, unique: true, references: { model: 'payment_orders', key: 'id' }, onDelete: 'SET NULL' },
  package_order_id: { type: DataTypes.INTEGER, references: { model: 'package_orders', key: 'id' }, onDelete: 'SET NULL' },
  appointment_id: { type: DataTypes.INTEGER, references: { model: 'appointments', key: 'id' }, onDelete: 'SET NULL' },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'ready' },  // ready | sent | void
  source: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'online' }, // online | manual
  issued_at: { type: DataTypes.DATE, allowNull: false },
  sent_at: { type: DataTypes.DATE },
  sent_by_user_id: { type: DataTypes.INTEGER, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
  viewed_at: { type: DataTypes.DATE },                                             // customer first opened it
  seller: { type: DataTypes.JSON },                                                // bill from (business)
  customer: { type: DataTypes.JSON, allowNull: false },                            // bill to
  items: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  subtotal_minor: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },  // before discounts
  discount_minor: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  total_minor: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },     // amount paid (tax included)
  payment: { type: DataTypes.JSON },                                               // method, ids, paid_at, reference
  notes: { type: DataTypes.STRING(500) },
}, { tableName: 'invoices', indexes: [{ unique: true, fields: ['fy', 'seq'] }, { fields: ['user_id', 'status'] }, { fields: ['status'] }] });

// "Bill from" details saved for the dropdown (a business can have more than one, e.g. two branches)
const BillingProfile = sequelize.define('BillingProfile', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  business_name: { type: DataTypes.STRING(150), allowNull: false },
  address: { type: DataTypes.STRING(400), allowNull: false },
  gstin: { type: DataTypes.STRING(15) },
  phone: { type: DataTypes.STRING(30) },
  email: { type: DataTypes.STRING(150) },
  website: { type: DataTypes.STRING(150) },
  sac_code: { type: DataTypes.STRING(10) },
  gst_rate: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },  // 0 = no GST shown; prices include GST
  footer_note: { type: DataTypes.STRING(300) },
  is_default: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  last_used_at: { type: DataTypes.DATE },
}, { tableName: 'billing_profiles' });

// "Bill to" details saved per customer for the dropdown
const CustomerBillingDetail = sequelize.define('CustomerBillingDetail', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
  email: { type: DataTypes.STRING(150) },                                          // for bills of guests
  name: { type: DataTypes.STRING(150), allowNull: false },
  company: { type: DataTypes.STRING(150) },
  address: { type: DataTypes.STRING(400) },
  gstin: { type: DataTypes.STRING(15) },
  phone: { type: DataTypes.STRING(30) },
  last_used_at: { type: DataTypes.DATE },
}, { tableName: 'customer_billing_details', indexes: [{ fields: ['user_id'] }, { fields: ['email'] }] });

// ============================================================================
// 12c. ADMIN NOTIFICATIONS
// ============================================================================
// One row per event (payment, bill, order, booking, enquiry, application...). Staff see only
// the events their permissions allow; each user's read state is kept in notification_reads.
const Notification = sequelize.define('Notification', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  type: { type: DataTypes.STRING(40), allowNull: false },
  category: { type: DataTypes.STRING(20), allowNull: false },     // payments | orders | bookings | enquiries | applications | website
  level: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'info' }, // info | success | warning
  title: { type: DataTypes.STRING(200), allowNull: false },
  message: { type: DataTypes.STRING(500) },
  link: { type: DataTypes.STRING(255) },                          // admin route, e.g. /shop?tab=bills&bill=12
  permission: { type: DataTypes.STRING(50), allowNull: false },   // who may see it
  entity_type: { type: DataTypes.STRING(40) },
  entity_id: { type: DataTypes.STRING(40) },
  amount_minor: { type: DataTypes.INTEGER },
}, { tableName: 'notifications', updatedAt: false, indexes: [{ fields: ['permission', 'id'] }, { fields: ['category'] }] });

const NotificationRead = sequelize.define('NotificationRead', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  notification_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'notifications', key: 'id' }, onDelete: 'CASCADE' },
  user_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
}, { tableName: 'notification_reads', updatedAt: false, indexes: [{ unique: true, fields: ['notification_id', 'user_id'] }, { fields: ['user_id'] }] });

// Website activity of logged-in customers (pages opened, buttons pressed, logins, bookings).
// Never stores what customers type into forms.
const CustomerActivity = sequelize.define('CustomerActivity', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
  event: { type: DataTypes.STRING(40), allowNull: false },
  page: { type: DataTypes.STRING(255) },
  label: { type: DataTypes.STRING(255) },
  details: { type: DataTypes.JSON },
  ip_address: { type: DataTypes.STRING(45) },
  user_agent: { type: DataTypes.STRING(255) },
  occurred_at: { type: DataTypes.DATE(3), allowNull: false }, // millisecond precision keeps clicks in order
}, { tableName: 'customer_activities', updatedAt: false, indexes: [{ fields: ['user_id', 'occurred_at'] }, { fields: ['occurred_at'] }] });

// Website chat assistant: one conversation per chat session, with every message kept for staff review
const ChatConversation = sequelize.define('ChatConversation', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'open' }, // open | ended
  ended_reason: { type: DataTypes.STRING(30) },                                   // idle | closed | user
  context: { type: DataTypes.JSON },                                              // last service, pending step
  page: { type: DataTypes.STRING(255) },
  message_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  unanswered_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  last_message_at: { type: DataTypes.DATE(3) },
  ended_at: { type: DataTypes.DATE },
}, { tableName: 'chat_conversations', indexes: [{ fields: ['user_id'] }, { fields: ['last_message_at'] }] });

const ChatMessage = sequelize.define('ChatMessage', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  conversation_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'chat_conversations', key: 'id' }, onDelete: 'CASCADE' },
  sender: { type: DataTypes.STRING(10), allowNull: false },                       // user | bot
  text: { type: DataTypes.TEXT, allowNull: false },
  intent: { type: DataTypes.STRING(40) },
  matched: { type: DataTypes.BOOLEAN },                                           // for user messages: did the assistant understand?
  sent_at: { type: DataTypes.DATE(3), allowNull: false },
}, { tableName: 'chat_messages', updatedAt: false, indexes: [{ fields: ['conversation_id', 'sent_at'] }, { fields: ['matched'] }] });

const PaymentOrder = sequelize.define('PaymentOrder', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  order_reference: { type: DataTypes.STRING(64), allowNull: false, unique: true },
  appointment_id: { type: DataTypes.INTEGER, references: { model: 'appointments', key: 'id' } },
  package_order_id: { type: DataTypes.INTEGER, references: { model: 'package_orders', key: 'id' } },
  gateway_order_id: { type: DataTypes.STRING(100) },
  amount_minor_units: { type: DataTypes.INTEGER, allowNull: false },
  currency: { type: DataTypes.STRING(10), defaultValue: 'INR' },
  status: { 
    type: DataTypes.ENUM('created', 'attempted', 'paid', 'failed', 'expired'),
    defaultValue: 'created'
  },
  gateway_config_version: { type: DataTypes.INTEGER, defaultValue: 1 },
}, { tableName: 'payment_orders' });

const PaymentTransaction = sequelize.define('PaymentTransaction', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  payment_order_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'payment_orders', key: 'id' } },
  gateway_payment_id: { type: DataTypes.STRING(100), allowNull: false },
  gateway_signature: { type: DataTypes.STRING(255) },
  amount_minor_units: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.ENUM('success', 'failed'), defaultValue: 'success' },
  raw_payload: { type: DataTypes.JSON },
}, { tableName: 'payment_transactions' });

// ============================================================================
// 13. SITE SETTINGS & AUDIT LOGS
// ============================================================================
const SiteSetting = sequelize.define('SiteSetting', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  setting_key: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  setting_value: { type: DataTypes.TEXT, allowNull: false },
  category: { type: DataTypes.STRING(50), defaultValue: 'general' },
  description: { type: DataTypes.STRING(255) },
  is_public: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'site_settings' });

const AuditLog = sequelize.define('AuditLog', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, references: { model: 'users', key: 'id' } },
  action: { type: DataTypes.STRING(100), allowNull: false },
  entity_type: { type: DataTypes.STRING(100) },
  entity_id: { type: DataTypes.STRING(100) },
  old_values: { type: DataTypes.JSON },
  new_values: { type: DataTypes.JSON },
  ip_address: { type: DataTypes.STRING(45) },
  user_agent: { type: DataTypes.STRING(255) },
}, { tableName: 'audit_logs' });

const HomepageSection = sequelize.define('HomepageSection', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  section_key: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  section_name: { type: DataTypes.STRING(150), allowNull: false },
  headline: { type: DataTypes.STRING(255) },
  subheadline: { type: DataTypes.STRING(255) },
  body_text: { type: DataTypes.TEXT },
  content_json: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
  is_visible: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
  version: { type: DataTypes.INTEGER, defaultValue: 1 },
}, { tableName: 'homepage_sections' });

const HomepageSectionHistory = sequelize.define('HomepageSectionHistory', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  section_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'homepage_sections', key: 'id' }, onDelete: 'CASCADE' },
  version: { type: DataTypes.INTEGER, allowNull: false },
  content_json: { type: DataTypes.JSON, allowNull: false },
  changed_by_user_id: { type: DataTypes.INTEGER, references: { model: 'users', key: 'id' } },
  notes: { type: DataTypes.STRING(255) },
}, { tableName: 'homepage_section_histories', timestamps: true, updatedAt: false });

// ============================================================================
// ASSOCIATIONS
// ============================================================================
User.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });
Role.hasMany(User, { foreignKey: 'role_id', as: 'users' });

User.hasMany(Session, { foreignKey: 'user_id', as: 'sessions' });
Session.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

BlogArticle.belongsTo(BlogCategory, { foreignKey: 'category_id', as: 'category' });
BlogCategory.hasMany(BlogArticle, { foreignKey: 'category_id', as: 'articles' });

Appointment.belongsTo(Service, { foreignKey: 'service_id', as: 'service' });
Appointment.belongsTo(Practitioner, { foreignKey: 'practitioner_id', as: 'practitioner' });
Appointment.hasMany(AppointmentStatusHistory, { foreignKey: 'appointment_id', as: 'status_history' });
AppointmentStatusHistory.belongsTo(Appointment, { foreignKey: 'appointment_id' });

Enquiry.hasMany(EnquiryNote, { foreignKey: 'enquiry_id', as: 'notes' });
EnquiryNote.belongsTo(Enquiry, { foreignKey: 'enquiry_id' });
EnquiryNote.belongsTo(User, { foreignKey: 'author_user_id', as: 'author' });
Enquiry.belongsTo(User, { foreignKey: 'assigned_to_user_id', as: 'assigned_to' });

CareerApplication.belongsTo(CareerOpening, { foreignKey: 'career_opening_id', as: 'opening' });
CareerOpening.hasMany(CareerApplication, { foreignKey: 'career_opening_id', as: 'applications' });
CareerApplication.belongsTo(User, { foreignKey: 'assigned_to_user_id', as: 'assigned_to' });

PaymentOrder.belongsTo(Appointment, { foreignKey: 'appointment_id', as: 'appointment' });
PaymentOrder.belongsTo(PackageOrder, { foreignKey: 'package_order_id', as: 'package_order' });
CartItem.belongsTo(Package, { foreignKey: 'package_id', as: 'package' });
Offer.belongsTo(Package, { foreignKey: 'package_id', as: 'package' });
Invoice.belongsTo(User, { foreignKey: 'user_id', as: 'account' });
Invoice.belongsTo(User, { foreignKey: 'sent_by_user_id', as: 'sent_by' });
Invoice.belongsTo(PackageOrder, { foreignKey: 'package_order_id', as: 'package_order' });
Invoice.belongsTo(Appointment, { foreignKey: 'appointment_id', as: 'appointment' });
Invoice.belongsTo(PaymentOrder, { foreignKey: 'payment_order_id', as: 'payment_order' });
NotificationRead.belongsTo(Notification, { foreignKey: 'notification_id', as: 'notification' });
User.hasMany(CartItem, { foreignKey: 'user_id', as: 'cart_items' });
PackageOrder.belongsTo(User, { foreignKey: 'user_id', as: 'customer' });
CustomerActivity.belongsTo(User, { foreignKey: 'user_id', as: 'customer' });
ChatConversation.belongsTo(User, { foreignKey: 'user_id', as: 'customer' });
ChatConversation.hasMany(ChatMessage, { foreignKey: 'conversation_id', as: 'messages' });
ChatMessage.belongsTo(ChatConversation, { foreignKey: 'conversation_id', as: 'conversation' });
Appointment.belongsTo(User, { foreignKey: 'user_id', as: 'customer' });
User.hasMany(PackageOrder, { foreignKey: 'user_id', as: 'package_orders' });
PaymentOrder.hasMany(PaymentTransaction, { foreignKey: 'payment_order_id', as: 'transactions' });
PaymentTransaction.belongsTo(PaymentOrder, { foreignKey: 'payment_order_id', as: 'order' });

ClinicalApplication.belongsTo(MediaAsset, { foreignKey: 'photo_asset_id', as: 'photo' });
ClinicalApplication.belongsTo(MediaAsset, { foreignKey: 'primary_cert_asset_id', as: 'primary_cert' });
ClinicalApplication.belongsTo(MediaAsset, { foreignKey: 'pg_cert_asset_id', as: 'pg_cert' });
ClinicalApplication.belongsTo(MediaAsset, { foreignKey: 'council_cert_asset_id', as: 'council_cert' });
ClinicalApplication.belongsTo(MediaAsset, { foreignKey: 'signature_asset_id', as: 'signature' });
ClinicalApplication.belongsTo(User, { foreignKey: 'assigned_to_user_id', as: 'assigned_to' });
CareerApplication.belongsTo(MediaAsset, { foreignKey: 'resume_asset_id', as: 'resume' });
VisitorQuestion.belongsTo(User, { foreignKey: 'answered_by_user_id', as: 'answered_by' });
AuditLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

VisitorStory.belongsTo(User, { foreignKey: 'user_id', as: 'author', constraints: false });
IdVerification.belongsTo(User, { foreignKey: 'user_id', as: 'customer' });
IdVerification.belongsTo(User, { foreignKey: 'reviewed_by_user_id', as: 'reviewer' });
IdVerification.belongsTo(MediaAsset, { foreignKey: 'front_asset_id', as: 'front' });
IdVerification.belongsTo(MediaAsset, { foreignKey: 'back_asset_id', as: 'back' });
HomepageSection.hasMany(HomepageSectionHistory, { foreignKey: 'section_id', as: 'history' });
HomepageSectionHistory.belongsTo(HomepageSection, { foreignKey: 'section_id' });
HomepageSectionHistory.belongsTo(User, { foreignKey: 'changed_by_user_id', as: 'changed_by' });

module.exports = {
  sequelize,
  Role,
  User,
  Session,
  PasswordResetToken,
  MediaAsset,
  HeroBanner,
  Tip,
  BlogCategory,
  BlogArticle,
  Faq,
  VisitorQuestion,
  VisitorStory,
  IdVerification,
  Service,
  Practitioner,
  WeeklySchedule,
  ScheduleOverride,
  BlockedInterval,
  Appointment,
  AppointmentStatusHistory,
  Enquiry,
  EnquiryNote,
  ClinicalApplication,
  CareerOpening,
  CareerApplication,
  PaymentGatewayConfig,
  PaymentOrder,
  PaymentTransaction,
  Package,
  CartItem,
  PackageOrder,
  Offer,
  Invoice,
  BillingProfile,
  CustomerBillingDetail,
  Notification,
  NotificationRead,
  CustomerActivity,
  ChatConversation,
  ChatMessage,
  SiteSetting,
  AuditLog,
  HomepageSection,
  HomepageSectionHistory
};
