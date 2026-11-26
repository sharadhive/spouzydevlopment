const crypto = require('crypto');
const { ClinicalApplication, MediaAsset, User } = require('../models');
const { Op } = require('sequelize');
const { createValidator, str, isTrue } = require('../config/validation');

const CLINICAL_STATUSES = ['submitted', 'under_review', 'interview_scheduled', 'approved', 'rejected'];

class ClinicalService {
  /**
   * Validate a doctor/counsellor application (fields + files) before storing anything.
   */
  validateApplication(data, files = {}) {
    const roleType = str(data.role_type).toLowerCase();
    const v = createValidator(data);
    v.custom('role_type', ['doctor', 'counsellor'].includes(roleType), "Role must be 'doctor' or 'counsellor'.")
      .required('title', 'Title')
      .required('first_name', 'First name', { max: 100 })
      .required('last_name', 'Last name', { max: 100 })
      .required('gender', 'Gender')
      .required('dob', 'Date of birth')
      .phone('mobile', 'Mobile number')
      .phone('whatsapp', 'WhatsApp number')
      .email('email')
      .required('practice_status', 'Current practice status')
      .required('experience_years', 'Years of experience')
      .required('institution_name', 'Current institution / practice')
      .required('specialisation', 'Specialisation')
      .required('objective', 'Professional objective')
      .required('primary_qualification', 'Primary qualification')
      .required('primary_college', 'Primary qualification college')
      .required('primary_year', 'Primary qualification year')
      .required('primary_grade', 'Primary qualification marks / grade')
      .required('typed_signature', 'Typed signature')
      .consent('declaration_agreed', 'Declaration');

    const from = str(data.preferred_hours_from);
    const to = str(data.preferred_hours_to);
    v.custom('preferred_hours_from', !!from, 'Preferred working hours (from) are required.')
      .custom('preferred_hours_to', !!to && (!from || to > from), 'Preferred working hours "to" must be later than "from".');

    const naCouncil = str(data.council_name).toLowerCase().startsWith('not applicable');
    const councilNeeded = roleType === 'doctor' || !naCouncil;
    if (councilNeeded) {
      v.required('council_name', 'Council / registration body')
        .required('registration_number', 'Registration number')
        .required('state_jurisdiction', 'Registration state');
    }

    const MB = 1024 * 1024;
    const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const docTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    const checkFile = (key, f, label, types, maxMb, required) => {
      if (!f) { if (required) v.custom(key, false, `Please attach your ${label}.`); return; }
      v.custom(key, types.includes(f.mimetype), `${label} must be ${types.map(t => t.split('/')[1].toUpperCase()).join(' / ')}.`);
      v.custom(key, f.size <= maxMb * MB, `${label} must be ${maxMb} MB or smaller.`);
    };
    checkFile('photo', files.photo, 'photograph', imageTypes, 5, true);
    checkFile('primary_cert', files.primary_cert, 'primary qualification certificate', docTypes, 10, true);
    checkFile('pg_cert', files.pg_cert, 'postgraduate certificate', docTypes, 10, false);
    checkFile('council_cert', files.council_cert, roleType === 'doctor' ? 'council registration certificate' : 'registration / accreditation certificate', ['application/pdf', 'image/jpeg', 'image/png'], 10, councilNeeded);
    (files.additional_certs || []).forEach((f, i) => checkFile(`additional_certs_${i}`, f, `additional certificate ${i + 1}`, docTypes, 10, false));
    checkFile('signature_image', files.signature_image, 'signature', ['image/png'], 2, false);

    v.throwIfErrors();
  }

  async findRecentDuplicate(data) {
    const since = new Date(Date.now() - 15 * 60 * 1000);
    return ClinicalApplication.findOne({
      where: {
        email: str(data.email).toLowerCase(),
        role_type: str(data.role_type).toLowerCase(),
        createdAt: { [Op.gte]: since }
      },
      order: [['id', 'DESC']]
    });
  }

