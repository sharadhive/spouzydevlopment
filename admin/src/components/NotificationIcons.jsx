import React from 'react';

/** Small line icons for notification types (inline SVG, no icon font needed) */
const PATHS = {
  bell: <><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>,
  payments: <><circle cx="12" cy="12" r="9" /><path d="M9 8h6M9 11h6M13 8c2 0 2 6-2 6l3.5 3" /></>,
  orders: <><path d="M6 7h12l-1 13H7L6 7Z" /><path d="M9 7a3 3 0 0 1 6 0" /></>,
  bookings: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18M9 15l2 2 4-4" /></>,
  enquiries: <><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12Z" /></>,
  applications: <><rect x="4" y="3" width="16" height="18" rx="2" /><circle cx="12" cy="10" r="2.5" /><path d="M8 17c.8-2 2.2-3 4-3s3.2 1 4 3" /></>,
  website: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" /></>,
  check: <path d="m5 12 5 5 9-10" />,
  send: <><path d="m22 2-7 20-4-9-9-4 20-7Z" /><path d="M22 2 11 13" /></>
};

export default function NIcon({ name, size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name] || PATHS.bell}
    </svg>
  );
}

export const CATEGORY_LABELS = {
  payments: 'Payments & bills',
  orders: 'Orders & customers',
  bookings: 'Bookings',
  enquiries: 'Enquiries & call-backs',
  applications: 'Applications',
  website: 'Questions & stories'
};

/** "just now", "5 min ago", "3 h ago", "Yesterday 4:10 pm", "18 Nov, 2:05 pm" */
export function timeAgo(at) {
  const d = new Date(at);
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 6 * 3600) return `${Math.round(s / 3600)} h ago`;
  const ymd = (x) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(x);
  const time = d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' });
  if (ymd(d) === ymd(new Date())) return `Today ${time}`;
  if (ymd(d) === ymd(new Date(Date.now() - 864e5))) return `Yesterday ${time}`;
  return `${d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' })}, ${time}`;
}
