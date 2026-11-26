const { AuditLog, User } = require('../models');
const { Op } = require('sequelize');

class AuditService {
  /**
   * Record an audit event
   */
  async log({ userId, action, entityType, entityId, oldValues = null, newValues = null, req = null }) {
    try {
      let ip = null;
      let userAgent = null;
      if (req) {
        ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;
        userAgent = req.headers['user-agent'] ? req.headers['user-agent'].slice(0, 255) : null;
      }

      await AuditLog.create({
        user_id: userId || null,
        action,
        entity_type: entityType || null,
        entity_id: entityId ? String(entityId) : null,
        old_values: oldValues,
        new_values: newValues,
        ip_address: ip ? String(ip).slice(0, 45) : null,
        user_agent: userAgent
      });
    } catch (err) {
      console.error('[AuditService] Failed to record audit log:', err.message);
    }
  }

  /**
   * List audit logs with pagination and filters
   */
  async listLogs({ page = 1, limit = 50, action, entityType, userId }) {
    const where = {};
    if (action) where.action = action;
    if (entityType) where.entity_type = entityType;
    if (userId) where.user_id = userId;

    const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const { count, rows } = await AuditLog.findAndCountAll({
      where,
      limit: parseInt(limit, 10),
      offset,
      order: [['id', 'DESC']],
      include: [{ model: User, as: 'user', attributes: ['id', 'first_name', 'last_name', 'email'] }]
    });

    return {
      total: count,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(count / limit),
      logs: rows
    };
  }
}

module.exports = new AuditService();
