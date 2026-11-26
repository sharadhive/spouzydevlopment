const { v4: uuidv4 } = require('uuid');
const models = require('../models');
const { hashPassword, comparePassword } = require('../config/security');
const config = require('../config/environment');

const { getEffectivePermissions } = require('../middlewares/rbac.middleware');

class AuthService {
  /**
   * Authenticate admin or staff user
   */
  async loginAdmin(emailOrOpts, maybePassword, maybeIp, maybeUa) {
    let email, password, ipAddress, userAgent;
    if (typeof emailOrOpts === 'object' && emailOrOpts !== null) {
      email = emailOrOpts.email;
      password = emailOrOpts.password;
      ipAddress = emailOrOpts.ipAddress || (emailOrOpts.req ? (emailOrOpts.req.headers['x-forwarded-for'] || emailOrOpts.req.socket?.remoteAddress) : null);
      userAgent = emailOrOpts.userAgent || (emailOrOpts.req ? emailOrOpts.req.headers['user-agent'] : null);
    } else {
      email = emailOrOpts;
      password = maybePassword;
      ipAddress = maybeIp;
      userAgent = maybeUa;
    }

    const user = await models.User.findOne({
      where: { email: (email || '').toLowerCase().trim() },
      include: [{ model: models.Role, as: 'role' }]
    });

    if (!user || !user.is_active) {
      throw new Error('Invalid email or password.');
    }

    // Role check: must not be customer
    if (user.role.slug === 'customer') {
      throw new Error('Access restricted. Please use the client portal.');
    }

    const isMatch = await comparePassword(password, user.password_hash);
    if (!isMatch) {
      throw new Error('Invalid email or password.');
    }

    // Update last login
    user.last_login_at = new Date();
    await user.save();

    // Create database session
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + config.security.sessionDurationHours * 3600 * 1000);

    const session = await models.Session.create({
      id: sessionId,
      user_id: user.id,
      ip_address: ipAddress,
      user_agent: (userAgent || '').slice(0, 255),
      expires_at: expiresAt
    });

    // Record audit
    await models.AuditLog.create({
      user_id: user.id,
      action: 'AUTH_LOGIN_SUCCESS',
      entity_type: 'Session',
      entity_id: sessionId,
      ip_address: ipAddress,
      user_agent: (userAgent || '').slice(0, 255)
    });

    const effectivePermissions = getEffectivePermissions(user);

