import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { formatDateTimeIST, formatDateIST } from '../constants/statuses';
import { errorText, Toggle, FormActions } from '../components/content/common';
import HelpBox from '../components/HelpBox';
import OffersPanel from '../components/OffersPanel';
import BillsPanel from '../components/BillsPanel';

export const ORDER_STATUSES = ['pending_payment', 'paid', 'confirmed', 'completed', 'cancelled'];
const ORDER_LABELS = { pending_payment: 'Awaiting payment', paid: 'Paid', confirmed: 'Confirmed (free)', completed: 'Completed', cancelled: 'Cancelled' };
const PAYMENT_LABELS = { not_required: 'No payment', pending: 'Pending', paid: 'Paid', refunded: 'Refunded', failed: 'Failed' };
const ORDER_BADGE = { pending_payment: 'pending', paid: 'paid', confirmed: 'confirmed', completed: 'completed', cancelled: 'cancelled' };

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

function Loading() {
  return <div style={{ textAlign: 'center', padding: '30px', color: '#666' }}><i className="fa fa-spinner fa-spin fa-2x"></i></div>;
}

/* ------------------------------------------------------------------ */
/* Orders                                                               */
/* ------------------------------------------------------------------ */
function OrdersPanel({ onMessage, initialStatus }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canEdit = user?.can('orders:edit');
  const [status, setStatus] = useState(initialStatus || '');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ total: 0, orders: [] });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page, limit: 20, ...(status && { status }), ...(search && { search }) });
      const res = await api.get(`/admin/package-orders?${q}`);
      setData(res.data || { total: 0, orders: [] });
    } catch (err) {
      onMessage(errorText(err), true);
    } finally {
      setLoading(false);
    }
  }, [page, status, search, onMessage]);

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [page, status]);

  async function createBill(o) {
    try {
      const res = await api.post(`/admin/package-orders/${o.id}/invoice`, {});
      navigate(`/shop?tab=bills&bill=${res.data.id}`);
    } catch (err) {
      onMessage(errorText(err), true);
    }
  }

  async function save(updates) {
    try {
      await api.patch(`/admin/package-orders/${selected.id}`, updates);
      onMessage(updates.payment_status === 'paid'
        ? `Order ${selected.order_no} recorded as paid. Its bill is ready in the Bills tab: check the details and send it.`
        : `Order ${selected.order_no} updated`);
      setSelected(null);
      load();
    } catch (err) {
      onMessage(errorText(err), true);
    }
  }

  return (
    <div>
      <form className="sp-filters-bar" onSubmit={(e) => { e.preventDefault(); setPage(1); load(); }}>
        <div style={{ flex: 1, minWidth: '220px' }}>
          <input className="sp-input" placeholder="Search order no, customer email, name or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div style={{ width: '200px' }}>
          <select className="sp-select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All orders</option>
            {ORDER_STATUSES.map(s => <option key={s} value={s}>{ORDER_LABELS[s]}</option>)}
          </select>
        </div>
        <button type="submit" className="sp-btn sp-btn-secondary">Search</button>
      </form>

      <div className="sp-table-wrapper">
        <table className="sp-table">
          <thead><tr><th>Order</th><th>Customer</th><th>Packages</th><th>Total</th><th>Status</th><th>Payment</th><th>Bill</th><th></th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8"><Loading /></td></tr>
            ) : data.orders.length === 0 ? (
              <tr><td colSpan="8" style={{ textAlign: 'center', padding: '24px', color: '#999' }}>No orders yet.</td></tr>
            ) : data.orders.map(o => (
              <tr key={o.id}>
                <td><strong style={{ color: 'var(--sp-copper)' }}>{o.order_no}</strong><div><small style={{ color: '#888' }}>{formatDateTimeIST(o.created_at)}</small></div></td>
                <td>{o.customer?.name}<div><small style={{ color: '#888' }}>{o.customer?.email}</small></div></td>
                <td><small>{o.items.map(i => `${i.name}${i.quantity > 1 ? ` × ${i.quantity}` : ''}`).join(', ')}</small></td>
                <td><strong>{o.total_minor ? inr(o.total_inr) : 'Free'}</strong></td>
                <td><span className={`sp-badge ${ORDER_BADGE[o.status] || ''}`}>{ORDER_LABELS[o.status] || o.status}</span></td>
                <td><span className={`sp-badge ${o.payment_status}`}>{PAYMENT_LABELS[o.payment_status] || o.payment_status}</span></td>
                <td>
                  {o.invoice ? (
                    <Link to={`/shop?tab=bills&bill=${o.invoice.id}`} className="sp-bill-chip" title={o.invoice.status === 'sent' ? 'Sent to the customer' : 'Ready to send'}>
                      {o.invoice.invoice_no}<span className={`sp-bill-dot ${o.invoice.status}`}></span>
                    </Link>
                  ) : (o.payment_status === 'paid' && o.total_minor > 0 && canEdit
                    ? <button className="sp-btn sp-btn-outline sp-btn-sm" onClick={() => createBill(o)}>Create bill</button>
                    : <small style={{ color: '#aaa' }}>—</small>)}
                </td>
                <td><button className="sp-btn sp-btn-secondary sp-btn-sm" onClick={() => setSelected({ ...o, notesDraft: o.internal_notes || '' })}>Open</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '14px' }}>
        <span style={{ fontSize: '13px', color: '#666' }}>{data.total} orders</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="sp-btn sp-btn-secondary sp-btn-sm">Previous</button>
          <button disabled={page * 20 >= data.total} onClick={() => setPage(page + 1)} className="sp-btn sp-btn-secondary sp-btn-sm">Next</button>
        </div>
      </div>

      {selected && (
        <Modal isOpen onClose={() => setSelected(null)} title={`Order ${selected.order_no}`} maxWidth="720px">
          <div className="sp-detail-grid">
            <div><span className="sp-detail-label">Customer</span><div><strong>{selected.customer?.name}</strong></div><div>{selected.customer?.email}</div><div>{selected.customer?.phone}</div></div>
            <div><span className="sp-detail-label">Placed</span><div>{formatDateTimeIST(selected.created_at)}</div>{selected.paid_at && <div><small>Paid {formatDateTimeIST(selected.paid_at)}</small></div>}</div>
            <div><span className="sp-detail-label">Status</span><div>{ORDER_LABELS[selected.status]} · payment {PAYMENT_LABELS[selected.payment_status]}</div></div>
            <div><span className="sp-detail-label">Total</span><div><strong>{selected.total_minor ? inr(selected.total_inr) : 'Free'}</strong></div></div>
          </div>
          <table className="sp-table" style={{ marginBottom: '14px' }}>
            <thead><tr><th>Package</th><th>Sessions</th><th>Qty</th><th>Price</th></tr></thead>
            <tbody>
              {selected.items.map((i, idx) => (
                <tr key={idx}><td>{i.name}</td><td>{i.sessions_included} × {i.session_minutes} min{i.validity_days ? ` · ${i.validity_days} days` : ''}</td><td>{i.quantity}</td><td>{i.price_minor ? inr(i.price_inr) : 'Free'}</td></tr>
              ))}
            </tbody>
          </table>
          {selected.invoice && (
            <p style={{ margin: '0 0 14px' }}>
              <Link to={`/shop?tab=bills&bill=${selected.invoice.id}`} className="sp-btn sp-btn-outline sp-btn-sm">
                Bill {selected.invoice.invoice_no} · {selected.invoice.status === 'sent' ? 'sent to customer' : 'ready to send'}
              </Link>
            </p>
          )}
          {selected.customer_note && (
            <div style={{ background: '#F9F6F0', padding: '12px', borderRadius: '6px', marginBottom: '14px' }}>
              <span className="sp-detail-label">Customer note</span>
              <div style={{ whiteSpace: 'pre-wrap' }}>{selected.customer_note}</div>
            </div>
          )}
          {selected.customer?.phone && (
            <p><a className="sp-btn sp-btn-outline sp-btn-sm" target="_blank" rel="noreferrer"
              href={`https://wa.me/${String(selected.customer.phone).replace(/\D/g, '')}?text=${encodeURIComponent(`Hello ${selected.customer.name || ''}, this is SPOUZY about your order ${selected.order_no}.`)}`}>
              <i className="fa fa-whatsapp"></i> WhatsApp customer
            </a></p>
          )}
          {canEdit && (
            <>
              <div className="sp-form-group">
                <label className="sp-form-label">Internal notes (not shown to the customer)</label>
                <textarea className="sp-textarea" rows="3" value={selected.notesDraft} onChange={(e) => setSelected({ ...selected, notesDraft: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button className="sp-btn sp-btn-outline sp-btn-sm" onClick={() => save({ internal_notes: selected.notesDraft })}>Save note</button>
                {selected.status !== 'completed' && <button className="sp-btn sp-btn-primary sp-btn-sm" onClick={() => save({ status: 'completed', internal_notes: selected.notesDraft })}>Mark completed</button>}
                {selected.payment_status === 'pending' && selected.status !== 'cancelled' && (
                  <button className="sp-btn sp-btn-outline sp-btn-sm" onClick={() => window.confirm('Record this order as paid (for example, paid by bank transfer)?') && save({ status: 'paid', payment_status: 'paid', internal_notes: selected.notesDraft })}>Record payment received</button>
                )}
                {selected.payment_status === 'paid' && <button className="sp-btn sp-btn-outline sp-btn-sm" onClick={() => window.confirm('Mark this order as refunded? Make the refund in Razorpay first.') && save({ payment_status: 'refunded', status: 'cancelled', internal_notes: selected.notesDraft })}>Mark refunded</button>}
                {selected.status !== 'cancelled' && <button className="sp-btn sp-btn-outline sp-btn-sm" onClick={() => window.confirm('Cancel this order?') && save({ status: 'cancelled', internal_notes: selected.notesDraft })}>Cancel order</button>}
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Packages (prices and contents)                                       */
/* ------------------------------------------------------------------ */
const EMPTY_PACKAGE = {
  name: '', tagline: '', description: '', price_inr: 0, compare_at_inr: '', sessions_included: 1, session_minutes: 60,
  validity_days: 90, featuresText: '', service_slugs: [], badge: '', is_active: true, sort_order: 1
};

function PackagesPanel({ onMessage, registerAdd }) {
  const { user } = useAuth();
  const canEdit = user?.can('packages:edit');
  const [rows, setRows] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [p, s] = await Promise.all([api.get('/admin/packages'), api.get('/packages')]);
      setRows(p.data || []);
      setServices((s.data && s.data.services) || []);
    } catch (err) {
      onMessage(errorText(err), true);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => {
    registerAdd(canEdit ? () => setEditing({ ...EMPTY_PACKAGE, sort_order: rows.length + 1 }) : null);
  }, [registerAdd, canEdit, rows.length]);

  function open(p) {
    setEditing({
      ...EMPTY_PACKAGE, ...p,
      price_inr: p.price_inr,
      compare_at_inr: p.compare_at_inr || '',
      featuresText: (p.features || []).join('\n'),
      service_slugs: p.service_slugs || [],
      badge: p.badge || ''
    });
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        name: editing.name, tagline: editing.tagline, description: editing.description,
        price_inr: Number(editing.price_inr || 0), compare_at_inr: editing.compare_at_inr === '' ? null : Number(editing.compare_at_inr),
        sessions_included: editing.sessions_included, session_minutes: editing.session_minutes, validity_days: editing.validity_days,
        features: editing.featuresText.split('\n').map(s => s.trim()).filter(Boolean),
        service_slugs: editing.service_slugs, badge: editing.badge, is_active: !!editing.is_active, sort_order: editing.sort_order
      };
      if (editing.id) await api.put(`/admin/packages/${editing.id}`, body);
      else await api.post('/admin/packages', body);
      onMessage(editing.id ? 'Package saved. The website shows the change straight away.' : 'Package added to the website.');
      setEditing(null);
      load();
    } catch (err) {
      onMessage(errorText(err), true);
    } finally {
      setSaving(false);
    }
  }

  async function toggle(p) {
    try {
      await api.put(`/admin/packages/${p.id}`, { is_active: !p.is_active });
      load();
    } catch (err) {
      onMessage(errorText(err), true);
    }
  }

  function toggleService(slug) {
    const has = editing.service_slugs.includes(slug);
    setEditing({ ...editing, service_slugs: has ? editing.service_slugs.filter(s => s !== slug) : [...editing.service_slugs, slug] });
  }

  if (loading) return <Loading />;

  return (
    <div>
      <p style={{ marginTop: 0, fontSize: '13px', color: '#666' }}>
        These packages appear on the website's Packages page and in customers' accounts. A price of ₹0 makes a package free (one per customer).
        {!canEdit && ' Only administrators can change prices.'}
      </p>
      <div className="sp-table-wrapper">
        <table className="sp-table">
          <thead><tr><th>#</th><th>Package</th><th>Price</th><th>Sessions</th><th>Contents</th><th>Status</th>{canEdit && <th></th>}</tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: '20px', color: '#999' }}>No packages yet. Run <code>npm run db:seed</code> or add one.</td></tr>
            ) : rows.map(p => (
              <tr key={p.id}>
                <td>{p.sort_order}</td>
                <td><strong>{p.name}</strong>{p.badge && <span className="sp-badge new" style={{ marginLeft: '6px' }}>{p.badge}</span>}<div><small style={{ color: '#888' }}>{p.tagline}</small></div></td>
                <td>
                  <strong>{p.is_free ? 'Free' : inr(p.price_inr)}</strong>{p.compare_at_inr ? <div><small style={{ textDecoration: 'line-through', color: '#999' }}>{inr(p.compare_at_inr)}</small></div> : null}
                  {p.live_offer && (
                    <div className="sp-pkg-live-offer" title={p.live_offer.title}>
                      <i className="fa fa-tag" aria-hidden="true"></i> {p.live_offer.has_price ? `Offer ${inr(p.live_offer.price_inr)}` : 'Offer on card'}
                      {p.live_offer.end_date ? ` until ${formatDateIST(p.live_offer.end_date)}` : ''}
                    </div>
                  )}
                </td>
                <td>{p.sessions_included} × {p.session_minutes} min{p.validity_days ? <div><small>{p.validity_days} days</small></div> : null}</td>
                <td style={{ maxWidth: '300px' }}><small>{(p.features || []).join(' · ')}</small></td>
                <td><span className={`sp-badge ${p.is_active ? 'published' : 'closed'}`}>{p.is_active ? 'On website' : 'Hidden'}</span></td>
                {canEdit && (
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="sp-btn sp-btn-secondary sp-btn-sm" onClick={() => open(p)}>Edit</button>
                      <button className="sp-btn sp-btn-outline sp-btn-sm" onClick={() => toggle(p)}>{p.is_active ? 'Hide' : 'Show'}</button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal isOpen onClose={() => setEditing(null)} title={editing.id ? `Edit ${editing.name}` : 'New package'} maxWidth="780px">
          <form onSubmit={save}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
              <div className="sp-form-group">
                <label className="sp-form-label">Package name *</label>
                <input className="sp-input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required />
              </div>
              <div className="sp-form-group">
                <label className="sp-form-label">Badge (optional)</label>
                <input className="sp-input" placeholder="e.g. Most popular" value={editing.badge} onChange={(e) => setEditing({ ...editing, badge: e.target.value })} />
              </div>
            </div>
            <div className="sp-form-group">
              <label className="sp-form-label">Short line under the name</label>
              <input className="sp-input" value={editing.tagline || ''} onChange={(e) => setEditing({ ...editing, tagline: e.target.value })} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
              <div className="sp-form-group">
                <label className="sp-form-label">Price (₹) *</label>
                <input type="number" min="0" step="1" className="sp-input" value={editing.price_inr} onChange={(e) => setEditing({ ...editing, price_inr: e.target.value })} required />
              </div>
              <div className="sp-form-group">
                <label className="sp-form-label">Was price (₹)</label>
                <input type="number" min="0" step="1" className="sp-input" placeholder="optional" value={editing.compare_at_inr} onChange={(e) => setEditing({ ...editing, compare_at_inr: e.target.value })} />
              </div>
              <div className="sp-form-group">
                <label className="sp-form-label">Sessions</label>
                <input type="number" min="1" className="sp-input" value={editing.sessions_included} onChange={(e) => setEditing({ ...editing, sessions_included: e.target.value })} />
              </div>
              <div className="sp-form-group">
                <label className="sp-form-label">Minutes each</label>
                <select className="sp-select" value={editing.session_minutes} onChange={(e) => setEditing({ ...editing, session_minutes: parseInt(e.target.value, 10) })}>
                  {[15, 30, 45, 60, 90].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="sp-form-group">
                <label className="sp-form-label">Valid (days)</label>
                <input type="number" min="0" className="sp-input" value={editing.validity_days} onChange={(e) => setEditing({ ...editing, validity_days: e.target.value })} />
              </div>
            </div>
            <div className="sp-form-group">
              <label className="sp-form-label">What the package contains (one point per line)</label>
              <textarea className="sp-textarea" rows="5" value={editing.featuresText} onChange={(e) => setEditing({ ...editing, featuresText: e.target.value })} />
            </div>
            <div className="sp-form-group">
              <label className="sp-form-label">Description</label>
              <textarea className="sp-textarea" rows="2" value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </div>
            <div className="sp-form-group">
              <label className="sp-form-label">Services this package is for</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
                {services.map(s => <Toggle key={s.slug} label={s.name} checked={editing.service_slugs.includes(s.slug)} onChange={() => toggleService(s.slug)} />)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              <div className="sp-form-group" style={{ width: '120px', margin: 0 }}>
                <label className="sp-form-label">Order</label>
                <input type="number" className="sp-input" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: e.target.value })} />
              </div>
              <Toggle label="Show on the website" checked={editing.is_active} onChange={(v) => setEditing({ ...editing, is_active: v })} />
            </div>
            <FormActions onCancel={() => setEditing(null)} saving={saving} />
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Customers                                                            */
/* ------------------------------------------------------------------ */
const EVENT_ICONS = {
  page_view: 'fa-file-o', click: 'fa-hand-pointer-o', signup: 'fa-user-plus', login: 'fa-sign-in', login_failed: 'fa-exclamation-triangle',
  logout: 'fa-sign-out', password_changed: 'fa-key', profile_updated: 'fa-id-card-o', cart_add: 'fa-cart-plus', cart_remove: 'fa-trash-o',
  checkout: 'fa-shopping-bag', payment: 'fa-inr', booking: 'fa-calendar-check-o', booking_step: 'fa-calendar'
};
const KEY_EVENTS = ['signup', 'login', 'login_failed', 'logout', 'booking', 'checkout', 'payment', 'cart_add', 'cart_remove', 'profile_updated', 'password_changed'];

function dayKey(at) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(at));
}
function timeIST(at) {
  return new Date(at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
}
function deviceOf(ua) {
  const u = String(ua || '');
  const os = /Android/i.test(u) ? 'Android' : /iPhone|iPad/i.test(u) ? 'iPhone/iPad' : /Windows/i.test(u) ? 'Windows' : /Mac OS/i.test(u) ? 'Mac' : /Linux/i.test(u) ? 'Linux' : '';
  const br = /Edg\//.test(u) ? 'Edge' : /Chrome\//.test(u) ? 'Chrome' : /Firefox\//.test(u) ? 'Firefox' : /Safari\//.test(u) ? 'Safari' : '';
  return [br, os].filter(Boolean).join(' on ');
}

function ActivityModal({ customerId, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [days, setDays] = useState(30);
  const [onlyKey, setOnlyKey] = useState(false);

  useEffect(() => {
    let alive = true;
    setData(null);
    api.get(`/admin/customers/${customerId}/activity?days=${days}`)
      .then(res => { if (alive) setData(res.data); })
      .catch(err => { if (alive) setError(errorText(err)); });
    return () => { alive = false; };
  }, [customerId, days]);

  const events = data ? data.events.filter(e => !onlyKey || KEY_EVENTS.includes(e.event)) : [];
  const groups = [];
  events.forEach(e => {
    const k = dayKey(e.at);
    let g = groups.find(x => x.day === k);
    if (!g) { g = { day: k, items: [] }; groups.push(g); }
    g.items.push(e);
  });

  return (
    <Modal isOpen onClose={onClose} title={data ? `Activity — ${data.customer.name || data.customer.email}` : 'Activity'} maxWidth="820px">
      {error && <div className="sp-inline-alert error">{error}</div>}
      {!data && !error && <Loading />}
      {data && (
        <>
          <div className="sp-detail-grid">
            <div><span className="sp-detail-label">Customer</span><div><strong>{data.customer.name}</strong></div><div>{data.customer.email}</div><div>{data.customer.phone}</div></div>
            <div><span className="sp-detail-label">Account</span><div>Joined {formatDateIST(data.customer.joined)}</div><div>Last login {data.customer.last_login_at ? formatDateTimeIST(data.customer.last_login_at) : '—'}</div></div>
          </div>
          {data.appointments.length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <span className="sp-detail-label">Appointments booked from the account</span>
              <ul style={{ margin: '6px 0 0 18px', fontSize: '13px', lineHeight: 1.6 }}>
                {data.appointments.map(a => (
                  <li key={a.id}><strong>{a.reference_no}</strong> · {formatDateIST(a.date)} {a.start_time} · {a.service} · {a.booking_type === 'free' ? 'Free consultation' : `Paid booking (payment ${a.payment_status})`} · {a.status}</li>
                ))}
              </ul>
            </div>
          )}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
            <select className="sp-select" style={{ width: '160px' }} value={days} onChange={(e) => setDays(parseInt(e.target.value, 10))}>
              <option value={1}>Today</option>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={180}>Last 180 days</option>
            </select>
            <Toggle label="Only logins, bookings and orders" checked={onlyKey} onChange={setOnlyKey} />
            <small style={{ color: '#888' }}>{events.length} events</small>
          </div>
          {groups.length === 0 ? <p style={{ color: '#999' }}>No activity in this period.</p> : groups.map(g => (
            <div key={g.day} className="sp-activity-day">
              <div className="sp-activity-day-title">{formatDateIST(g.day)}</div>
              {g.items.map(e => (
                <div key={e.id} className={`sp-activity-item ev-${e.event}`}>
                  <span className="sp-activity-time">{timeIST(e.at)}</span>
                  <i className={`fa ${EVENT_ICONS[e.event] || 'fa-circle-o'}`} aria-hidden="true"></i>
                  <div className="sp-activity-text">
                    <strong>{e.event_label}</strong>{e.label ? <> · {e.label}</> : null}
                    <div className="sp-activity-meta">
                      {e.page && <span>{e.page}</span>}
                      {e.details && e.details.href && <span>→ {e.details.href}</span>}
                      {e.details && e.details.before_login && <span className="sp-activity-pre">before login</span>}
                      {(e.event === 'login' || e.event === 'signup' || e.event === 'login_failed') && <span>{deviceOf(e.user_agent)}{e.ip_address ? ` · ${e.ip_address}` : ''}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </Modal>
  );
}

function ActiveTodayPanel({ onOpen }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    api.get('/admin/customer-activity').then(res => setRows(res.data.customers || [])).catch(() => setRows([]));
  }, []);
  if (!rows) return null;
  return (
    <div className="sp-card" style={{ background: '#FBF8F3', marginBottom: '16px' }}>
      <h3 style={{ marginTop: 0, fontSize: '15px' }}><i className="fa fa-bolt"></i> Customers active today ({rows.length})</h3>
      {rows.length === 0 ? <p style={{ margin: 0, color: '#888', fontSize: '13px' }}>No logged-in customer activity yet today.</p> : (
        <div className="sp-table-wrapper">
          <table className="sp-table">
            <thead><tr><th>Customer</th><th>First seen</th><th>Last seen</th><th>Logins</th><th>Pages</th><th>Bookings</th><th>Orders</th><th>Last page</th><th></th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.user_id}>
                  <td><strong>{r.name}</strong><div><small style={{ color: '#888' }}>{r.email}</small></div></td>
                  <td>{timeIST(r.first_seen)}</td>
                  <td>{timeIST(r.last_seen)}</td>
                  <td>{r.logins}</td>
                  <td>{r.pages}</td>
                  <td>{r.bookings}</td>
                  <td>{r.orders}</td>
                  <td><small>{r.last_page || '—'}</small></td>
                  <td><button className="sp-btn sp-btn-secondary sp-btn-sm" onClick={() => onOpen(r.user_id)}>Trail</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CustomersPanel({ onMessage }) {
  const { user } = useAuth();
  const canEdit = user?.can('orders:edit');
  const [search, setSearch] = useState('');
  const [data, setData] = useState({ total: 0, customers: [] });
  const [loading, setLoading] = useState(true);
  const [activityFor, setActivityFor] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get(`/admin/customers?limit=100${search ? `&search=${encodeURIComponent(search)}` : ''}`);
      setData(res.data || { total: 0, customers: [] });
    } catch (err) {
      onMessage(errorText(err), true);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function setActive(c, active) {
    if (!active && !window.confirm(`Disable ${c.email}? They will be signed out and cannot log in.`)) return;
    try {
      await api.patch(`/admin/customers/${c.id}`, { is_active: active });
      onMessage(active ? 'Customer account enabled' : 'Customer account disabled');
      load();
    } catch (err) {
      onMessage(errorText(err), true);
    }
  }

  async function resetPassword(c) {
    const pw = window.prompt(`New temporary password for ${c.email} (at least 8 characters with upper-case, lower-case and a number). Share it with the customer privately, e.g. on WhatsApp.`);
    if (!pw) return;
    try {
      await api.patch(`/admin/customers/${c.id}`, { password: pw });
      onMessage(`Password reset for ${c.email}. They have been signed out everywhere.`);
    } catch (err) {
      onMessage(errorText(err), true);
    }
  }

  return (
    <div>
      <ActiveTodayPanel onOpen={setActivityFor} />
      {activityFor && <ActivityModal customerId={activityFor} onClose={() => setActivityFor(null)} />}
      <form className="sp-filters-bar" onSubmit={(e) => { e.preventDefault(); load(); }}>
        <div style={{ flex: 1 }}><input className="sp-input" placeholder="Search name, email or phone" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <button type="submit" className="sp-btn sp-btn-secondary">Search</button>
      </form>
      {loading ? <Loading /> : (
        <div className="sp-table-wrapper">
          <table className="sp-table">
            <thead><tr><th>Customer</th><th>Phone</th><th>Joined</th><th>Last seen</th><th>Orders</th><th>Paid</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {data.customers.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '24px', color: '#999' }}>No customer accounts yet.</td></tr>
              ) : data.customers.map(c => (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong><div><small style={{ color: '#888' }}>{c.email}</small></div></td>
                  <td>{c.phone}</td>
                  <td>{formatDateIST(c.joined)}</td>
                  <td>
                    {c.last_seen ? formatDateTimeIST(c.last_seen) : (c.last_login_at ? formatDateTimeIST(c.last_login_at) : '—')}
                    {c.active_today && <div><span className="sp-badge confirmed">Active today</span></div>}
                  </td>
                  <td>{c.orders}</td>
                  <td>{c.paid_total_inr ? inr(c.paid_total_inr) : '—'}</td>
                  <td><span className={`sp-badge ${c.is_active ? 'approved' : 'rejected'}`}>{c.is_active ? 'Active' : 'Disabled'}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button className="sp-btn sp-btn-secondary sp-btn-sm" onClick={() => setActivityFor(c.id)}>Activity</button>
                      {canEdit && <button className="sp-btn sp-btn-outline sp-btn-sm" onClick={() => resetPassword(c)}>Reset password</button>}
                      {canEdit && <button className="sp-btn sp-btn-outline sp-btn-sm" onClick={() => setActive(c, !c.is_active)}>{c.is_active ? 'Disable' : 'Enable'}</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ fontSize: '12.5px', color: '#888' }}>{data.total} customer accounts. When a customer forgets their password they message you on WhatsApp; use "Reset password" and send them the new one privately.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
export default function ShopPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabs = [
    { key: 'orders', label: 'Orders', icon: 'fa-shopping-bag', perm: 'orders:view' },
    { key: 'packages', label: 'Packages & Prices', icon: 'fa-gift', perm: ['packages:view', 'orders:view'], add: 'Add Package' },
    { key: 'bills', label: 'Bills', icon: 'fa-file-text-o', perm: 'orders:view' },
    { key: 'offers', label: 'Offers', icon: 'fa-tag', perm: 'offers:view', add: 'Add Offer' },
    { key: 'customers', label: 'Customers', icon: 'fa-users', perm: 'orders:view' }
  ].filter(t => (Array.isArray(t.perm) ? t.perm : [t.perm]).some(p => user?.can(p)));
  const requested = searchParams.get('tab');
  const tab = tabs.find(t => t.key === requested) ? requested : (tabs[0]?.key || '');
  const current = tabs.find(t => t.key === tab);

  const [feedback, setFeedback] = useState('');
  const [pageError, setPageError] = useState('');
  const [addHandler, setAddHandler] = useState(null);

  const onMessage = useCallback((msg, isErr = false) => {
    if (isErr) { setPageError(msg); setTimeout(() => setPageError(''), 7000); }
    else { setFeedback(msg); setTimeout(() => setFeedback(''), 5000); }
  }, []);
  const registerAdd = useCallback((fn) => setAddHandler(() => fn), []);

  return (
    <div className="sp-card">
      <div className="sp-card-header">
        <h2 className="sp-card-title"><i className="fa fa-shopping-bag" style={{ marginRight: '8px' }}></i> Packages, Bills &amp; Orders</h2>
        {current?.add && addHandler && (
          <button type="button" className="sp-btn sp-btn-primary sp-btn-sm" onClick={() => addHandler()}><i className="fa fa-plus"></i> {current.add}</button>
        )}
      </div>
      {feedback && <div className="sp-inline-alert success"><i className="fa fa-check-circle"></i> {feedback}</div>}
      {pageError && <div className="sp-inline-alert error"><i className="fa fa-exclamation-circle"></i> {pageError}</div>}
      <div className="sp-tabs">
        {tabs.map(t => (
          <button key={t.key} type="button" className={`sp-tab-btn ${tab === t.key ? 'active' : ''}`} onClick={() => { setAddHandler(null); setSearchParams({ tab: t.key }); }}>
            <i className={`fa ${t.icon}`}></i> {t.label}
          </button>
        ))}
      </div>
      <HelpBox key={`help-${tab}`} topic={`shop.${tab}`} />
      {tab === 'orders' && <OrdersPanel key="orders" onMessage={onMessage} initialStatus={searchParams.get('status') || ''} />}
      {tab === 'packages' && <PackagesPanel key="packages" onMessage={onMessage} registerAdd={registerAdd} />}
      {tab === 'bills' && <BillsPanel key="bills" onMessage={onMessage} initialStatus={searchParams.get('status')} openBillId={searchParams.get('bill')} onCloseBill={() => setSearchParams({ tab: 'bills' })} />}
      {tab === 'offers' && <OffersPanel key="offers" onMessage={onMessage} registerAdd={registerAdd} />}
      {tab === 'customers' && <CustomersPanel key="customers" onMessage={onMessage} />}
    </div>
  );
}
