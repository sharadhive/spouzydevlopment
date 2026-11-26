/**
 * Status values exactly as the database stores them (see backend models).
 * Use these lists for every dropdown, filter and quick-action button.
 */
export const ENQUIRY_STATUSES = ['new', 'contacted', 'in_progress', 'resolved', 'closed'];
export const CLINICAL_STATUSES = ['submitted', 'under_review', 'interview_scheduled', 'approved', 'rejected'];
export const CAREER_STATUSES = ['submitted', 'under_review', 'interview_scheduled', 'offered', 'rejected'];
export const APPOINTMENT_STATUSES = ['hold', 'confirmed', 'rescheduled', 'completed', 'cancelled', 'no_show'];
export const APPOINTMENT_ACTIONS = ['confirmed', 'completed', 'cancelled', 'no_show'];
export const PAYMENT_STATUSES = ['not_required', 'pending', 'paid', 'refunded', 'failed'];
export const STORY_STATUSES = ['pending', 'approved', 'rejected'];

const LABELS = {
  new: 'New',
  contacted: 'Contacted',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
  submitted: 'Submitted',
  under_review: 'Under Review',
  interview_scheduled: 'Interview Scheduled',
  approved: 'Approved',
  rejected: 'Rejected',
  offered: 'Offer Made',
  hold: 'Awaiting Payment',
  confirmed: 'Confirmed',
  rescheduled: 'Rescheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
  not_required: 'No Payment',
  pending: 'Payment Pending',
  paid: 'Paid',
  refunded: 'Refunded',
  failed: 'Failed',
  answered: 'Answered',
  published: 'Published'
};

export function statusLabel(value) {
  if (!value) return '';
  return LABELS[value] || String(value).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** Format a stored date/time as Indian date + time in IST */
export function formatDateTimeIST(value) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatDateIST(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    const d = new Date(value + 'T00:00:00Z');
    return d.toLocaleDateString('en-IN', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' });
  }
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
}

export function todayIST() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function formatInrFromMinor(minor) {
  const n = Math.round((Number(minor) || 0) / 100);
  return '₹' + n.toLocaleString('en-IN');
}