    return {
      session,
      token: sessionId,
      user: {
        id: user.id,
        email: user.email,
        name: `${user.first_name} ${user.last_name}`.trim(),
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        must_change_password: !!user.must_change_password,
        role: {
          id: user.role.id,
          slug: user.role.slug,
          name: user.role.name,
          permissions: effectivePermissions
        },
        role_slug: user.role.slug,
        role_name: user.role.name,
        permissions: effectivePermissions,
        effective_permissions: effectivePermissions
      }
    };
  }

  /**
   * Authenticate customer
   */
  async loginCustomer(emailOrOpts, maybePassword, maybeIp, maybeUa) {
    let email, password, ipAddress, userAgent;
    if (typeof emailOrOpts === 'object' && emailOrOpts !== null) {
      email = emailOrOpts.email;
      password = emailOrOpts.password;
      ipAddress = emailOrOpts.ipAddress || (emailOrOpts.req ? (emailOrOpts.req.headers['x-forwarded-for'] || emailOrOpts.req.socket?.remoteAddress) : null);
      userAgent = emailOrOpts.userAgent || (emailOrOpts.req ? emailOrOpts.req.headers['user-agent'] : null);
    } else {
      email = emailOrOpts;
      password = maybePassword;
      ipAddress = maybeIp;
      userAgent = maybeUa;
    }

    // Customers may log in with their email or their mobile number
    const user = await this.findCustomer(email);

    if (!user || !user.is_active || !user.role || user.role.slug !== 'customer') {
      throw new Error('Invalid email or password.');
    }

    const isMatch = await comparePassword(password, user.password_hash);
    if (!isMatch) {
      throw new Error('Invalid email or password.');
    }

    user.last_login_at = new Date();
    await user.save();

    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + config.security.sessionDurationHours * 3600 * 1000);

    const session = await models.Session.create({
      id: sessionId,
      user_id: user.id,
      ip_address: ipAddress,
      user_agent: (userAgent || '').slice(0, 255),
      expires_at: expiresAt
    });

    return {
      session,
      token: sessionId,
      user: {
        id: user.id,
        email: user.email,
        name: `${user.first_name} ${user.last_name}`.trim(),
        first_name: user.first_name,
        last_name: user.last_name,
        role: {
          id: user.role?.id || null,
          slug: 'customer',
          name: 'Customer',
          permissions: []
        },
        role_slug: 'customer',
        role_name: 'Customer',
        permissions: []
      }
    };
  }

  /** Last 10 digits of a phone number (ignores +91, spaces, dashes) */
  phoneKey(phone) {
    const d = String(phone || '').replace(/\D/g, '');
    return d.length >= 10 ? d.slice(-10) : '';
  }

  /** Customer accounts whose mobile number matches (by the last 10 digits) */
  async customersByPhone(phone) {
    const key = this.phoneKey(phone);
    if (!key) return [];
    const role = await models.Role.findOne({ where: { slug: 'customer' } });
    if (!role) return [];
    const { sequelize } = models;
    const digits = "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(`phone`, ' ', ''), '-', ''), '+', ''), '(', ''), ')', ''), '.', '')";
    return models.User.findAll({
      where: { role_id: role.id, [require('sequelize').Op.and]: [sequelize.literal(`${digits} LIKE ${sequelize.escape('%' + key)}`)] },
      include: [{ model: models.Role, as: 'role' }],
      order: [['id', 'ASC']]
    });
  }

  /** Find a customer by email or mobile number. Returns null when ambiguous or missing. */
  async findCustomer(identifier) {
    const id = String(identifier || '').trim();
    if (!id) return null;
    if (id.includes('@')) {
      return models.User.findOne({ where: { email: id.toLowerCase() }, include: [{ model: models.Role, as: 'role' }] });
    }
    const matches = await this.customersByPhone(id);
    return matches.length === 1 ? matches[0] : null;
  }

  maskEmail(email) {
    const [name, domain] = String(email || '').split('@');
    if (!domain) return '';
    const shown = name.length <= 2 ? name.slice(0, 1) : name.slice(0, 2);
    return `${shown}${'•'.repeat(Math.max(2, Math.min(6, name.length - shown.length)))}@${domain}`;
  }

  /**
   * Does an account already exist for this email or mobile? Used by the booking page to
   * decide between "Log in" and "Create account".
   */
  async checkCustomerAccount({ email, phone }) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (cleanEmail) {
      const byEmail = await models.User.findOne({ where: { email: cleanEmail }, include: [{ model: models.Role, as: 'role' }] });
      if (byEmail) {
        const isCustomer = byEmail.role && byEmail.role.slug === 'customer';
        return { exists: true, matched_by: 'email', masked_email: this.maskEmail(byEmail.email), can_login: isCustomer && byEmail.is_active };
      }
    }
    const byPhone = await this.customersByPhone(phone);
    if (byPhone.length) {
      return { exists: true, matched_by: 'phone', masked_email: this.maskEmail(byPhone[0].email), can_login: byPhone[0].is_active };
    }
    return { exists: false };
  }

  /**
   * Customer account registration
   */
  async registerCustomer({ name, email, password, firstName, lastName, phone, consent, category }) {
    const { createValidator, ValidationError } = require('../config/validation');
    const rawCat = category === undefined || category === null ? '' : String(category).trim();
    const REGULAR_CATEGORIES = ['', 'neither', 'regular'];
    const SPECIAL_CATEGORIES = ['student', 'ex_servicemen'];
    if (rawCat && !REGULAR_CATEGORIES.includes(rawCat) && !SPECIAL_CATEGORIES.includes(rawCat)) {
      throw new ValidationError({ category: 'Invalid special category selected.' }, 'Invalid special category selected.');
    }
    if (SPECIAL_CATEGORIES.includes(rawCat)) {
      throw new ValidationError({ category: 'Eligibility documents are required when selecting Student or Ex-serviceman / Defence.' }, 'Eligibility documents are required when selecting Student or Ex-serviceman / Defence.');
    }
    const fullName = String(name || `${firstName || ''} ${lastName || ''}`).trim().replace(/\s+/g, ' ');
    const data = { name: fullName, email: String(email || '').trim(), phone: String(phone || '').trim(), password: String(password || ''), consent };
    const v = createValidator(data);
    v.required('name', 'Full name', { min: 2, max: 150 });
    v.email('email', 'Email');
    v.phone('phone', 'Mobile number');
    v.custom('password', data.password.length >= 8 && /[A-Z]/.test(data.password) && /[a-z]/.test(data.password) && /\d/.test(data.password),
      'Password must be at least 8 characters with an upper-case letter, a lower-case letter and a number.');
    v.consent('consent', 'Agreeing to the Terms and Privacy Policy');
    v.throwIfErrors();

    const cleanEmail = data.email.toLowerCase();
    const existing = await models.User.findOne({ where: { email: cleanEmail } });
    if (existing) {
      const err = new ValidationError({ email: 'An account with this email already exists. Please log in instead.' }, 'An account with this email already exists. Please log in instead.');
      err.status = 409;
      throw err;
    }
    const samePhone = await this.customersByPhone(data.phone);
    if (samePhone.length) {
      const msg = `This mobile number is already registered (${this.maskEmail(samePhone[0].email)}). Please log in instead.`;
      const err = new ValidationError({ phone: msg }, msg);
      err.status = 409;
      throw err;
    }

    const customerRole = await models.Role.findOne({ where: { slug: 'customer' } });
    if (!customerRole) {
      throw new Error('Customer role not configured. Run npm run db:seed.');
    }

    const parts = fullName.split(' ');
    const passwordHash = await hashPassword(data.password);
    const user = await models.User.create({
      email: cleanEmail,
      password_hash: passwordHash,
      first_name: parts[0],
      last_name: parts.slice(1).join(' '),
      phone: data.phone,
      role_id: customerRole.id,
      is_active: true
    });
    await require('./notification.service').notify('customer_signup', {
      title: `New customer account: ${`${user.first_name || ''} ${user.last_name || ''}`.trim()}`,
      message: `${user.email}${user.phone ? ' · ' + user.phone : ''}`,
      link: '/shop?tab=customers',
      entityType: 'User',
      entityId: user.id
    });

    return {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name
    };
  }

  /**
   * Validate session token from cookie/header
   */
  async validateSession(sessionId) {
    if (!sessionId) return null;

    const session = await models.Session.findOne({
      where: { id: sessionId },
      include: [{
        model: models.User,
        as: 'user',
        include: [{ model: models.Role, as: 'role' }]
      }]
    });

    if (!session) return null;

    // Check expiration
    if (new Date() > new Date(session.expires_at)) {
      await session.destroy();
      return null;
    }

    // Check user active status
    if (!session.user || !session.user.is_active) {
      await session.destroy();
      return null;
    }

    return session;
  }

  /**
   * Logout and destroy session
   */
  async logout(sessionId) {
    if (!sessionId) return;
    await models.Session.destroy({ where: { id: sessionId } });
  }

  /**
   * Change user password and invalidate all previous sessions
   */
  async changePassword(userId, currentPassword, newPassword, ipAddress) {
    const user = await models.User.findByPk(userId);
    if (!user) throw new Error('User not found.');

    const isMatch = await comparePassword(currentPassword, user.password_hash);
    if (!isMatch) {
      throw new Error('Current password does not match.');
    }

    if (!newPassword || newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters long.');
    }

    user.password_hash = await hashPassword(newPassword);
    await user.save();

    // Invalidate all active sessions for this user (security requirement)
    await models.Session.destroy({ where: { user_id: userId } });

    await models.AuditLog.create({
      user_id: user.id,
      action: 'PASSWORD_CHANGED',
      entity_type: 'User',
      entity_id: String(user.id),
      ip_address: ipAddress
    });

    return true;
  }
}

module.exports = new AuthService();
