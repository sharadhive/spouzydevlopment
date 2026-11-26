const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const { requireRole, requirePermission, hasPermission } = require('../middlewares/rbac.middleware');
const { sanitizeCsvValue } = require('../config/security');
const {
  User,
  Role,
  Enquiry,
  EnquiryNote,
  ClinicalApplication,
  CareerOpening,
  CareerApplication,
  Appointment,
  Practitioner,
  WeeklySchedule,
  ScheduleOverride,
  BlockedInterval,
  HeroBanner,
  Tip,
  BlogCategory,
  BlogArticle,
  Faq,
  VisitorQuestion,
  VisitorStory,
  SiteSetting,
  AuditLog,
  HomepageSection,
  HomepageSectionHistory,
  MediaAsset,
  Service,
  PaymentOrder,
  sequelize
} = require('../models');
const { todayIST, istDayStartUtc, addDays } = require('../config/time');
const { ALL_PERMISSIONS } = require('../config/permissions');
const { CLINICAL_STATUSES } = require('../services/clinical.service');
const { CAREER_STATUSES } = require('../services/career.service');
const uploadService = require('../services/upload.service');
const upload = require('../middlewares/upload.middleware');
const { sendError } = require('../config/validation');
const { Op } = require('sequelize');

const enquiryService = require('../services/enquiry.service');
const clinicalService = require('../services/clinical.service');
const careerService = require('../services/career.service');
const appointmentService = require('../services/appointment.service');
const contentService = require('../services/content.service');
const paymentService = require('../services/payment.service');
const auditService = require('../services/audit.service');

// Protect all admin routes: must be authenticated and not a customer
router.use(authenticate);
router.use((req, res, next) => {
  if (!req.user || !req.user.role) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }
  const roleSlug = req.user.role?.slug || (typeof req.user.role === 'string' ? req.user.role : '');
  if (roleSlug === 'customer') {
    return res.status(403).json({ success: false, message: 'Forbidden for customer accounts.' });
  }
  next();
});

// ============================================================================
// 1. DASHBOARDS (OPERATIONAL & CONTENT-SPECIFIC)
// ============================================================================

// Operational Stats (Enquiries, Clinical, Appointments) - restricted to operational/clinical roles
router.get('/dashboard/stats', requirePermission(['enquiries:view', 'clinical_apps:view', 'appointments:view']), async (req, res, next) => {
  try {
    const today = todayIST();

    const [
      enquiriesTotal,
      enquiriesNew,
      clinicalTotal,
      clinicalPending,
      careersTotal,
      careersSubmitted,
      appointmentsTotal,
      appointmentsToday,
      questionsPending,
      storiesPending
    ] = await Promise.all([
      Enquiry.count(),
      Enquiry.count({ where: { status: 'new' } }),
      ClinicalApplication.count(),
      ClinicalApplication.count({ where: { status: 'submitted' } }),
      CareerApplication.count(),
      CareerApplication.count({ where: { status: 'submitted' } }),
      Appointment.count(),
      Appointment.count({ where: { appointment_date: today } }),
      VisitorQuestion.count({ where: { status: 'pending' } }),
      VisitorStory.count({ where: { status: 'pending' } })
    ]);

    // Recent 5 enquiries (contact details only for users allowed to see enquiries)
    const recentEnquiries = hasPermission(req.user, 'enquiries:view') ? await Enquiry.findAll({
      limit: 5,
      order: [['id', 'DESC']],
      attributes: ['id', 'reference_no', 'name', 'email', 'phone', 'preferred_clinic', 'status', 'createdAt']
    }) : [];

    // Today's appointments
    const todaysAppointments = await Appointment.findAll({
      where: { appointment_date: today },
      order: [['start_time', 'ASC']],
      include: [
        { model: Practitioner, as: 'practitioner', attributes: ['id', 'name', 'title'] }
      ]
    });

    res.json({
      success: true,
      data: {
        counts: {
          enquiriesTotal,
          enquiriesNew,
          clinicalTotal,
          clinicalPending,
          careersTotal,
          careersSubmitted,
          appointmentsTotal,
          appointmentsToday,
          questionsPending,
          storiesPending
        },
        recentEnquiries,
        todaysAppointments
      }
    });
  } catch (err) {
    next(err);
  }
});