  /**
   * Submit Doctor or Counsellor Application (call validateApplication first)
   */
  async submitApplication(data, files = {}) {
    const roleType = str(data.role_type).toLowerCase();
    if (!['doctor', 'counsellor'].includes(roleType)) {
      throw new Error("Invalid role_type. Must be 'doctor' or 'counsellor'.");
    }
    if (!data.first_name || !data.last_name || !data.email || !data.mobile) {
      throw new Error('First name, last name, email, and mobile are required.');
    }

    const prefix = roleType === 'doctor' ? 'SP-DOC' : 'SP-COU';
    const randPart = crypto.randomBytes(3).toString('hex').toUpperCase();
    const referenceNo = `${prefix}-${randPart}`;

    const parseJsonArray = (value) => {
      if (Array.isArray(value)) return value;
      if (typeof value === 'string' && value.trim()) {
        try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch (e) { return []; }
      }
      return [];
    };

    // Additional qualifications: [{degree, college, year, grade, cert_index}] → attach stored cert asset ids
    const additionalCertIds = files.additionalCertAssetIds || [];
    const additionalQualifications = parseJsonArray(data.additional_qualifications)
      .filter(q => q && (q.degree || q.college))
      .slice(0, 10)
      .map(q => {
        const idx = Number.isInteger(q.cert_index) ? q.cert_index : (q.cert_index !== undefined && q.cert_index !== null && q.cert_index !== '' ? parseInt(q.cert_index, 10) : null);
        return {
          degree: str(q.degree).slice(0, 150),
          college: str(q.college).slice(0, 200),
          year: str(q.year).slice(0, 10),
          grade: str(q.grade).slice(0, 50),
          cert_asset_id: idx !== null && !isNaN(idx) && additionalCertIds[idx] ? additionalCertIds[idx] : null
        };
      });

    let consultationModes = parseJsonArray(data.consultation_modes).map(m => str(m)).filter(Boolean);
    if (!consultationModes.length && data.work_mode) consultationModes = [str(data.work_mode)];

    const application = await ClinicalApplication.create({
      reference_no: referenceNo,
      role_type: roleType,
      title: str(data.title) || (roleType === 'doctor' ? 'Dr' : 'Ms/Mr'),
      first_name: str(data.first_name),
      last_name: str(data.last_name),
      gender: str(data.gender) || null,
      dob: str(data.dob) || null,
      mobile: str(data.mobile),
      whatsapp: str(data.whatsapp) || str(data.mobile),
      email: str(data.email).toLowerCase(),

      practice_status: str(data.practice_status) || null,
      experience_years: str(data.experience_years) || null,
      institution_name: str(data.institution_name) || null,
      affiliations: str(data.affiliations) || null,
      specialisation: str(data.specialisation) || null,
      objective: str(data.objective) || null,

      primary_qualification: str(data.primary_qualification) || null,
      primary_college: str(data.primary_college) || null,
      primary_year: str(data.primary_year) || null,
      primary_grade: str(data.primary_grade) || null,

      pg_qualification: str(data.pg_qualification) || null,
      pg_college: str(data.pg_college) || null,
      pg_year: str(data.pg_year) || null,
      pg_grade: str(data.pg_grade) || null,
      additional_qualifications: additionalQualifications,

      council_name: str(data.council_name) || null,
      registration_number: str(data.registration_number) || null,
      state_jurisdiction: str(data.state_jurisdiction) || null,
      registration_year: str(data.registration_year) || null,
      valid_until: str(data.valid_until) || null,

      photo_asset_id: files.photoAssetId || null,
      primary_cert_asset_id: files.primaryCertAssetId || null,
      pg_cert_asset_id: files.pgCertAssetId || null,
      council_cert_asset_id: files.councilCertAssetId || null,
      signature_asset_id: files.signatureAssetId || null,

      consultation_modes: consultationModes,
      preferred_hours_from: str(data.preferred_hours_from) || null,
      preferred_hours_to: str(data.preferred_hours_to) || null,

      declaration_agreed: isTrue(data.declaration_agreed),
      declaration_date: str(data.declaration_date) || null,
      signed_name: str(data.signed_name) || null,
      typed_signature: str(data.typed_signature) || `${str(data.first_name)} ${str(data.last_name)}`,
      status: 'submitted'
    });

    await require('./notification.service').notify('clinical_application', {
      title: `New ${application.role_type === 'doctor' ? 'doctor' : 'counsellor'} application: ${application.first_name} ${application.last_name}`,
      message: `${application.email} · ${application.reference_no}. Review the documents in Clinical Staff.`,
      link: '/clinical',
      entityType: 'ClinicalApplication',
      entityId: application.id
    });

    return {
      id: application.id,
      referenceNo: application.reference_no,
      roleType: application.role_type,
      fullName: `${application.first_name} ${application.last_name}`,
      email: application.email,
      whatsapp: application.whatsapp,
      createdAt: application.createdAt
    };
  }

  /**
   * Admin: list clinical applications with filters & pagination
   */
  async listApplications({ page = 1, limit = 20, roleType, status, search }) {
    const where = {};
    if (roleType) where.role_type = roleType;
    if (status) where.status = status;
    if (search) {
      where[Op.or] = [
        { reference_no: { [Op.like]: `%${search}%` } },
        { first_name: { [Op.like]: `%${search}%` } },
        { last_name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { mobile: { [Op.like]: `%${search}%` } },
        { registration_number: { [Op.like]: `%${search}%` } }
      ];
    }

    const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const { count, rows } = await ClinicalApplication.findAndCountAll({
      where,
      limit: parseInt(limit, 10),
      offset,
      order: [['id', 'DESC']],
      include: [
        { model: MediaAsset, as: 'photo', attributes: ['id', 'original_name', 'mime_type', 'file_size'] },
        { model: MediaAsset, as: 'primary_cert', attributes: ['id', 'original_name', 'mime_type', 'file_size'] },
        { model: MediaAsset, as: 'pg_cert', attributes: ['id', 'original_name', 'mime_type', 'file_size'] },
        { model: MediaAsset, as: 'council_cert', attributes: ['id', 'original_name', 'mime_type', 'file_size'] },
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
   * Admin: get single application
   */
  async getApplicationById(id) {
    const application = await ClinicalApplication.findByPk(id, {
      include: [
        { model: MediaAsset, as: 'photo' },
        { model: MediaAsset, as: 'primary_cert' },
        { model: MediaAsset, as: 'pg_cert' },
        { model: MediaAsset, as: 'council_cert' },
        { model: MediaAsset, as: 'signature' },
        { model: User, as: 'assigned_to', attributes: ['id', 'first_name', 'last_name', 'email'] }
      ]
    });
    if (!application) throw new Error('Clinical application not found');
    return application;
  }

  /**
   * Admin: update status, assignment, or internal notes
   */
  async updateApplication(id, { status, assigned_to_user_id, internal_notes }) {
    const application = await ClinicalApplication.findByPk(id);
    if (!application) throw new Error('Clinical application not found');

    const updates = {};
    if (status) {
      if (!CLINICAL_STATUSES.includes(status)) {
        throw new Error(`Invalid status "${status}". Allowed: ${CLINICAL_STATUSES.join(', ')}`);
      }
      updates.status = status;
    }
    if (assigned_to_user_id !== undefined) updates.assigned_to_user_id = assigned_to_user_id;
    if (internal_notes !== undefined) updates.internal_notes = internal_notes;

    await application.update(updates);
    return application;
  }
}

module.exports = new ClinicalService();
module.exports.CLINICAL_STATUSES = CLINICAL_STATUSES;
