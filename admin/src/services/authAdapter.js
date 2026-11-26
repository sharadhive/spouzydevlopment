/**
 * Shared Authentication & User Normalization Adapter
 * Normalizes user objects from /auth/login and /auth/me to a consistent contract.
 * Safely handles missing, loading, or malformed values.
 * Unknown or missing roles NEVER default to administrator.
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

export function normalizeUser(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  let roleId = null;
  let roleSlug = '';
  let roleName = '';
  let permissions = [];

  // Contract: role can be an object { id, slug, name, permissions } or legacy string
  if (raw.role && typeof raw.role === 'object') {
    roleId = raw.role.id || null;
    roleSlug = typeof raw.role.slug === 'string' ? raw.role.slug.toLowerCase().trim() : '';
    roleName = typeof raw.role.name === 'string' ? raw.role.name.trim() : '';
    if (Array.isArray(raw.role.permissions)) {
      permissions = raw.role.permissions;
    }
  } else if (typeof raw.role === 'string') {
    roleSlug = raw.role.toLowerCase().trim();
    roleName = typeof raw.role_name === 'string' ? raw.role_name.trim() : '';
  }

  // Backup fallback from top-level fields
  if (!roleSlug && typeof raw.role_slug === 'string') {
    roleSlug = raw.role_slug.toLowerCase().trim();
  }
  if (!roleName && typeof raw.role_name === 'string') {
    roleName = raw.role_name.trim();
  }

  // Permissions preference: effective_permissions > permissions > role.permissions
  if (Array.isArray(raw.effective_permissions) && raw.effective_permissions.length > 0) {
    permissions = raw.effective_permissions;
  } else if (Array.isArray(raw.permissions) && raw.permissions.length > 0) {
    permissions = raw.permissions;
  }

  // Fallback human-readable name from slug if name missing
  if (!roleName && roleSlug) {
    if (roleSlug === 'admin') {
      roleName = 'Administrator';
    } else if (roleSlug === 'content_editor') {
      roleName = 'Content Editor';
    } else if (roleSlug === 'operations_staff') {
      roleName = 'Operations Staff';
    } else if (roleSlug === 'clinical_director') {
      roleName = 'Clinical Director';
    } else {
      roleName = roleSlug.charAt(0).toUpperCase() + roleSlug.slice(1);
    }
  }

  const firstName = typeof raw.first_name === 'string' ? raw.first_name.trim() : '';
  const lastName = typeof raw.last_name === 'string' ? raw.last_name.trim() : '';
  const email = typeof raw.email === 'string' ? raw.email.trim() : '';
  const computedName = `${firstName} ${lastName}`.trim();
  const name = typeof raw.name === 'string' && raw.name.trim()
    ? raw.name.trim()
    : (computedName || email || 'User');

  // Authoritative role check: ONLY explicitly 'admin' slug gets admin privileges
  const isAdmin = roleSlug === 'admin';
  const isStaff = ['admin', 'content_editor', 'operations_staff', 'clinical_director', 'staff'].includes(roleSlug);

  // Default role-specific landing routes
  let landingRoute = '/';
  if (roleSlug === 'content_editor') {
    landingRoute = '/content-dashboard';
  } else if (roleSlug === 'operations_staff') {
    landingRoute = '/enquiries';
  } else if (roleSlug === 'clinical_director') {
    landingRoute = '/clinical';
  } else if (roleSlug === 'admin') {
    landingRoute = '/';
  }

  function can(requiredPerm) {
    if (isAdmin || permissions.includes('all') || permissions.includes('*')) {
      return true;
    }
    if (permissions.includes(requiredPerm)) return true;

    const parts = requiredPerm.split(':');
    const mod = parts[0];
    const act = parts[1] || '';

    // Wildcard module check: e.g. 'content:*' matches 'content:view'
    if (permissions.includes(`${mod}:*`)) return true;

    // Check action synonyms
    const synonyms = ACTION_SYNONYMS[act] || [act];
    for (const syn of synonyms) {
      if (permissions.includes(`${mod}:${syn}`)) return true;
    }

    if (permissions.includes(`${mod}:manage`)) return true;

    return false;
  }

  return {
    id: raw.id || null,
    email,
    name,
    first_name: firstName,
    last_name: lastName,
    phone: typeof raw.phone === 'string' ? raw.phone.trim() : '',
    must_change_password: !!raw.must_change_password,
    role: {
      id: roleId,
      slug: roleSlug,
      name: roleName || 'Restricted User',
      permissions
    },
    roleSlug,
    roleName: roleName || 'Restricted User',
    permissions,
    effective_permissions: permissions,
    isAdmin,
    isStaff,
    landingRoute,
    can
  };
}
