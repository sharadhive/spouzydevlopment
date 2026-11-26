const crypto = require('crypto');
const { CareerOpening, CareerApplication, MediaAsset, User } = require('../models');
const { Op } = require('sequelize');
const { createValidator, str, isTrue } = require('../config/validation');

const CAREER_STATUSES = ['submitted', 'under_review', 'interview_scheduled', 'offered', 'rejected'];

class CareerService {
  /**
   * Public: List active openings
   */
  async listActiveOpenings() {
    return CareerOpening.findAll({
      where: { is_active: true },
      order: [['sort_order', 'ASC'], ['id', 'ASC']]
    });
  }

  /**
   * Public: Get single opening by slug
   */
  async getOpeningBySlug(slug) {
    const opening = await CareerOpening.findOne({
      where: { slug, is_active: true }
    });
    if (!opening) throw new Error('Job opening not found');
    return opening;
  }

  /**
   * Public: validate a career application before any file is stored.
   * Throws ValidationError (400) with per-field errors.
   */
  validateApplication(data, file) {
    const v = createValidator(data);
    v.required('role_title', 'Position')
      .required('full_name', 'Full name', { min: 2, max: 150 })
      .email('email')
      .phone('mobile', 'Mobile number')
      .phone('whatsapp', 'WhatsApp number')
      .required('city', 'City', { max: 100 })
      .required('experience_level', 'Experience level')
      .required('skills', 'Skills')
      .required('notice_period', 'Notice period')
      .required('statement_of_purpose', 'Why you want to join', { min: 20 })
      .consent('consent', 'Consent to the privacy policy')
      .custom('resume', !!file, 'Please attach your resume (PDF, DOC or DOCX, up to 10 MB).');
    if (file) {
      const okTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      v.custom('resume', okTypes.includes(file.mimetype), 'Resume must be a PDF, DOC or DOCX file.');
    }
    if (data.portfolio_url && str(data.portfolio_url)) {
      v.custom('portfolio_url', /^https?:\/\/\S+$/i.test(str(data.portfolio_url)), 'Portfolio link must start with http:// or https://');
    }
    v.throwIfErrors();
  }

  /**
   * Public: return an application submitted moments ago by the same person (double-click guard)
   */
  async findRecentDuplicate(data) {
    const since = new Date(Date.now() - 15 * 60 * 1000);
    return CareerApplication.findOne({
      where: {
        email: str(data.email).toLowerCase(),
        role_title: str(data.role_title),
        createdAt: { [Op.gte]: since }
      },
      order: [['id', 'DESC']]
    });
  }

  /**
   * Public: Submit career application with resume (call validateApplication first)
   */
  async submitApplication(data, resumeAssetId) {
    let careerOpeningId = data.career_opening_id ? parseInt(data.career_opening_id, 10) : null;
    if (careerOpeningId) {
      const opening = await CareerOpening.findByPk(careerOpeningId);
      if (!opening) careerOpeningId = null;
    }
    if (!careerOpeningId && data.role_title) {
      const opening = await CareerOpening.findOne({ where: { title: str(data.role_title) } });
      if (opening) careerOpeningId = opening.id;
    }

    const randPart = crypto.randomBytes(3).toString('hex').toUpperCase();
    const referenceNo = `SP-CAR-${randPart}`;

    const application = await CareerApplication.create({
      reference_no: referenceNo,
      career_opening_id: careerOpeningId,
      role_title: str(data.role_title) || 'General Application',
      full_name: str(data.full_name),
      email: str(data.email).toLowerCase(),
      mobile: str(data.mobile),
      whatsapp: str(data.whatsapp) || str(data.mobile),
      city: str(data.city),
      experience_level: str(data.experience_level),
      current_role: str(data.current_role) || null,
      highest_qualification: str(data.highest_qualification) || null,
      skills: str(data.skills),
      portfolio_url: str(data.portfolio_url) || null,
      notice_period: str(data.notice_period),
      expected_compensation: str(data.expected_compensation) || 'Negotiable',
      statement_of_purpose: str(data.statement_of_purpose),
      resume_asset_id: resumeAssetId,
      consent_agreed: isTrue(data.consent),
      status: 'submitted'
    });

    await require('./notification.service').notify('career_application', {
      title: `New job application: ${application.full_name}`,
      message: `${application.role_title || 'Open application'} · ${application.email} · ${application.reference_no}`,
      link: '/careers',
      entityType: 'CareerApplication',
      entityId: application.id
    });

    return {
      id: application.id,
      referenceNo: application.reference_no,
      roleTitle: application.role_title,
      fullName: application.full_name,
      email: application.email,
      whatsapp: application.whatsapp,
      createdAt: application.createdAt
    };
  }