// Role-aware dashboard: each section is included only if the user may see it.
router.get('/dashboard/overview', async (req, res, next) => {
  try {
    const can = (perm) => hasPermission(req.user, perm);
    const isAdmin = req.user.role?.slug === 'admin';
    const today = todayIST();
    const todayStart = istDayStartUtc(today);
    const weekStart = istDayStartUtc(addDays(today, -6));
    const monthStartYmd = `${today.slice(0, 8)}01`;
    const monthStart = istDayStartUtc(monthStartYmd);
    const trendStartYmd = addDays(today, -13);
    const trendStart = istDayStartUtc(trendStartYmd);
    const sinceWhere = (d) => ({ createdAt: { [Op.gte]: d } });

    const sections = {};
    const trendSeries = {};

    const bucketByIstDay = (rows) => {
      const counts = {};
      rows.forEach(r => {
        const day = todayIST(new Date(r.createdAt));
        counts[day] = (counts[day] || 0) + 1;
      });
      return counts;
    };

    if (can('enquiries:view')) {
      const [total, fresh, todayCount, last7, fromContact, fromWidget, recent, trendRows] = await Promise.all([
        Enquiry.count(),
        Enquiry.count({ where: { status: 'new' } }),
        Enquiry.count({ where: sinceWhere(todayStart) }),
        Enquiry.count({ where: sinceWhere(weekStart) }),
        Enquiry.count({ where: { source: 'contact_page' } }),
        Enquiry.count({ where: { source: 'floating_widget' } }),
        Enquiry.findAll({
          limit: 5,
          order: [['id', 'DESC']],
          attributes: ['id', 'reference_no', 'name', 'email', 'phone', 'service_interest', 'preferred_contact_method', 'source', 'status', 'createdAt']
        }),
        Enquiry.findAll({ where: sinceWhere(trendStart), attributes: ['createdAt'] })
      ]);
      sections.enquiries = { total, new: fresh, today: todayCount, last7Days: last7, bySource: { contact_page: fromContact, floating_widget: fromWidget }, recent };
      trendSeries.enquiries = bucketByIstDay(trendRows);
    }

    if (can('clinical_apps:view')) {
      const byStatus = {};
      await Promise.all(CLINICAL_STATUSES.map(async st => { byStatus[st] = await ClinicalApplication.count({ where: { status: st } }); }));
      const [total, doctors, counsellors, last7, pendingDoctors, pendingCounsellors, trendRows] = await Promise.all([
        ClinicalApplication.count(),
        ClinicalApplication.count({ where: { role_type: 'doctor' } }),
        ClinicalApplication.count({ where: { role_type: 'counsellor' } }),
        ClinicalApplication.count({ where: sinceWhere(weekStart) }),
        ClinicalApplication.count({ where: { role_type: 'doctor', status: 'submitted' } }),
        ClinicalApplication.count({ where: { role_type: 'counsellor', status: 'submitted' } }),
        ClinicalApplication.findAll({ where: sinceWhere(trendStart), attributes: ['createdAt'] })
      ]);
      sections.clinical = {
        total,
        byStatus,
        byRole: { doctor: doctors, counsellor: counsellors },
        awaitingReview: { doctor: pendingDoctors, counsellor: pendingCounsellors, total: pendingDoctors + pendingCounsellors },
        last7Days: last7
      };
      trendSeries.applications = bucketByIstDay(trendRows);
    }

    if (can('careers:view')) {
      const byStatus = {};
      await Promise.all(CAREER_STATUSES.map(async st => { byStatus[st] = await CareerApplication.count({ where: { status: st } }); }));
      const [total, last7, openOpenings, trendRows] = await Promise.all([
        CareerApplication.count(),
        CareerApplication.count({ where: sinceWhere(weekStart) }),
        CareerOpening.count({ where: { is_active: true } }),
        CareerApplication.findAll({ where: sinceWhere(trendStart), attributes: ['createdAt'] })
      ]);
      sections.careers = { total, byStatus, awaitingReview: byStatus.submitted || 0, last7Days: last7, openOpenings };
      const careerCounts = bucketByIstDay(trendRows);
      trendSeries.applications = trendSeries.applications || {};
      Object.entries(careerCounts).forEach(([d, n]) => { trendSeries.applications[d] = (trendSeries.applications[d] || 0) + n; });
    }

    if (can('appointments:view')) {
      const now = new Date();
      const activeStatuses = ['confirmed', 'hold', 'rescheduled', 'completed'];
      const [todayList, upcoming7, upcomingFree, upcomingPaid, activeHolds, paymentPending, noShows, trendRows] = await Promise.all([
        Appointment.findAll({
          where: { appointment_date: today, status: { [Op.in]: activeStatuses } },
          order: [['start_time', 'ASC']],
          include: [
            { model: Practitioner, as: 'practitioner', attributes: ['id', 'name', 'title'] },
            { model: Service, as: 'service', attributes: ['id', 'name', 'slug'] }
          ]
        }),
        Appointment.count({ where: { appointment_date: { [Op.gt]: today, [Op.lte]: addDays(today, 7) }, status: { [Op.in]: ['confirmed', 'hold', 'rescheduled'] } } }),
        Appointment.count({ where: { appointment_date: { [Op.gte]: today }, booking_type: 'free', status: { [Op.in]: ['confirmed', 'rescheduled'] } } }),
        Appointment.count({ where: { appointment_date: { [Op.gte]: today }, booking_type: 'paid', status: { [Op.in]: ['confirmed', 'hold', 'rescheduled'] } } }),
        Appointment.count({ where: { status: 'hold', hold_expires_at: { [Op.gt]: now } } }),
        Appointment.count({ where: { booking_type: 'paid', payment_status: 'pending', status: { [Op.in]: ['confirmed', 'rescheduled'] } } }),
        Appointment.count({ where: { status: 'no_show', appointment_date: { [Op.gte]: monthStartYmd } } }),
        Appointment.findAll({ where: sinceWhere(trendStart), attributes: ['createdAt'] })
      ]);
      sections.appointments = {
        today: todayList,
        todayCount: todayList.length,
        upcoming7Days: upcoming7,
        upcomingByType: { free: upcomingFree, paid: upcomingPaid },
        activeHolds,
        paymentPending,
        noShowsThisMonth: noShows
      };
      trendSeries.appointments = bucketByIstDay(trendRows);
    }

    if (isAdmin || can('settings:gateway')) {
      const paymentService = require('../services/payment.service');
      const [onlineEnabled, paidOrders] = await Promise.all([
        paymentService.isOnlinePaymentEnabled(),
        PaymentOrder.findAll({ where: { status: 'paid', updatedAt: { [Op.gte]: monthStart } }, attributes: ['amount_minor_units'] })
      ]);
      sections.payments = {
        onlineEnabled,
        paidThisMonthMinor: paidOrders.reduce((sum, o) => sum + (o.amount_minor_units || 0), 0),
        paidCountThisMonth: paidOrders.length
      };
    }

    if (can('orders:view')) {
      const { PackageOrder, Role: RoleModel } = require('../models');
      const customerRole = await RoleModel.findOne({ where: { slug: 'customer' } });
      const [customers, newCustomers7, ordersToday, pendingPayment, paidMonth, freeClaims] = await Promise.all([
        customerRole ? User.count({ where: { role_id: customerRole.id } }) : 0,
        customerRole ? User.count({ where: { role_id: customerRole.id, createdAt: { [Op.gte]: weekStart } } }) : 0,
        PackageOrder.count({ where: sinceWhere(todayStart) }),
        PackageOrder.count({ where: { status: 'pending_payment' } }),
        PackageOrder.findAll({ where: { payment_status: 'paid', paid_at: { [Op.gte]: monthStart } }, attributes: ['total_minor'] }),
        PackageOrder.count({ where: { total_minor: 0, status: { [Op.ne]: 'cancelled' } } })
      ]);
      const activeToday = await require('../services/activity.service').countActiveToday();
      sections.shop = {
        customers,
        activeToday,
        newCustomers7Days: newCustomers7,
        ordersToday,
        pendingPayment,
        paidThisMonthMinor: paidMonth.reduce((sum, o) => sum + (o.total_minor || 0), 0),
        paidOrdersThisMonth: paidMonth.length,
        freeClaims,
        billsReady: await require('../models').Invoice.count({ where: { status: 'ready' } }).catch(() => 0)
      };
    }

    if (can('enquiries:view')) {
      sections.chat = await require('../services/chat.service').stats();
    }

    if (can('moderation:view')) {
      const [questionsPending, storiesPending, faqsPublished] = await Promise.all([
        VisitorQuestion.count({ where: { status: 'pending' } }),
        VisitorStory.count({ where: { status: 'pending' } }),
        Faq.count({ where: { is_published: true } })
      ]);
      sections.moderation = { questionsPending, storiesPending, faqsPublished };
    }

    if (can('verifications:view')) {
      const IdV = require('../models').IdVerification;
      sections.verifications = { pending: await IdV.count({ where: { status: 'pending' } }).catch(() => 0) };
    }

    if (can('content:view') || can('blogs:view')) {
      const [bannersActive, tipsActive, blogsPublished, blogsDraft, sectionsCount] = await Promise.all([
        HeroBanner.count({ where: { is_active: true } }),
        Tip.count({ where: { is_active: true } }),
        BlogArticle.count({ where: { is_published: true } }),
        BlogArticle.count({ where: { is_published: false } }),
        HomepageSection.count()
      ]);
      sections.content = { bannersActive, tipsActive, blogsPublished, blogsDraft, homepageSections: sectionsCount };
    }

    const trend = [];
    if (Object.keys(trendSeries).length) {
      for (let i = 0; i < 14; i++) {
        const day = addDays(trendStartYmd, i);
        const point = { date: day };
        Object.keys(trendSeries).forEach(k => { point[k] = trendSeries[k][day] || 0; });
        trend.push(point);
      }
    }

    res.json({ success: true, data: { today, generatedAt: new Date().toISOString(), sections, trend, trendSeries: Object.keys(trendSeries) } });
  } catch (err) {
    next(err);
  }
});

