/**
 * Role-Based Access Control & Permission Enforcement Middleware
 * Enforces authoritative permission checks on all protected API operations.
 * Unknown roles/permissions fail closed.
 * Administrator role retains full access.
 * Supports role grants, wildcard actions (e.g. 'content:*'), synonyms ('read'/'view', 'write'/'edit'),
 * and explicit per-user overrides.
 */

const ACTION_SYNONYMS = {
  view: ['view', 'read'],
  read: ['read', 'view'],
  edit: ['edit', 'write', 'update', 'create'],
  write: ['write', 'edit', 'update', 'create'],
  create: ['create', 'write', 'edit'],
  update: ['update', 'edit', 'write'],
  delete: ['delete', 'remove'],
  export: ['export'],
  manage: ['manage', 'view', 'read', 'edit', 'write', 'update', 'create', 'delete', 'export']
};

function checkSinglePerm(grantedList, requiredPerm) {
  if (!Array.isArray(grantedList) || grantedList.length === 0) return false;
  if (grantedList.includes('all') || grantedList.includes('*')) return true;
  if (grantedList.includes(requiredPerm)) return true;

  const parts = requiredPerm.split(':');
  const mod = parts[0];
  const act = parts[1] || '';

  // Module wildcard grant: e.g. 'content:*' matches 'content:view'
  if (grantedList.includes(`${mod}:*`)) return true;

  // Check action synonyms
  const synonyms = ACTION_SYNONYMS[act] || [act];
  for (const syn of synonyms) {
    if (grantedList.includes(`${mod}:${syn}`)) return true;
  }

  // If granted has 'manage', e.g. 'enquiries:manage' matches 'enquiries:view'
  if (grantedList.includes(`${mod}:manage`)) return true;

  return false;
}

function hasPermission(user, requiredPerm) {
  if (!user) return false;

  const roleSlug = user.role?.slug || (typeof user.role === 'string' ? user.role : '');
  if (roleSlug === 'admin') return true;

  // 1. Check user custom permissions override (can grant or deny)
  if (Array.isArray(user.custom_permissions)) {
    if (checkSinglePerm(user.custom_permissions, requiredPerm)) {
      return true;
    }
  }

  // 2. Check role permissions
  const rolePerms = user.role?.permissions || [];
  if (checkSinglePerm(rolePerms, requiredPerm)) {
    return true;
  }

  return false;
}

function getEffectivePermissions(user) {
  if (!user) return [];
  const roleSlug = user.role?.slug || (typeof user.role === 'string' ? user.role : '');
  if (roleSlug === 'admin') {
    return ['all'];
  }

  const rolePerms = Array.isArray(user.role?.permissions) ? user.role.permissions : [];
  const customPerms = Array.isArray(user.custom_permissions) ? user.custom_permissions : [];
  const merged = Array.from(new Set([...rolePerms, ...customPerms]));
  return merged;
}

function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const userRole = req.user.role?.slug || (typeof req.user.role === 'string' ? req.user.role : '');
    if (userRole === 'admin') {
      return next(); // Administrator always has access
    }

    const rolesList = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    if (!rolesList.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not have permission to access this resource.'
      });
    }

    next();
  };
}

function requirePermission(requiredPerms) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const perms = Array.isArray(requiredPerms) ? requiredPerms : [requiredPerms];
    const allowed = perms.some(p => hasPermission(req.user, p));

    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: `Forbidden. Missing required permission: ${perms.join(' or ')}`
      });
    }

    next();
  };
}

module.exports = {
  hasPermission,
  getEffectivePermissions,
  requireRole,
  requirePermission
};
