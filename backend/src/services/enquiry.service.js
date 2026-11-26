const crypto = require('crypto');
const { Enquiry, EnquiryNote, User } = require('../models');
const { Op } = require('sequelize');
const { createValidator, str, isTrue } = require('../config/validation');

const ENQUIRY_STATUSES = ['new', 'contacted', 'in_progress', 'resolved', 'closed'];
const ENQUIRY_SOURCES = ['contact_page', 'floating_widget', 'other'];

class EnquiryService {
  /**
   * Submit public enquiry (contact page, floating callback widget, etc.)
   * Consent is required for website sources; validation errors are per field.
   */
  async submitEnquiry(data) {
    const source = ENQUIRY_SOURCES.includes(str(data.source)) ? str(data.source) : 'contact_page';
    const v = createValidator(data);
    v.required('name', 'Name', { max: 150 })
      .phone('phone', 'Phone number');
    if (source === 'floating_widget') {
      v.email('email', 'Email', { required: false });
    } else {
      v.email('email')
        .required('message', 'Message', { min: 10 });
    }
    v.consent('consent', 'Consent to be contacted');
    v.throwIfErrors();

    // Double-submit guard: identical enquiry in the last 10 minutes → return it
    const since = new Date(Date.now() - 10 * 60 * 1000);
    const duplicate = await Enquiry.findOne({
      where: {
        phone: str(data.phone),
        message: str(data.message) || 'Callback requested',
        createdAt: { [Op.gte]: since }
      },
      order: [['id', 'DESC']]
    });
    if (duplicate) {
      return { id: duplicate.id, referenceNo: duplicate.reference_no, name: duplicate.name, createdAt: duplicate.createdAt, duplicate: true };
    }

    const yearSuffix = new Date().getFullYear().toString().slice(-2);
    const randPart = crypto.randomBytes(3).toString('hex').toUpperCase();
    const referenceNo = `SP-ENQ-${yearSuffix}-${randPart}`;

    const enquiry = await Enquiry.create({
      reference_no: referenceNo,
      name: str(data.name),
      email: str(data.email).toLowerCase() || 'not-provided@spouzy.local',
      phone: str(data.phone),
      whatsapp: str(data.whatsapp) || null,
      preferred_clinic: str(data.preferred_clinic) || null,
      subject: str(data.subject) || str(data.service_interest) || 'General Enquiry',
      service_interest: str(data.service_interest) || str(data.subject) || null,
      preferred_contact_method: str(data.preferred_contact_method) || null,
      message: str(data.message) || 'Callback requested',
      consent_agreed: isTrue(data.consent),
      source,
      status: 'new'
    });

    const isCallback = source === 'floating_widget';
    await require('./notification.service').notify(isCallback ? 'callback' : 'enquiry', {
      title: isCallback ? `Call-back requested: ${enquiry.name}` : `New enquiry from ${enquiry.name}`,
      message: `${enquiry.phone}${enquiry.service_interest ? ' · ' + enquiry.service_interest : ''} · ${String(enquiry.message || '').slice(0, 160)} (${enquiry.reference_no})`,
      link: `/enquiries?ref=${encodeURIComponent(enquiry.reference_no)}`,
      entityType: 'Enquiry',
      entityId: enquiry.id
    });

    return {
      id: enquiry.id,
      referenceNo: enquiry.reference_no,
      name: enquiry.name,
      createdAt: enquiry.createdAt
    };
  }

  /**
   * Admin: list enquiries with pagination and filters
   */
  async listEnquiries({ page = 1, limit = 20, status, search, clinic, source }) {
    const where = {};
    if (status) where.status = status;
    if (source) where.source = source;
    if (clinic) where.preferred_clinic = clinic;
    if (search) {
      where[Op.or] = [
        { reference_no: { [Op.like]: `%${search}%` } },
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } }
      ];
    }

    const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const { count, rows } = await Enquiry.findAndCountAll({
      where,
      limit: parseInt(limit, 10),
      offset,
      order: [['id', 'DESC']],
      include: [
        { model: User, as: 'assigned_to', attributes: ['id', 'first_name', 'last_name', 'email'] },
        { model: EnquiryNote, as: 'notes', include: [{ model: User, as: 'author', attributes: ['id', 'first_name', 'last_name'] }] }
      ]
    });

    return {
      total: count,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(count / limit),
      enquiries: rows
    };
  }

  /**
   * Admin: get enquiry detail
   */
  async getEnquiryById(id) {
    const enquiry = await Enquiry.findByPk(id, {
      include: [
        { model: User, as: 'assigned_to', attributes: ['id', 'first_name', 'last_name', 'email'] },
        { 
          model: EnquiryNote, 
          as: 'notes', 
          include: [{ model: User, as: 'author', attributes: ['id', 'first_name', 'last_name'] }],
          order: [['id', 'ASC']]
        }
      ]
    });
    if (!enquiry) throw new Error('Enquiry not found');
    return enquiry;
  }

  /**
   * Admin: update status or assign
   */
  async updateEnquiry(id, { status, assigned_to_user_id }) {
    const enquiry = await Enquiry.findByPk(id);
    if (!enquiry) throw new Error('Enquiry not found');

    const updates = {};
    if (status) {
      if (!ENQUIRY_STATUSES.includes(status)) {
        throw new Error(`Invalid status "${status}". Allowed: ${ENQUIRY_STATUSES.join(', ')}`);
      }
      updates.status = status;
    }
    if (assigned_to_user_id !== undefined) updates.assigned_to_user_id = assigned_to_user_id;

    await enquiry.update(updates);
    return enquiry;
  }

  /**
   * Admin: add internal note
   */
  async addNote(enquiryId, authorUserId, noteText) {
    if (!noteText || !noteText.trim()) throw new Error('Note text is required');
    const enquiry = await Enquiry.findByPk(enquiryId);
    if (!enquiry) throw new Error('Enquiry not found');

    const note = await EnquiryNote.create({
      enquiry_id: enquiryId,
      author_user_id: authorUserId,
      note_text: noteText.trim()
    });

    return EnquiryNote.findByPk(note.id, {
      include: [{ model: User, as: 'author', attributes: ['id', 'first_name', 'last_name'] }]
    });
  }
}

module.exports = new EnquiryService();