// Dashboard charts: counts per day and breakdowns for the chosen period (7, 30 or 90 days).
// Each section appears only when the role may see that data.
router.get('/dashboard/analytics', async (req, res, next) => {
  try {
    const can = (perm) => hasPermission(req.user, perm);
    const data = await require('../services/analytics.service').build(req.user, req.query.days, can);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// Content Summary Dashboard - dedicated for Content Editors and Admin
router.get('/dashboard/content-summary', requirePermission(['content:view', 'blogs:view', 'moderation:view', 'media:view', 'settings:content']), async (req, res, next) => {
  try {
    const user = req.user;
    const canContent = hasPermission(user, 'content:view');
    const canBlogs = hasPermission(user, 'blogs:view');
    const canModeration = hasPermission(user, 'moderation:view');
    const canMedia = hasPermission(user, 'media:view');
    const canSettings = hasPermission(user, 'settings:content');

    const summary = {};

    if (canContent) {
      const [sectionsCount, bannersTotal, bannersActive, tipsTotal, tipsActive] = await Promise.all([
        HomepageSection.count(),
        HeroBanner.count(),
        HeroBanner.count({ where: { is_active: true } }),
        Tip.count(),
        Tip.count({ where: { is_active: true } })
      ]);
      summary.homepageSections = { total: sectionsCount };
      summary.heroBanners = { total: bannersTotal, active: bannersActive, drafts: bannersTotal - bannersActive };
      summary.tips = { total: tipsTotal, active: tipsActive };
    }

    if (canBlogs) {
      const [blogsTotal, blogsPublished, categoriesTotal] = await Promise.all([
        BlogArticle.count(),
        BlogArticle.count({ where: { is_published: true } }),
        BlogCategory.count()
      ]);
      summary.blogs = { total: blogsTotal, published: blogsPublished, drafts: blogsTotal - blogsPublished, categories: categoriesTotal };
    }

    if (canModeration) {
      const [faqsTotal, questionsTotal, questionsPending, storiesTotal, storiesPending] = await Promise.all([
        Faq.count(),
        VisitorQuestion.count(),
        VisitorQuestion.count({ where: { status: 'pending' } }),
        VisitorStory.count(),
        VisitorStory.count({ where: { status: 'pending' } })
      ]);
      summary.faqs = { total: faqsTotal };
      summary.visitorQuestions = { total: questionsTotal, pending: questionsPending };
      summary.visitorStories = { total: storiesTotal, pending: storiesPending };
    }

    if (canMedia) {
      const mediaCount = await MediaAsset.count({ where: { storage_type: 'public' } });
      summary.publicMedia = { total: mediaCount };
    }

    if (canSettings) {
      const socialSetting = await SiteSetting.findOne({ where: { setting_key: 'social_links' } });
      let socialCount = 0;
      if (socialSetting && socialSetting.setting_value) {
        try {
          const links = typeof socialSetting.setting_value === 'string' ? JSON.parse(socialSetting.setting_value) : socialSetting.setting_value;
          socialCount = Object.values(links || {}).filter(v => String(v || '').trim()).length;
        } catch (_) {}
      }
      summary.socialLinks = { total: socialCount };
    }

    res.json({
      success: true,
      data: summary
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// 2. ENQUIRIES CRM
// ============================================================================
router.get('/enquiries', requirePermission('enquiries:view'), async (req, res, next) => {
  try {
    const result = await enquiryService.listEnquiries(req.query);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.get('/enquiries/export/csv', requirePermission('enquiries:export'), async (req, res, next) => {
  try {
    const enquiries = await Enquiry.findAll({ order: [['id', 'DESC']] });
    const headers = ['Reference', 'Date (IST)', 'Name', 'Email', 'Phone', 'WhatsApp', 'Service', 'Preferred Contact', 'Source', 'Consent', 'Status', 'Message'];
    
    let csv = headers.map(sanitizeCsvValue).join(',') + '\n';
    enquiries.forEach(e => {
      const row = [
        e.reference_no,
        todayIST(new Date(e.createdAt)),
        e.name,
        e.email,
        e.phone,
        e.whatsapp || '',
        e.service_interest || e.subject || '',
        e.preferred_contact_method || e.preferred_clinic || '',
        e.source || '',
        e.consent_agreed ? 'Yes' : 'No',
        e.status,
        e.message
      ];
      csv += row.map(sanitizeCsvValue).join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="spouzy_enquiries.csv"');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

router.get('/enquiries/:id', requirePermission('enquiries:view'), async (req, res, next) => {
  try {
    const enquiry = await enquiryService.getEnquiryById(req.params.id);
    res.json({ success: true, data: enquiry });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
});

router.patch('/enquiries/:id', requirePermission('enquiries:edit'), async (req, res, next) => {
  try {
    const updated = await enquiryService.updateEnquiry(req.params.id, req.body);
    await auditService.log({
      userId: req.user.id,
      action: 'ENQUIRY_UPDATE',
      entityType: 'Enquiry',
      entityId: req.params.id,
      newValues: req.body,
      req
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/enquiries/:id/notes', requirePermission('enquiries:edit'), async (req, res, next) => {
  try {
    const note = await enquiryService.addNote(req.params.id, req.user.id, req.body.note_text);
    res.status(201).json({ success: true, data: note });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ============================================================================
// 3. CLINICAL APPLICATIONS (DOCTORS & COUNSELLORS)
// ============================================================================
router.get('/clinical-applications', requirePermission('clinical_apps:view'), async (req, res, next) => {
  try {
    const result = await clinicalService.listApplications(req.query);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.get('/clinical-applications/export/csv', requirePermission('clinical_apps:export'), async (req, res, next) => {
  try {
    const apps = await ClinicalApplication.findAll({ order: [['id', 'DESC']] });
    const headers = [
      'Reference', 'Role', 'Date', 'Full Name', 'Gender', 'DOB', 'Email', 'Mobile', 
      'WhatsApp', 'Specialisation', 'Experience', 'Primary Qual', 'PG Qual', 
      'Council Name', 'Reg Number', 'Status'
    ];

    let csv = headers.map(sanitizeCsvValue).join(',') + '\n';
    apps.forEach(a => {
      const row = [
        a.reference_no,
        a.role_type,
        todayIST(new Date(a.createdAt)),
        `${a.title || ''} ${a.first_name} ${a.last_name}`.trim(),
        a.gender || '',
        a.dob || '',
        a.email,
        a.mobile,
        a.whatsapp,
        a.specialisation || '',
        a.experience_years || '',
        a.primary_qualification || '',
        a.pg_qualification || '',
        a.council_name || '',
        a.registration_number || '',
        a.status
      ];
      csv += row.map(sanitizeCsvValue).join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="spouzy_clinical_applications.csv"');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

router.get('/clinical-applications/:id', requirePermission('clinical_apps:view'), async (req, res, next) => {
  try {
    const app = await clinicalService.getApplicationById(req.params.id);
    res.json({ success: true, data: app });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
});

router.patch('/clinical-applications/:id', requirePermission('clinical_apps:edit'), async (req, res, next) => {
  try {
    const updated = await clinicalService.updateApplication(req.params.id, req.body);
    await auditService.log({
      userId: req.user.id,
      action: 'CLINICAL_APPLICATION_UPDATE',
      entityType: 'ClinicalApplication',
      entityId: req.params.id,
      newValues: req.body,
      req
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ============================================================================
// 4. CAREERS & OPENINGS
// ============================================================================
router.get('/career-openings', requirePermission('careers:view'), async (req, res, next) => {
  try {
    const openings = await careerService.listAllOpenings();
    res.json({ success: true, data: openings });
  } catch (err) {
    next(err);
  }
});

router.post('/career-openings', requirePermission('careers:edit'), async (req, res, next) => {
  try {
    const opening = await careerService.saveOpening(req.body);
    res.status(201).json({ success: true, data: opening });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.put('/career-openings/:id', requirePermission('careers:edit'), async (req, res, next) => {
  try {
    const updated = await careerService.saveOpening(req.body, req.params.id);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.get('/career-applications', requirePermission('careers:view'), async (req, res, next) => {
  try {
    const result = await careerService.listApplications(req.query);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.get('/career-applications/:id', requirePermission('careers:view'), async (req, res, next) => {
  try {
    const app = await careerService.getApplicationById(req.params.id);
    res.json({ success: true, data: app });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
});

router.patch('/career-applications/:id', requirePermission('careers:edit'), async (req, res, next) => {
  try {
    const updated = await careerService.updateApplication(req.params.id, req.body);
    await auditService.log({
      userId: req.user.id,
      action: 'CAREER_APPLICATION_UPDATE',
      entityType: 'CareerApplication',
      entityId: req.params.id,
      newValues: req.body,
      req
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ============================================================================
// 5. APPOINTMENTS & SCHEDULING CALENDAR
// ============================================================================
router.get('/appointments', requirePermission('appointments:view'), async (req, res, next) => {
  try {
    const result = await appointmentService.listAppointments(req.query);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.get('/appointments/:id', requirePermission('appointments:view'), async (req, res, next) => {
  try {
    const appt = await appointmentService.getById(req.params.id);
    res.json({ success: true, data: appt });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
});

router.patch('/appointments/:id/status', requirePermission('appointments:edit'), async (req, res, next) => {
  try {
    const { status, reason, internalNotes } = req.body;
    const updated = await appointmentService.updateStatus({
      appointmentId: req.params.id,
      newStatus: status,
      changedByUserId: req.user.id,
      reason,
      internalNotes
    });
    await auditService.log({
      userId: req.user.id,
      action: 'APPOINTMENT_STATUS_CHANGE',
      entityType: 'Appointment',
      entityId: req.params.id,
      newValues: { status, reason },
      req
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/appointments/:id/reschedule', requirePermission('appointments:reschedule'), async (req, res, next) => {
  try {
    const { newDate, newStartTime, duration, reason } = req.body;
    const updated = await appointmentService.rescheduleAppointment({
      appointmentId: req.params.id,
      newDate,
      newStartTime,
      durationMinutes: duration || 30,
      changedByUserId: req.user.id,
      reason
    });
    await auditService.log({
      userId: req.user.id,
      action: 'APPOINTMENT_RESCHEDULE',
      entityType: 'Appointment',
      entityId: req.params.id,
      newValues: { newDate, newStartTime },
      req
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Scheduling: Practitioners
router.get('/practitioners', requirePermission('practitioners:view'), async (req, res, next) => {
  try {
    const list = await Practitioner.findAll({ order: [['id', 'ASC']] });
    res.json({ success: true, data: list });
  } catch (err) {
    next(err);
  }
});

const PRACTITIONER_FIELDS = ['name', 'title', 'role_type', 'qualifications', 'bio', 'photo_url', 'email', 'phone', 'is_active'];
function pickPractitioner(body = {}) {
  const out = {};
  PRACTITIONER_FIELDS.forEach(k => { if (body[k] !== undefined) out[k] = body[k]; });
  if (out.role_type && !['doctor', 'counsellor', 'mediator'].includes(out.role_type)) {
    throw new Error('Practitioner type must be doctor, counsellor or mediator.');
  }
  if (out.photo_url) {
    const problem = require('../config/media-paths').imageProblem(out.photo_url);
    if (problem) throw new Error(problem);
  }
  return out;
}

router.post('/practitioners', requirePermission('practitioners:edit'), async (req, res, next) => {
  try {
    const data = pickPractitioner(req.body);
    if (!data.name || !data.title) throw new Error('Name and title are required.');
    const p = await Practitioner.create(data);
    // Give new practitioners the default 09:00–21:00 week so they appear in availability
    for (let day = 0; day <= 6; day++) {
      await WeeklySchedule.findOrCreate({
        where: { practitioner_id: p.id, day_of_week: day },
        defaults: { practitioner_id: p.id, day_of_week: day, open_time: '09:00', close_time: '21:00', is_working_day: true }
      });
    }
    res.status(201).json({ success: true, data: p });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.put('/practitioners/:id', requirePermission('practitioners:edit'), async (req, res, next) => {
  try {
    const p = await Practitioner.findByPk(req.params.id);
    if (!p) throw new Error('Practitioner not found');
    await p.update(pickPractitioner(req.body));
    res.json({ success: true, data: p });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Weekly working hours per practitioner (falls back to the clinic default template)
router.get('/practitioners/:id/schedule', requirePermission('practitioners:view'), async (req, res, next) => {
  try {
    const pid = parseInt(req.params.id, 10);
    const rows = await WeeklySchedule.findAll({ where: { practitioner_id: { [Op.or]: [pid, null] } } });
    const week = [];
    for (let day = 0; day <= 6; day++) {
      const own = rows.find(r => r.practitioner_id === pid && r.day_of_week === day);
      const def = rows.find(r => r.practitioner_id === null && r.day_of_week === day);
      const r = own || def;
      week.push({
        day_of_week: day,
        open_time: r ? r.open_time : '09:00',
        close_time: r ? r.close_time : '21:00',
        is_working_day: r ? !!r.is_working_day : true,
        is_custom: !!own
      });
    }
    res.json({ success: true, data: week });
  } catch (err) {
    next(err);
  }
});

router.put('/practitioners/:id/schedule', requirePermission('practitioners:edit'), async (req, res, next) => {
  try {
    const pid = parseInt(req.params.id, 10);
    const p = await Practitioner.findByPk(pid);
    if (!p) throw new Error('Practitioner not found');
    const week = Array.isArray(req.body.week) ? req.body.week : [];
    const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
    for (const d of week) {
      const day = parseInt(d.day_of_week, 10);
      if (isNaN(day) || day < 0 || day > 6) throw new Error('Invalid day of week.');
      if (d.is_working_day && (!timeRe.test(d.open_time) || !timeRe.test(d.close_time) || d.open_time >= d.close_time)) {
        throw new Error(`Day ${day}: opening time must be before closing time (HH:MM).`);
      }
      const [row] = await WeeklySchedule.findOrCreate({
        where: { practitioner_id: pid, day_of_week: day },
        defaults: { practitioner_id: pid, day_of_week: day, open_time: d.open_time || '09:00', close_time: d.close_time || '21:00', is_working_day: !!d.is_working_day }
      });
      await row.update({ open_time: d.open_time || row.open_time, close_time: d.close_time || row.close_time, is_working_day: !!d.is_working_day });
    }
    res.json({ success: true, message: 'Working hours saved.' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Services & prices
router.get('/services', requirePermission(['scheduling:view', 'practitioners:view']), async (req, res, next) => {
  try {
    const services = await Service.findAll({ order: [['sort_order', 'ASC'], ['id', 'ASC']] });
    res.json({ success: true, data: services });
  } catch (err) {
    next(err);
  }
});

router.put('/services/:id', requirePermission('scheduling:edit'), async (req, res, next) => {
  try {
    const svc = await Service.findByPk(req.params.id);
    if (!svc) throw new Error('Service not found');
    const b = req.body || {};
    const updates = {};
    ['name', 'description'].forEach(k => { if (b[k] !== undefined) updates[k] = String(b[k]).trim(); });
    if (b.is_active !== undefined) updates.is_active = !!b.is_active;
    if (b.sort_order !== undefined) updates.sort_order = parseInt(b.sort_order, 10) || 0;
    ['price_30_minor', 'price_60_minor'].forEach(k => {
      if (b[k] !== undefined) {
        const v = parseInt(b[k], 10);
        if (isNaN(v) || v < 0) throw new Error('Prices must be zero or more (in paise).');
        updates[k] = v;
      }
    });
    if (b.modes !== undefined) {
      const modes = (Array.isArray(b.modes) ? b.modes : []).filter(m => ['in-person', 'video', 'phone'].includes(m));
      if (!modes.length) throw new Error('Choose at least one consultation mode.');
      updates.modes = modes;
    }
    await svc.update(updates);
    await auditService.log({ userId: req.user.id, action: 'SERVICE_UPDATE', entityType: 'Service', entityId: req.params.id, newValues: updates, req });
    res.json({ success: true, data: svc });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Scheduling: Blocked Intervals
router.get('/schedules/blocks', requirePermission('scheduling:view'), async (req, res, next) => {
  try {
    const blocks = await BlockedInterval.findAll({ order: [['block_date', 'DESC'], ['start_time', 'ASC']] });
    res.json({ success: true, data: blocks });
  } catch (err) {
    next(err);
  }
});

router.post('/schedules/block', requirePermission('scheduling:edit'), async (req, res, next) => {
  try {
    const { practitioner_id, block_date, start_time, end_time, reason } = req.body;
    const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(block_date || ''))) throw new Error('Please choose a valid date.');
    if (!timeRe.test(String(start_time || '')) || !timeRe.test(String(end_time || '')) || start_time >= end_time) {
      throw new Error('Start time must be before end time (HH:MM).');
    }
    const block = await BlockedInterval.create({
      practitioner_id: practitioner_id || null,
      block_date,
      start_time,
      end_time,
      reason: reason || 'Blocked by administrator'
    });
    res.status(201).json({ success: true, data: block });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.delete('/schedules/blocks/:id', requirePermission('scheduling:edit'), async (req, res, next) => {
  try {
    const block = await BlockedInterval.findByPk(req.params.id);
    if (!block) throw new Error('Block not found');
    await block.destroy();
    res.json({ success: true, message: 'Block removed' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ============================================================================
// 6. CONTENT MANAGEMENT (HOMEPAGE SECTIONS, BANNERS, TIPS, BLOGS, FAQS, STORIES, SOCIAL)
// ============================================================================

// Homepage Sections
router.get('/homepage-sections', requirePermission('content:view'), async (req, res, next) => {
  try {
    const sections = await contentService.getHomepageSections({ onlyVisible: false });
    res.json({ success: true, data: sections });
  } catch (err) {
    next(err);
  }
});

router.get('/homepage-sections/:key', requirePermission('content:view'), async (req, res, next) => {
  try {
    const section = await contentService.getHomepageSection(req.params.key);
    res.json({ success: true, data: section });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
});

router.put('/homepage-sections/:key', requirePermission('content:edit'), async (req, res, next) => {
  try {
    const updated = await contentService.updateHomepageSection(req.params.key, req.body, req.user.id);
    await auditService.log({
      userId: req.user.id,
      action: 'HOMEPAGE_SECTION_UPDATE',
      entityType: 'HomepageSection',
      entityId: req.params.key,
      newValues: req.body,
      req
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/homepage-sections/:key/history', requirePermission('content:view'), async (req, res, next) => {
  try {
    const history = await contentService.getSectionHistory(req.params.key);
    res.json({ success: true, data: history });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/homepage-sections/:key/rollback', requirePermission('content:edit'), async (req, res, next) => {
  try {
    const { version } = req.body;
    if (!version) return res.status(400).json({ success: false, message: 'Version is required for rollback' });
    const restored = await contentService.rollbackSection(req.params.key, parseInt(version, 10), req.user.id);
    await auditService.log({
      userId: req.user.id,
      action: 'HOMEPAGE_SECTION_ROLLBACK',
      entityType: 'HomepageSection',
      entityId: req.params.key,
      newValues: { restored_version: version },
      req
    });
    res.json({ success: true, data: restored });
  } catch (err) {
    sendError(res, err);
  }
});

// Social Links (allowlist validated, isolated from payment secrets)
router.get('/social-links', requirePermission(['settings:content', 'content:view']), async (req, res, next) => {
  try {
    const links = await contentService.getSocialLinks();
    res.json({ success: true, data: links });
  } catch (err) {
    next(err);
  }
});

router.put('/social-links', requirePermission('settings:content'), async (req, res, next) => {
  try {
    const updated = await contentService.saveSocialLinks(req.body, req.user.id);
    await auditService.log({
      userId: req.user.id,
      action: 'SOCIAL_LINKS_UPDATE',
      entityType: 'SiteSetting',
      entityId: 'social_links',
      newValues: req.body,
      req
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    sendError(res, err);
  }
});

// Hero Banners
router.get('/hero-banners', requirePermission('content:view'), async (req, res, next) => {
  try {
    const banners = await contentService.getAllHeroBanners();
    res.json({ success: true, data: banners });
  } catch (err) {
    next(err);
  }
});

router.post('/hero-banners', requirePermission('content:edit'), async (req, res, next) => {
  try {
    const banner = await contentService.saveHeroBanner(req.body);
    res.status(201).json({ success: true, data: banner });
  } catch (err) {
    sendError(res, err);
  }
});

router.put('/hero-banners/:id', requirePermission('content:edit'), async (req, res, next) => {
  try {
    const banner = await contentService.saveHeroBanner(req.body, req.params.id);
    res.json({ success: true, data: banner });
  } catch (err) {
    sendError(res, err);
  }
});

router.delete('/hero-banners/:id', requirePermission('content:delete'), async (req, res, next) => {
  try {
    await contentService.deleteHeroBanner(req.params.id);
    res.json({ success: true, message: 'Banner deleted' });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/hero-banners/:id/duplicate', requirePermission('content:edit'), async (req, res, next) => {
  try {
    const original = await HeroBanner.findByPk(req.params.id);
    if (!original) return res.status(404).json({ success: false, message: 'Banner not found' });
    const copyData = {
      tag_eyebrow: original.tag_eyebrow,
      category_sub: original.category_sub,
      headline: `${original.headline || ''} (Copy)`.trim(),
      headline_emphasis: original.headline_emphasis,
      description: original.description,
      cta_label: original.cta_label,
      cta_url: original.cta_url,
      secondary_cta_label: original.secondary_cta_label,
      secondary_cta_url: original.secondary_cta_url,
      image_path: original.image_path,
      mobile_image_path: original.mobile_image_path,
      alt_text: original.alt_text,
      focal_point: original.focal_point,
      overlay_strength: original.overlay_strength,
      text_alignment: original.text_alignment,
      pills: original.pills,
      sort_order: (original.sort_order || 0) + 1,
      is_active: false // Created as draft
    };
    const newBanner = await HeroBanner.create(copyData);
    res.status(201).json({ success: true, data: newBanner });
  } catch (err) {
    sendError(res, err);
  }
});

// Tips
router.get('/tips', requirePermission('content:view'), async (req, res, next) => {
  try {
    const tips = await contentService.getAllTips();
    res.json({ success: true, data: tips });
  } catch (err) {
    next(err);
  }
});

router.post('/tips', requirePermission('content:edit'), async (req, res, next) => {
  try {
    const tip = await contentService.saveTip(req.body);
    res.status(201).json({ success: true, data: tip });
  } catch (err) {
    sendError(res, err);
  }
});

router.put('/tips/:id', requirePermission('content:edit'), async (req, res, next) => {
  try {
    const tip = await contentService.saveTip(req.body, req.params.id);
    res.json({ success: true, data: tip });
  } catch (err) {
    sendError(res, err);
  }
});

router.delete('/tips/:id', requirePermission('content:delete'), async (req, res, next) => {
  try {
    await contentService.deleteTip(req.params.id);
    res.json({ success: true, message: 'Tip deleted' });
  } catch (err) {
    sendError(res, err);
  }
});

// Blogs & Categories
router.get('/blog-categories', requirePermission('blogs:view'), async (req, res, next) => {
  try {
    const cats = await contentService.getBlogCategories();
    res.json({ success: true, data: cats });
  } catch (err) {
    next(err);
  }
});

router.post('/blog-categories', requirePermission('blogs:edit'), async (req, res, next) => {
  try {
    const cat = await contentService.saveBlogCategory(req.body);
    res.status(201).json({ success: true, data: cat });
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/blogs', requirePermission('blogs:view'), async (req, res, next) => {
  try {
    const result = await contentService.getAllBlogsAdmin(req.query);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/blogs', requirePermission('blogs:edit'), async (req, res, next) => {
  try {
    const blog = await contentService.saveBlogArticle(req.body);
    res.status(201).json({ success: true, data: blog });
  } catch (err) {
    sendError(res, err);
  }
});

router.put('/blogs/:id', requirePermission('blogs:edit'), async (req, res, next) => {
  try {
    const blog = await contentService.saveBlogArticle(req.body, req.params.id);
    res.json({ success: true, data: blog });
  } catch (err) {
    sendError(res, err);
  }
});

router.delete('/blogs/:id', requirePermission('blogs:delete'), async (req, res, next) => {
  try {
    await contentService.deleteBlogArticle(req.params.id);
    res.json({ success: true, message: 'Article deleted' });
  } catch (err) {
    sendError(res, err);
  }
});

// FAQs (see faq.service: FAQ page, homepage questions, "What We Do" pages, Excel upload/download)
const faqService = require('../services/faq.service');
function logAudit(req, action, entityType, entityId, newValues) {
  return auditService.log({ userId: req.user.id, action, entityType, entityId, newValues, req }).catch(() => {});
}
const multer = require('multer');
const faqUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 }
});
const faqHandle = (fn, status = 200) => async (req, res) => {
  try {
    const data = await fn(req);
    res.status(status).json({ success: true, data });
  } catch (err) {
    sendError(res, err);
  }
};

router.get('/faqs', requirePermission('moderation:view'), faqHandle(() => faqService.listAdmin()));
router.get('/faqs/meta', requirePermission('moderation:view'), faqHandle(() => faqService.meta()));

function sendXlsx(res, buf, name) {
  res.set({
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${name}"`,
    'Cache-Control': 'no-store'
  });
  res.send(buf);
}

router.get('/faqs/template', requirePermission('moderation:view'), (req, res) => {
  try {
    sendXlsx(res, faqService.templateXlsx(), 'SPOUZY-FAQ-upload-sample.xlsx');
  } catch (err) {
    sendError(res, err, 500);
  }
});

router.get('/faqs/export', requirePermission('moderation:view'), async (req, res) => {
  try {
    const stamp = new Date().toISOString().slice(0, 10);
    sendXlsx(res, await faqService.exportXlsx(), `SPOUZY-FAQs-${stamp}.xlsx`);
  } catch (err) {
    sendError(res, err, 500);
  }
});

router.post('/faqs/import', requirePermission('moderation:edit'), (req, res) => {
  faqUpload.single('file')(req, res, async (upErr) => {
    try {
      if (upErr) {
        throw Object.assign(new Error(upErr.code === 'LIMIT_FILE_SIZE' ? 'The file is larger than 8 MB. Split it into two files.' : 'The file could not be uploaded.'), { status: 400 });
      }
      if (!req.file) throw Object.assign(new Error('Please choose an Excel (.xlsx) or CSV file.'), { status: 400 });
      const mode = (req.body && req.body.mode) === 'apply' ? 'apply' : 'preview';
      const strategy = (req.body && req.body.strategy) === 'replace' ? 'replace' : 'merge';
      const result = await faqService.importFile(req.file.buffer, req.file.originalname, { mode, strategy });
      if (mode === 'apply') {
        await logAudit(req, 'FAQ_IMPORT', 'Faq', null, { file: req.file.originalname, strategy, created: result.create, updated: result.update, removed: result.remove });
      }
      res.json({ success: true, data: result });
    } catch (err) {
      sendError(res, err);
    }
  });
});

router.post('/faqs/bulk', requirePermission('moderation:edit'), faqHandle(async req => {
  const result = await faqService.bulk(req.body || {});
  await logAudit(req, 'FAQ_BULK', 'Faq', null, { action: (req.body || {}).action, count: result.changed });
  return result;
}));
router.post('/faqs/reorder', requirePermission('moderation:edit'), faqHandle(req => faqService.reorder(req.body || {})));
router.post('/faqs', requirePermission('moderation:edit'), faqHandle(req => faqService.save(req.body || {}), 201));
router.put('/faqs/:id', requirePermission('moderation:edit'), faqHandle(req => faqService.save(req.body || {}, parseInt(req.params.id, 10) || 0)));
router.delete('/faqs/:id', requirePermission('moderation:edit'), faqHandle(req => faqService.remove(parseInt(req.params.id, 10) || 0)));

// Visitor Questions Moderation
router.get('/visitor-questions', requirePermission('moderation:view'), async (req, res, next) => {
  try {
    const result = await contentService.getVisitorQuestionsAdmin(req.query);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/visitor-questions/:id/answer', requirePermission('moderation:edit'), async (req, res, next) => {
  try {
    const { answer_html, publish_to_faq, category } = req.body;
    const q = await contentService.answerAndPublishQuestion(req.params.id, {
      answer_html,
      publish_to_faq: !!publish_to_faq,
      category,
      answerer_user_id: req.user.id
    });
    res.json({ success: true, data: q });
  } catch (err) {
    sendError(res, err);
  }
});

router.patch('/visitor-questions/:id', requirePermission('moderation:edit'), async (req, res) => {
  try {
    const q = await contentService.moderateQuestion(req.params.id, req.body || {});
    res.json({ success: true, data: q });
  } catch (err) {
    sendError(res, err);
  }
});

// Client stories (see story.service): approve, edit, hide/show, delete, add, homepage order
const storyService = require('../services/story.service');
router.get('/stories', requirePermission('moderation:view'), faqHandle(req => storyService.adminList({ state: String(req.query.state || req.query.status || 'pending'), q: req.query.q })));
router.get('/stories/:id', requirePermission('moderation:view'), faqHandle(req => storyService.adminGet(parseInt(req.params.id, 10) || 0)));
router.post('/stories/reorder', requirePermission('moderation:edit'), faqHandle(req => storyService.adminReorder((req.body || {}).ids)));
router.post('/stories', requirePermission('moderation:edit'), faqHandle(async req => {
  const story = await storyService.adminCreate(req.body || {});
  await logAudit(req, 'STORY_CREATE', 'VisitorStory', story.id, {});
  return story;
}, 201));
router.put('/stories/:id', requirePermission('moderation:edit'), faqHandle(async req => {
  const story = await storyService.adminUpdate(parseInt(req.params.id, 10) || 0, req.body || {});
  await logAudit(req, 'STORY_EDIT', 'VisitorStory', story.id, {});
  return story;
}));
router.patch('/stories/:id', requirePermission('moderation:edit'), faqHandle(async req => {
  const story = await storyService.adminModerate(parseInt(req.params.id, 10) || 0, req.body || {});
  await logAudit(req, 'STORY_' + String((req.body || {}).action || (req.body || {}).status || 'NOTE').toUpperCase(), 'VisitorStory', story.id, {});
  return story;
}));
router.delete('/stories/:id', requirePermission('moderation:edit'), faqHandle(async req => {
  const r = await storyService.adminRemove(parseInt(req.params.id, 10) || 0);
  await logAudit(req, 'STORY_DELETE', 'VisitorStory', r.id, {});
  return r;
}));

// Student / ex-servicemen ID verification (verification.service)
const verificationService = require('../services/verification.service');
router.get('/verifications', requirePermission('verifications:view'), faqHandle(req => verificationService.adminList({ state: String(req.query.state || 'pending'), q: req.query.q })));
router.get('/verifications/:id', requirePermission('verifications:view'), faqHandle(req => verificationService.adminGet(parseInt(req.params.id, 10) || 0)));
router.post('/verifications/:id/approve', requirePermission('verifications:edit'), faqHandle(async req => {
  const v = await verificationService.approve(parseInt(req.params.id, 10) || 0, req.body || {}, req.user.id);
  await logAudit(req, 'ID_VERIFICATION_APPROVE', 'IdVerification', v.id, { category: v.category, expiry_date: v.expiry_date });
  return v;
}));
router.post('/verifications/:id/reject', requirePermission('verifications:edit'), faqHandle(async req => {
  const v = await verificationService.reject(parseInt(req.params.id, 10) || 0, req.body || {}, req.user.id);
  await logAudit(req, 'ID_VERIFICATION_REJECT', 'IdVerification', v.id, { category: v.category });
  return v;
}));
router.post('/verifications/:id/reminded', requirePermission('verifications:edit'), faqHandle(req => verificationService.markReminded(parseInt(req.params.id, 10) || 0)));

// Public Media Assets Library (Public assets only - strictly separate from private clinical files)
router.get('/media', requirePermission('media:view'), async (req, res, next) => {
  try {
    const assets = await MediaAsset.findAll({
      where: { storage_type: 'public' },
      order: [['id', 'DESC']]
    });
    res.json({ success: true, data: assets.map(a => ({ ...a.toJSON(), url: `/media/public/${a.stored_filename}` })) });
  } catch (err) {
    next(err);
  }
});

router.post('/media', requirePermission('media:edit'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) throw Object.assign(new Error('Please choose an image to upload.'), { status: 400 });
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(req.file.mimetype)) {
      throw Object.assign(new Error('Only JPG, PNG or WebP images can be uploaded to the public library.'), { status: 400 });
    }
    const asset = await uploadService.storeFile({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      isPrivate: false,
      userId: req.user.id,
      altText: req.body.alt_text || null
    });
    res.status(201).json({ success: true, data: { ...asset.toJSON(), url: `/media/public/${asset.stored_filename}` } });
  } catch (err) {
    sendError(res, err);
  }
});

// ============================================================================
// 7. SITE SETTINGS & PAYMENT GATEWAY CONFIG
// ============================================================================

// Site Settings: Editor can view/edit public settings, but gateway secrets are hidden
router.get('/settings', requirePermission(['settings:content', 'settings:gateway', 'admin']), async (req, res, next) => {
  try {
    const settings = await contentService.getAllSettingsAdmin();
    // Filter out private or sensitive keys if user does not have gateway/admin permissions
    const canSeeSecrets = hasPermission(req.user, 'settings:gateway') || req.user.role?.slug === 'admin';
    const filtered = settings.filter(s => canSeeSecrets || s.is_public);
    res.json({ success: true, data: filtered });
  } catch (err) {
    next(err);
  }
});

router.put('/settings', requirePermission(['settings:content', 'admin']), async (req, res, next) => {
  try {
    // If not admin, sanitize out sensitive keys
    const canEditSecrets = hasPermission(req.user, 'settings:gateway') || req.user.role?.slug === 'admin';
    const payload = { ...req.body };
    if (!canEditSecrets) {
      delete payload.razorpay_secret;
      delete payload.webhook_secret;
      delete payload.gateway_mode;
    }
    const updated = await contentService.updateSettings(payload);
    if (payload.booking_requires_account !== undefined) require('./appointment.routes').resetBookingSettingCache();
    await auditService.log({
      userId: req.user.id,
      action: 'SITE_SETTINGS_UPDATE',
      entityType: 'SiteSetting',
      newValues: payload,
      req
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/gateway-config', requirePermission('settings:gateway'), async (req, res, next) => {
  try {
    const config = await paymentService.getGatewayConfigForAdmin();
    res.json({ success: true, data: config });
  } catch (err) {
    next(err);
  }
});

router.put('/gateway-config', requirePermission('settings:gateway'), async (req, res, next) => {
  try {
    const config = await paymentService.saveGatewayConfig(req.body || {});
    await auditService.log({
      userId: req.user.id,
      action: 'GATEWAY_CONFIG_UPDATE',
      entityType: 'PaymentGatewayConfig',
      newValues: { mode: req.body.mode, provider: req.body.provider, key_id: req.body.key_id, is_active: req.body.is_active },
      req
    });
    res.json({ success: true, data: config });
  } catch (err) {
    sendError(res, err);
  }
});

// ============================================================================
// 7b. CUSTOMER PACKAGES, ORDERS & CUSTOMERS
// ============================================================================
const shopService = require('../services/shop.service');

router.get('/packages', requirePermission(['packages:view', 'orders:view']), async (req, res, next) => {
  try {
    res.json({ success: true, data: await shopService.listPackagesAdmin() });
  } catch (err) {
    next(err);
  }
});

router.post('/packages', requirePermission('packages:edit'), async (req, res) => {
  try {
    const pkg = await shopService.savePackage(req.body || {});
    await auditService.log({ userId: req.user.id, action: 'PACKAGE_CREATE', entityType: 'Package', entityId: String(pkg.id), newValues: req.body, req });
    require('../services/chat.service').invalidate();
    res.status(201).json({ success: true, data: pkg });
  } catch (err) {
    sendError(res, err);
  }
});

router.put('/packages/:id', requirePermission('packages:edit'), async (req, res) => {
  try {
    const pkg = await shopService.savePackage(req.body || {}, req.params.id);
    await auditService.log({ userId: req.user.id, action: 'PACKAGE_UPDATE', entityType: 'Package', entityId: req.params.id, newValues: req.body, req });
    require('../services/chat.service').invalidate();
    res.json({ success: true, data: pkg });
  } catch (err) {
    sendError(res, err);
  }
});

// Offers (card images in the website popup and on package cards)
const offerService = require('../services/offer.service');

router.get('/offers', requirePermission('offers:view'), async (req, res, next) => {
  try {
    res.json({ success: true, data: await offerService.listAdmin() });
  } catch (err) {
    next(err);
  }
});

router.post('/offers', requirePermission('offers:edit'), async (req, res) => {
  try {
    const offer = await offerService.save(req.body || {}, null, { canSetPrice: hasPermission(req.user, 'packages:edit') });
    await auditService.log({ userId: req.user.id, action: 'OFFER_CREATE', entityType: 'Offer', entityId: String(offer.id), newValues: req.body, req });
    require('../services/chat.service').invalidate();
    res.status(201).json({ success: true, data: offer });
  } catch (err) {
    sendError(res, err);
  }
});

router.put('/offers/:id', requirePermission('offers:edit'), async (req, res) => {
  try {
    const offer = await offerService.save(req.body || {}, req.params.id, { canSetPrice: hasPermission(req.user, 'packages:edit') });
    await auditService.log({ userId: req.user.id, action: 'OFFER_UPDATE', entityType: 'Offer', entityId: req.params.id, newValues: req.body, req });
    require('../services/chat.service').invalidate();
    res.json({ success: true, data: offer });
  } catch (err) {
    sendError(res, err);
  }
});

router.delete('/offers/:id', requirePermission('offers:edit'), async (req, res) => {
  try {
    const result = await offerService.remove(req.params.id);
    await auditService.log({ userId: req.user.id, action: 'OFFER_DELETE', entityType: 'Offer', entityId: req.params.id, req });
    require('../services/chat.service').invalidate();
    res.json({ success: true, data: result });
  } catch (err) {
    sendError(res, err);
  }
});

// Bills (created automatically after a payment; staff check the details and send them)
const billingService = require('../services/billing.service');

router.get('/invoices', requirePermission('orders:view'), async (req, res, next) => {
  try {
    res.json({ success: true, data: await billingService.listAdmin(req.query) });
  } catch (err) {
    next(err);
  }
});

router.get('/invoices/:id', requirePermission('orders:view'), async (req, res) => {
  try {
    res.json({ success: true, data: await billingService.getAdmin(req.params.id) });
  } catch (err) {
    sendError(res, err);
  }
});

router.put('/invoices/:id', requirePermission('orders:edit'), async (req, res) => {
  try {
    const data = await billingService.updateDetails(req.params.id, req.body || {});
    await auditService.log({ userId: req.user.id, action: 'BILL_DETAILS_UPDATE', entityType: 'Invoice', entityId: req.params.id, newValues: req.body, req });
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/invoices/:id/send', requirePermission('orders:edit'), async (req, res) => {
  try {
    const data = await billingService.send(req.params.id, req.user);
    await auditService.log({ userId: req.user.id, action: 'BILL_SEND', entityType: 'Invoice', entityId: req.params.id, req });
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/package-orders/:id/invoice', requirePermission('orders:edit'), async (req, res) => {
  try {
    const inv = await billingService.createForPackageOrder(req.params.id);
    if (!inv) return res.status(400).json({ success: false, message: 'A bill can be created only for a paid order with an amount.' });
    res.status(201).json({ success: true, data: { id: inv.id, invoice_no: inv.invoice_no } });
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/billing-profiles', requirePermission('orders:view'), async (req, res, next) => {
  try {
    res.json({ success: true, data: await billingService.listProfiles() });
  } catch (err) {
    next(err);
  }
});

router.post('/billing-profiles/:id/default', requirePermission('orders:edit'), async (req, res) => {
  try {
    res.json({ success: true, data: await billingService.setDefaultProfile(req.params.id) });
  } catch (err) {
    sendError(res, err);
  }
});

router.delete('/billing-profiles/:id', requirePermission('orders:edit'), async (req, res) => {
  try {
    const data = await billingService.deleteProfile(req.params.id);
    await auditService.log({ userId: req.user.id, action: 'BILLING_PROFILE_DELETE', entityType: 'BillingProfile', entityId: req.params.id, req });
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err);
  }
});

// Notifications (bell): every staff member sees the events their permissions allow
const notificationService = require('../services/notification.service');

router.get('/notifications', async (req, res, next) => {
  try {
    res.json({ success: true, data: await notificationService.list(req.user, { limit: req.query.limit, beforeId: req.query.before, category: req.query.category, unreadOnly: req.query.unread === '1' || req.query.unread === 'true' }) });
  } catch (err) {
    next(err);
  }
});

router.get('/notifications/summary', async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: await notificationService.summary(req.user) });
  } catch (err) {
    next(err);
  }
});

router.post('/notifications/read', async (req, res, next) => {
  try {
    const b = req.body || {};
    res.json({ success: true, data: await notificationService.markRead(req.user, { ids: b.ids, all: b.all === true }) });
  } catch (err) {
    next(err);
  }
});

router.get('/package-orders', requirePermission('orders:view'), async (req, res, next) => {
  try {
    res.json({ success: true, data: await shopService.listOrdersAdmin(req.query) });
  } catch (err) {
    next(err);
  }
});

router.patch('/package-orders/:id', requirePermission('orders:edit'), async (req, res) => {
  try {
    const order = await shopService.updateOrderAdmin(req.params.id, req.body || {});
    await auditService.log({ userId: req.user.id, action: 'PACKAGE_ORDER_UPDATE', entityType: 'PackageOrder', entityId: req.params.id, newValues: req.body, req });
    res.json({ success: true, data: order });
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/customers', requirePermission('orders:view'), async (req, res, next) => {
  try {
    const activityService = require('../services/activity.service');
    const data = await shopService.listCustomersAdmin(req.query);
    const lastSeen = await activityService.lastSeenFor(data.customers.map(c => c.id));
    const todayStart = istDayStartUtc(todayIST());
    data.customers = data.customers.map(c => {
      const seen = lastSeen[c.id] ? new Date(lastSeen[c.id]) : null;
      return { ...c, last_seen: seen, active_today: !!seen && seen >= todayStart };
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// What a customer did on the website (pages, buttons, logins, bookings, orders)
router.get('/customers/:id/activity', requirePermission('orders:view'), async (req, res, next) => {
  try {
    const activityService = require('../services/activity.service');
    const user = await User.findByPk(req.params.id, { attributes: ['id', 'first_name', 'last_name', 'email', 'phone', 'createdAt', 'last_login_at'] });
    if (!user) return res.status(404).json({ success: false, message: 'Customer not found' });
    const events = await activityService.listForUser(user.id, { days: req.query.days || 30 });
    const appointments = await Appointment.findAll({
      where: { user_id: user.id },
      include: [{ model: Service, as: 'service', attributes: ['name'] }],
      order: [['appointment_date', 'DESC'], ['start_time', 'DESC']],
      limit: 50
    });
    res.json({
      success: true,
      data: {
        customer: { id: user.id, name: `${user.first_name || ''} ${user.last_name || ''}`.trim(), email: user.email, phone: user.phone, joined: user.createdAt, last_login_at: user.last_login_at },
        events,
        appointments: appointments.map(a => ({ id: a.id, reference_no: a.reference_no, date: a.appointment_date, start_time: a.start_time, service: a.service ? a.service.name : null, status: a.status, booking_type: a.booking_type, payment_status: a.payment_status }))
      }
    });
  } catch (err) {
    next(err);
  }
});

// Customers active on a day (default today, IST)
router.get('/customer-activity', requirePermission('orders:view'), async (req, res, next) => {
  try {
    const activityService = require('../services/activity.service');
    const day = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.day || '')) ? req.query.day : todayIST();
    res.json({ success: true, data: { day, customers: await activityService.activeOn(day) } });
  } catch (err) {
    next(err);
  }
});

router.patch('/customers/:id', requirePermission('orders:edit'), async (req, res) => {
  try {
    const b = req.body || {};
    const result = await shopService.updateCustomerAdmin(req.params.id, { is_active: b.is_active, password: b.password });
    await auditService.log({ userId: req.user.id, action: b.password ? 'CUSTOMER_PASSWORD_RESET' : 'CUSTOMER_STATUS_UPDATE', entityType: 'User', entityId: req.params.id, newValues: { is_active: b.is_active, password: b.password ? '[RESET]' : undefined }, req });
    res.json({ success: true, data: result });
  } catch (err) {
    sendError(res, err);
  }
});

// ============================================================================
// 7c. WEBSITE CHAT ASSISTANT (transcripts and questions it could not answer)
// ============================================================================
router.get('/chats', requirePermission('enquiries:view'), async (req, res, next) => {
  try {
    const chatService = require('../services/chat.service');
    res.json({ success: true, data: await chatService.listConversations({ page: req.query.page, limit: req.query.limit, unansweredOnly: req.query.unanswered, search: req.query.search }) });
  } catch (err) {
    next(err);
  }
});

router.get('/chats/:id', requirePermission('enquiries:view'), async (req, res) => {
  try {
    const chatService = require('../services/chat.service');
    res.json({ success: true, data: await chatService.getConversation(req.params.id) });
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/chat-unanswered', requirePermission('enquiries:view'), async (req, res, next) => {
  try {
    const chatService = require('../services/chat.service');
    res.json({ success: true, data: await chatService.unanswered({ days: req.query.days }) });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// 8. USERS, ROLES & AUDIT LOGS (ADMIN ONLY)
// ============================================================================
router.get('/users', requireRole(['admin']), async (req, res, next) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'email', 'phone', 'first_name', 'last_name', 'is_active', 'createdAt', 'last_login_at', 'custom_permissions'],
      include: [{ model: Role, as: 'role', attributes: ['id', 'name', 'slug', 'permissions'] }],
      order: [['id', 'ASC']]
    });
    res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
});

router.post('/users', requireRole(['admin']), async (req, res, next) => {
  try {
    const { name, email, phone, password, role_id } = req.body;
    const { hashPassword } = require('../config/security');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email))) throw new Error('A valid email is required.');
    if (!password || String(password).length < 8) throw new Error('Password must be at least 8 characters.');
    const role = await Role.findByPk(parseInt(role_id, 10));
    if (!role) throw new Error('Please choose a valid role.');
    if (role.slug === 'customer') throw new Error('Staff accounts cannot use the customer role.');
    const password_hash = await hashPassword(password);
    const nameParts = (name || 'Staff User').trim().split(/\s+/);
    const first_name = nameParts[0] || 'Staff';
    const last_name = nameParts.slice(1).join(' ') || 'Member';
    const user = await User.create({
      first_name,
      last_name,
      email: email.toLowerCase(),
      phone,
      password_hash,
      role_id: role.id,
      is_active: true,
      must_change_password: true
    });
    await auditService.log({ userId: req.user.id, action: 'USER_CREATE', entityType: 'User', entityId: String(user.id), newValues: { email: user.email, role: role.slug }, req });
    res.status(201).json({
      success: true,
      data: { id: user.id, name: `${user.first_name} ${user.last_name}`, email: user.email }
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Edit staff user: name, phone, role, active flag, optional password reset
router.put('/users/:id', requireRole(['admin']), async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, { include: [{ model: Role, as: 'role' }] });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const b = req.body || {};
    const updates = {};
    if (b.name !== undefined) {
      const parts = String(b.name).trim().split(/\s+/);
      updates.first_name = parts[0] || user.first_name;
      updates.last_name = parts.slice(1).join(' ') || user.last_name;
    }
    if (b.phone !== undefined) updates.phone = String(b.phone).trim();
    if (b.role_id !== undefined) {
      const role = await Role.findByPk(parseInt(b.role_id, 10));
      if (!role || role.slug === 'customer') throw new Error('Please choose a valid staff role.');
      if (user.id === req.user.id && role.slug !== 'admin') throw new Error('You cannot remove your own administrator role.');
      updates.role_id = role.id;
    }
    if (b.is_active !== undefined) {
      if (user.id === req.user.id && !b.is_active) throw new Error('You cannot deactivate your own account.');
      updates.is_active = !!b.is_active;
    }
    if (b.password) {
      if (String(b.password).length < 8) throw new Error('Password must be at least 8 characters.');
      const { hashPassword } = require('../config/security');
      updates.password_hash = await hashPassword(String(b.password));
      updates.must_change_password = user.id !== req.user.id;
    }
    await user.update(updates);
    if (updates.is_active === false || updates.password_hash) {
      // End existing sessions when an account is disabled or its password is reset
      const { Session } = require('../models');
      await Session.destroy({ where: { user_id: user.id } });
    }
    await auditService.log({ userId: req.user.id, action: 'USER_UPDATE', entityType: 'User', entityId: String(user.id), newValues: { ...b, password: b.password ? '[RESET]' : undefined }, req });
    res.json({ success: true, data: { id: user.id, email: user.email, is_active: user.is_active, role_id: user.role_id } });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.get('/permissions', requireRole(['admin']), (req, res) => {
  res.json({ success: true, data: ALL_PERMISSIONS });
});

router.get('/roles', requireRole(['admin']), async (req, res, next) => {
  try {
    const roles = await Role.findAll({ order: [['id', 'ASC']] });
    res.json({ success: true, data: roles });
  } catch (err) {
    next(err);
  }
});

router.put('/roles/:id', requireRole(['admin']), async (req, res, next) => {
  try {
    const role = await Role.findByPk(req.params.id);
    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });
    if (role.slug === 'admin') {
      return res.status(400).json({ success: false, message: 'Administrator role permissions cannot be altered' });
    }
    const perms = Array.isArray(req.body.permissions) ? req.body.permissions.filter(p => ALL_PERMISSIONS.includes(p)) : null;
    if (!perms) throw new Error('Permissions must be a list.');
    await role.update({ permissions: perms });
    await auditService.log({ userId: req.user.id, action: 'ROLE_PERMISSIONS_UPDATE', entityType: 'Role', entityId: String(role.id), newValues: { permissions: perms }, req });
    res.json({ success: true, data: role });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.put('/users/:id/permissions', requireRole(['admin']), async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.id === req.user.id) {
      return res.status(400).json({ success: false, message: 'Administrators cannot alter their own permission overrides' });
    }
    await user.update({ custom_permissions: req.body.custom_permissions });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.get('/audit-logs', requireRole(['admin']), async (req, res, next) => {
  try {
    const logs = await auditService.listLogs(req.query);
    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
