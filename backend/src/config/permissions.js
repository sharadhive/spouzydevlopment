/**
 * Single source of truth for role permission sets.
 * Permission names match exactly what routes check with requirePermission().
 */
const ROLE_DEFINITIONS = [
  {
    slug: 'admin',
    name: 'Administrator',
    description: 'Full system access, including users, roles and payment gateway.',
    permissions: ['all']
  },
  {
    slug: 'operations_staff',
    name: 'Operations Staff',
    description: 'Front desk: enquiries, appointments, scheduling, careers and application status.',
    permissions: [
      'enquiries:view', 'enquiries:edit', 'enquiries:export',
      'clinical_apps:view', 'clinical_apps:edit',
      'careers:view', 'careers:edit', 'careers:download',
      'appointments:view', 'appointments:edit', 'appointments:reschedule',
      'scheduling:view', 'scheduling:edit',
      'practitioners:view',
      'orders:view', 'orders:edit', 'packages:view',
      'offers:view'
    ]
  },
  {
    slug: 'clinical_director',
    name: 'Clinical Director',
    description: 'Clinical governance, practitioner scheduling, application approvals and medical content.',
    permissions: [
      'clinical_apps:view', 'clinical_apps:edit', 'clinical_apps:export', 'clinical_apps:download_docs',
      'practitioners:view', 'practitioners:edit',
      'scheduling:view', 'scheduling:edit',
      'appointments:view', 'appointments:edit', 'appointments:reschedule',
      'blogs:view', 'blogs:edit',
      'moderation:view', 'moderation:edit'
    ]
  },
  {
    slug: 'content_editor',
    name: 'Content Editor',
    description: 'Website content: banners, tips, homepage, blogs, FAQs, stories, media and public settings.',
    permissions: [
      'content:view', 'content:edit', 'content:delete',
      'blogs:view', 'blogs:edit', 'blogs:delete',
      'moderation:view', 'moderation:edit',
      'media:view', 'media:edit',
      'settings:content',
      'packages:view',
      'offers:view', 'offers:edit'
    ]
  },
  {
    slug: 'customer',
    name: 'Customer',
    description: 'Public client portal account.',
    permissions: ['customer:self']
  }
];

const ALL_PERMISSIONS = [
  'enquiries:view', 'enquiries:edit', 'enquiries:export',
  'clinical_apps:view', 'clinical_apps:edit', 'clinical_apps:export', 'clinical_apps:download_docs',
  'careers:view', 'careers:edit', 'careers:download',
  'appointments:view', 'appointments:edit', 'appointments:reschedule',
  'scheduling:view', 'scheduling:edit',
  'practitioners:view', 'practitioners:edit',
  'content:view', 'content:edit', 'content:delete',
  'blogs:view', 'blogs:edit', 'blogs:delete',
  'moderation:view', 'moderation:edit',
  'media:view', 'media:edit',
  'settings:content', 'settings:gateway',
  'packages:view', 'packages:edit', 'orders:view', 'orders:edit',
  'offers:view', 'offers:edit',
  // Student / ex-servicemen ID proofs: only administrators for now (add to a role later if the team grows)
  'verifications:view', 'verifications:edit',
  'users:manage'
];

// Permissions added after the first release; migrations merge these into existing roles
// without removing anything an administrator changed.
const ADDED_PERMISSIONS = {
  '20261119000004': {
    operations_staff: ['orders:view', 'orders:edit', 'packages:view'],
    content_editor: ['packages:view']
  },
  // Offers: content editors create offer cards; an offer price also needs packages:edit
  '20261120000007': {
    operations_staff: ['offers:view'],
    content_editor: ['offers:view', 'offers:edit']
  }
};

module.exports = { ROLE_DEFINITIONS, ALL_PERMISSIONS, ADDED_PERMISSIONS };