  /**
   * Admin: List openings (all, including inactive)
   */
  async listAllOpenings() {
    return CareerOpening.findAll({
      order: [['sort_order', 'ASC'], ['id', 'ASC']],
      include: [{ model: CareerApplication, as: 'applications', attributes: ['id'] }]
    });
  }

  /**
   * Admin: Create or update opening
   */
  async saveOpening(data, id = null) {
    if (!data.title || !data.department || !data.summary) {
      throw new Error('Title, department, and summary are required');
    }

    const slug = data.slug || data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    if (id) {
      const opening = await CareerOpening.findByPk(id);
      if (!opening) throw new Error('Opening not found');
      return opening.update({
        title: data.title,
        department: data.department,
        slug,
        summary: data.summary,
        responsibilities: Array.isArray(data.responsibilities) ? data.responsibilities : [],
        required_skills: Array.isArray(data.required_skills) ? data.required_skills : [],
        preferred_background: Array.isArray(data.preferred_background) ? data.preferred_background : [],
        employment_type: data.employment_type || 'Full-time',
        location: data.location || 'Discussed during selection',
        salary_notes: data.salary_notes || 'Discussed during selection process',
        is_active: data.is_active !== undefined ? data.is_active : true,
        sort_order: data.sort_order !== undefined ? parseInt(data.sort_order, 10) : 0
      });
    }

    return CareerOpening.create({
      title: data.title,
      department: data.department,
      slug,
      summary: data.summary,
      responsibilities: Array.isArray(data.responsibilities) ? data.responsibilities : [],
      required_skills: Array.isArray(data.required_skills) ? data.required_skills : [],
      preferred_background: Array.isArray(data.preferred_background) ? data.preferred_background : [],
      employment_type: data.employment_type || 'Full-time',
      location: data.location || 'Discussed during selection',
      salary_notes: data.salary_notes || 'Discussed during selection process',
      is_active: data.is_active !== undefined ? data.is_active : true,
      sort_order: data.sort_order !== undefined ? parseInt(data.sort_order, 10) : 0
    });
  }

  /**
   * Admin: List applications
   */
  async listApplications({ page = 1, limit = 20, openingId, status, search }) {
    const where = {};
    if (openingId) where.career_opening_id = openingId;
    if (status) where.status = status;
    if (search) {
      where[Op.or] = [
        { reference_no: { [Op.like]: `%${search}%` } },
        { full_name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { mobile: { [Op.like]: `%${search}%` } },
        { role_title: { [Op.like]: `%${search}%` } }
      ];
    }

    const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const { count, rows } = await CareerApplication.findAndCountAll({
      where,
      limit: parseInt(limit, 10),
      offset,
      order: [['id', 'DESC']],
      include: [
        { model: CareerOpening, as: 'opening', attributes: ['id', 'title', 'department'] },
        { model: MediaAsset, as: 'resume', attributes: ['id', 'original_name', 'mime_type', 'file_size'] },
        { model: User, as: 'assigned_to', attributes: ['id', 'first_name', 'last_name', 'email'] }
      ]
    });

    return {
      total: count,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(count / limit),
      applications: rows
    };
  }

  /**
   * Admin: Get application detail
   */
  async getApplicationById(id) {
    const app = await CareerApplication.findByPk(id, {
      include: [
        { model: CareerOpening, as: 'opening' },
        { model: MediaAsset, as: 'resume' },
        { model: User, as: 'assigned_to', attributes: ['id', 'first_name', 'last_name', 'email'] }
      ]
    });
    if (!app) throw new Error('Application not found');
    return app;
  }

  /**
   * Admin: Update application status or notes
   */
  async updateApplication(id, { status, assigned_to_user_id, internal_notes }) {
    const app = await CareerApplication.findByPk(id);
    if (!app) throw new Error('Application not found');

    const updates = {};
    if (status) {
      if (!CAREER_STATUSES.includes(status)) {
        throw new Error(`Invalid status "${status}". Allowed: ${CAREER_STATUSES.join(', ')}`);
      }
      updates.status = status;
    }
    if (assigned_to_user_id !== undefined) updates.assigned_to_user_id = assigned_to_user_id;
    if (internal_notes !== undefined) updates.internal_notes = internal_notes;

    await app.update(updates);
    return app;
  }
}

module.exports = new CareerService();
module.exports.CAREER_STATUSES = CAREER_STATUSES;
