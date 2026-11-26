import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Modal from './Modal';
import { ImageField } from './content/common';
import { formatDateIST, todayIST, formatInrFromMinor } from '../constants/statuses';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ROLE_LABELS = { doctor: 'Doctor', counsellor: 'Counsellor', mediator: 'Mediator' };
const MODE_OPTIONS = [
  { value: 'video', label: 'Video / audio' },
  { value: 'in-person', label: 'In person' },
  { value: 'phone', label: 'Phone' }
];

function usePractitioners() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  async function reload() {
    setLoading(true);
    try {
      const res = await api.get('/admin/practitioners');
      if (res.success) setList(res.data || []);
    } catch (e) {
      setList([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { reload(); }, []);
  return { list, loading, reload };
}

/* ------------------------------------------------------------------ */
/* Blocked time (holidays, leave, meetings)                            */
/* ------------------------------------------------------------------ */
export function BlockedTimePanel({ onMessage }) {
  const { user } = useAuth();
  const canEdit = user?.can('scheduling:edit');
  const { list: practitioners } = usePractitioners();
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPast, setShowPast] = useState(false);
  const [form, setForm] = useState({ practitioner_id: '', block_date: todayIST(), start_time: '09:00', end_time: '21:00', reason: '' });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/admin/schedules/blocks');
      if (res.success) setBlocks(res.data || []);
    } catch (e) {
      onMessage(e.message, true);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function addBlock(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/admin/schedules/block', { ...form, practitioner_id: form.practitioner_id ? parseInt(form.practitioner_id, 10) : null });
      onMessage('Time blocked. Those slots now show as unavailable on the website.');
      setForm({ ...form, reason: '' });
      load();
    } catch (err) {
      onMessage(err.message, true);
    } finally {
      setSaving(false);
    }
  }

  async function removeBlock(id) {
    if (!window.confirm('Remove this blocked time? The slots will become bookable again.')) return;
    try {
      await api.delete(`/admin/schedules/blocks/${id}`);
      onMessage('Blocked time removed');
      load();
    } catch (err) {
      onMessage(err.message, true);
    }
  }

  const today = todayIST();
  const visible = blocks
    .filter(b => showPast || b.block_date >= today)
    .sort((a, b) => (a.block_date + a.start_time).localeCompare(b.block_date + b.start_time));
  const nameOf = (id) => {
    if (!id) return 'Whole clinic';
    const p = practitioners.find(x => x.id === id);
    return p ? p.name : `Practitioner #${id}`;
  };

  return (
    <div>
      {canEdit && (
        <form onSubmit={addBlock} className="sp-card" style={{ background: '#FBF8F3', marginBottom: '18px' }}>
          <h3 style={{ marginTop: 0, fontSize: '15px' }}>Block time (leave, holiday, meeting)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
            <div className="sp-form-group">
              <label className="sp-form-label">Who</label>
              <select className="sp-select" value={form.practitioner_id} onChange={(e) => setForm({ ...form, practitioner_id: e.target.value })}>
                <option value="">Whole clinic (everyone)</option>
                {practitioners.map(p => <option key={p.id} value={p.id}>{p.name} ({ROLE_LABELS[p.role_type] || p.role_type})</option>)}
              </select>
            </div>
            <div className="sp-form-group">
              <label className="sp-form-label">Date</label>
              <input type="date" className="sp-input" min={today} value={form.block_date} onChange={(e) => setForm({ ...form, block_date: e.target.value })} required />
            </div>
            <div className="sp-form-group">
              <label className="sp-form-label">From</label>
              <input type="time" className="sp-input" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} required />
            </div>
            <div className="sp-form-group">
              <label className="sp-form-label">To</label>
              <input type="time" className="sp-input" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} required />
            </div>
          </div>
          <div className="sp-form-group">
            <label className="sp-form-label">Reason (internal)</label>
            <input type="text" className="sp-input" placeholder="e.g. Diwali holiday, staff training" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button type="submit" className="sp-btn sp-btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Block this time'}</button>
            <button type="button" className="sp-btn sp-btn-outline sp-btn-sm" onClick={() => setForm({ ...form, start_time: '00:00', end_time: '23:59' })}>Whole day</button>
          </div>
        </form>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <strong>{showPast ? 'All blocked time' : 'Upcoming blocked time'}</strong>
        <label style={{ fontSize: '13px' }}><input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} /> Show past</label>
      </div>
      <div className="sp-table-wrapper">
        <table className="sp-table">
          <thead><tr><th>Date</th><th>Time</th><th>Who</th><th>Reason</th>{canEdit && <th></th>}</tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}><i className="fa fa-spinner fa-spin"></i></td></tr>
            ) : visible.length === 0 ? (
              <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: '#999' }}>No blocked time.</td></tr>
            ) : visible.map(b => (
              <tr key={b.id}>
                <td>{formatDateIST(b.block_date)}</td>
                <td>{b.start_time}–{b.end_time}</td>
                <td>{nameOf(b.practitioner_id)}</td>
                <td>{b.reason}</td>
                {canEdit && <td><button className="sp-btn sp-btn-outline sp-btn-sm" onClick={() => removeBlock(b.id)}>Remove</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Practitioners and their weekly working hours                         */
/* ------------------------------------------------------------------ */
const EMPTY_PRACTITIONER = { name: '', title: '', role_type: 'counsellor', qualifications: '', bio: '', photo_url: '', email: '', phone: '', is_active: true };

export function PractitionersPanel({ onMessage }) {
  const { user } = useAuth();
  const canEdit = user?.can('practitioners:edit');
  const { list, loading, reload } = usePractitioners();
  const [editing, setEditing] = useState(null);
  const [hoursFor, setHoursFor] = useState(null);
  const [week, setWeek] = useState([]);
  const [saving, setSaving] = useState(false);

  async function savePractitioner(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing.id) await api.put(`/admin/practitioners/${editing.id}`, editing);
      else await api.post('/admin/practitioners', editing);
      onMessage(editing.id ? 'Practitioner updated' : 'Practitioner added with default 09:00–21:00 hours');
      setEditing(null);
      reload();
    } catch (err) {
      onMessage(err.message, true);
    } finally {
      setSaving(false);
    }
  }

  async function openHours(p) {
    try {
      const res = await api.get(`/admin/practitioners/${p.id}/schedule`);
      setWeek(res.data || []);
      setHoursFor(p);
    } catch (err) {
      onMessage(err.message, true);
    }
  }

  async function saveHours(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/admin/practitioners/${hoursFor.id}/schedule`, { week });
      onMessage(`Working hours saved for ${hoursFor.name}`);
      setHoursFor(null);
    } catch (err) {
      onMessage(err.message, true);
    } finally {
      setSaving(false);
    }
  }

  function setDay(idx, patch) {
    setWeek(week.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
          Counselling services are booked with counsellors, the intimacy clinic with doctors and mediation with mediators. Inactive practitioners are hidden from the website.
        </p>
        {canEdit && <button className="sp-btn sp-btn-primary sp-btn-sm" onClick={() => setEditing({ ...EMPTY_PRACTITIONER })}><i className="fa fa-plus"></i> Add practitioner</button>}
      </div>
      <div className="sp-table-wrapper">
        <table className="sp-table">
          <thead><tr><th>Name</th><th>Type</th><th>Contact</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}><i className="fa fa-spinner fa-spin"></i></td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: '#999' }}>No practitioners yet.</td></tr>
            ) : list.map(p => (
              <tr key={p.id}>
                <td><strong>{p.name}</strong><div><small style={{ color: '#888' }}>{p.title}</small></div></td>
                <td>{ROLE_LABELS[p.role_type] || p.role_type}</td>
                <td><small>{p.email}{p.phone ? <><br />{p.phone}</> : null}</small></td>
                <td><span className={`sp-badge ${p.is_active ? 'confirmed' : 'closed'}`}>{p.is_active ? 'Active' : 'Inactive'}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="sp-btn sp-btn-secondary sp-btn-sm" onClick={() => openHours(p)}>Working hours</button>
                    {canEdit && <button className="sp-btn sp-btn-outline sp-btn-sm" onClick={() => setEditing({ ...EMPTY_PRACTITIONER, ...p })}>Edit</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal isOpen onClose={() => setEditing(null)} title={editing.id ? `Edit ${editing.name}` : 'Add practitioner'}>
          <form onSubmit={savePractitioner}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="sp-form-group">
                <label className="sp-form-label">Full name *</label>
                <input className="sp-input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required />
              </div>
              <div className="sp-form-group">
                <label className="sp-form-label">Title shown to clients *</label>
                <input className="sp-input" placeholder="e.g. Senior Couples Counsellor" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} required />
              </div>
              <div className="sp-form-group">
                <label className="sp-form-label">Type</label>
                <select className="sp-select" value={editing.role_type} onChange={(e) => setEditing({ ...editing, role_type: e.target.value })}>
                  <option value="counsellor">Counsellor</option>
                  <option value="doctor">Doctor</option>
                  <option value="mediator">Mediator</option>
                </select>
              </div>
              <div className="sp-form-group">
                <label className="sp-form-label">Qualifications</label>
                <input className="sp-input" value={editing.qualifications || ''} onChange={(e) => setEditing({ ...editing, qualifications: e.target.value })} />
              </div>
              <div className="sp-form-group">
                <label className="sp-form-label">Email</label>
                <input type="email" className="sp-input" value={editing.email || ''} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
              </div>
              <div className="sp-form-group">
                <label className="sp-form-label">Phone</label>
                <input className="sp-input" value={editing.phone || ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
              </div>
            </div>
            <ImageField label="Photo" spec="staffPhoto" value={editing.photo_url} onChange={(v) => setEditing({ ...editing, photo_url: v })} hint="Optional." />
            <div className="sp-form-group">
              <label className="sp-form-label">Short bio</label>
              <textarea className="sp-textarea" rows="3" value={editing.bio || ''} onChange={(e) => setEditing({ ...editing, bio: e.target.value })} />
            </div>
            <label style={{ fontSize: '13px' }}><input type="checkbox" checked={!!editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} /> Active (bookable on the website)</label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button type="button" className="sp-btn sp-btn-outline" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className="sp-btn sp-btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}

      {hoursFor && (
        <Modal isOpen onClose={() => setHoursFor(null)} title={`Working hours — ${hoursFor.name}`}>
          <form onSubmit={saveHours}>
            <p style={{ fontSize: '13px', color: '#666', marginTop: 0 }}>Times are IST. Slots are offered every 30 minutes between opening and closing time.</p>
            <table className="sp-table">
              <thead><tr><th>Day</th><th>Working</th><th>Opens</th><th>Closes</th></tr></thead>
              <tbody>
                {week.map((d, idx) => (
                  <tr key={d.day_of_week}>
                    <td>{DAY_NAMES[d.day_of_week]}</td>
                    <td><input type="checkbox" disabled={!canEdit} checked={!!d.is_working_day} onChange={(e) => setDay(idx, { is_working_day: e.target.checked })} /></td>
                    <td><input type="time" step="1800" className="sp-input" disabled={!canEdit || !d.is_working_day} value={d.open_time} onChange={(e) => setDay(idx, { open_time: e.target.value })} /></td>
                    <td><input type="time" step="1800" className="sp-input" disabled={!canEdit || !d.is_working_day} value={d.close_time} onChange={(e) => setDay(idx, { close_time: e.target.value })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button type="button" className="sp-btn sp-btn-outline" onClick={() => setHoursFor(null)}>Close</button>
              {canEdit && <button type="submit" className="sp-btn sp-btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save hours'}</button>}
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Services and prices (used for paid bookings and Razorpay orders)     */
/* ------------------------------------------------------------------ */
export function ServicesPanel({ onMessage }) {
  const { user } = useAuth();
  const canEdit = user?.can('scheduling:edit');
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/admin/services');
      if (res.success) setServices(res.data || []);
    } catch (e) {
      onMessage(e.message, true);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function openEdit(s) {
    setEditing({
      ...s,
      price30: Math.round((s.price_30_minor || 0) / 100),
      price60: Math.round((s.price_60_minor || 0) / 100),
      modes: Array.isArray(s.modes) ? s.modes : []
    });
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/admin/services/${editing.id}`, {
        name: editing.name,
        description: editing.description || '',
        is_active: !!editing.is_active,
        sort_order: editing.sort_order,
        price_30_minor: Math.round(Number(editing.price30) * 100),
        price_60_minor: Math.round(Number(editing.price60) * 100),
        modes: editing.modes
      });
      onMessage('Service updated. New bookings use the new price.');
      setEditing(null);
      load();
    } catch (err) {
      onMessage(err.message, true);
    } finally {
      setSaving(false);
    }
  }

  function toggleMode(mode) {
    const has = editing.modes.includes(mode);
    setEditing({ ...editing, modes: has ? editing.modes.filter(m => m !== mode) : [...editing.modes, mode] });
  }

  return (
    <div>
      <p style={{ marginTop: 0, fontSize: '13px', color: '#666' }}>
        Prices apply to paid bookings only (free consultations are always ₹0). The amount charged online is always taken from here, never from the browser.
      </p>
      <div className="sp-table-wrapper">
        <table className="sp-table">
          <thead><tr><th>Service</th><th>30 min</th><th>60 min</th><th>Modes</th><th>Status</th>{canEdit && <th></th>}</tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}><i className="fa fa-spinner fa-spin"></i></td></tr>
            ) : services.map(s => (
              <tr key={s.id}>
                <td><strong>{s.name}</strong><div><small style={{ color: '#888' }}>{s.slug}</small></div></td>
                <td>{formatInrFromMinor(s.price_30_minor)}</td>
                <td>{formatInrFromMinor(s.price_60_minor)}</td>
                <td><small>{(s.modes || []).map(m => (MODE_OPTIONS.find(o => o.value === m) || { label: m }).label).join(', ')}</small></td>
                <td><span className={`sp-badge ${s.is_active ? 'confirmed' : 'closed'}`}>{s.is_active ? 'Active' : 'Hidden'}</span></td>
                {canEdit && <td><button className="sp-btn sp-btn-outline sp-btn-sm" onClick={() => openEdit(s)}>Edit</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal isOpen onClose={() => setEditing(null)} title={`Edit ${editing.name}`}>
          <form onSubmit={save}>
            <div className="sp-form-group">
              <label className="sp-form-label">Name</label>
              <input className="sp-input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required />
            </div>
            <div className="sp-form-group">
              <label className="sp-form-label">Description</label>
              <textarea className="sp-textarea" rows="2" value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div className="sp-form-group">
                <label className="sp-form-label">Price 30 min (₹)</label>
                <input type="number" min="0" step="1" className="sp-input" value={editing.price30} onChange={(e) => setEditing({ ...editing, price30: e.target.value })} required />
              </div>
              <div className="sp-form-group">
                <label className="sp-form-label">Price 60 min (₹)</label>
                <input type="number" min="0" step="1" className="sp-input" value={editing.price60} onChange={(e) => setEditing({ ...editing, price60: e.target.value })} required />
              </div>
              <div className="sp-form-group">
                <label className="sp-form-label">Sort order</label>
                <input type="number" className="sp-input" value={editing.sort_order || 0} onChange={(e) => setEditing({ ...editing, sort_order: e.target.value })} />
              </div>
            </div>
            <div className="sp-form-group">
              <label className="sp-form-label">Consultation modes</label>
              <div style={{ display: 'flex', gap: '14px' }}>
                {MODE_OPTIONS.map(o => (
                  <label key={o.value} style={{ fontSize: '13px' }}><input type="checkbox" checked={editing.modes.includes(o.value)} onChange={() => toggleMode(o.value)} /> {o.label}</label>
                ))}
              </div>
            </div>
            <label style={{ fontSize: '13px' }}><input type="checkbox" checked={!!editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} /> Active (bookable)</label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button type="button" className="sp-btn sp-btn-outline" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className="sp-btn sp-btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
