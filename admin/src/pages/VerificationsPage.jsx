import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import HelpBox from '../components/HelpBox';
import { formatDateTimeIST, formatDateIST } from '../constants/statuses';
import { errorText } from '../components/content/common';

/**
 * Student and ex-servicemen / defence ID proofs.
 * The admin checks the uploaded ID, then approves it (benefit: free consultation without the
 * 2-month wait) or rejects it with a message telling the customer what to upload instead.
 */

const TABS = [
  { key: 'pending', label: 'Waiting for review', icon: 'fa-hourglass-half' },
  { key: 'approved', label: 'Approved', icon: 'fa-check-circle' },
  { key: 'expired', label: 'Expired', icon: 'fa-calendar-times-o' },
  { key: 'rejected', label: 'Rejected', icon: 'fa-times-circle' },
  { key: 'reminders', label: 'Yearly reminders', icon: 'fa-bell-o' },
  { key: 'all', label: 'All', icon: 'fa-list' }
];

const STATE_LABEL = { pending: 'Waiting for review', approved: 'Approved', expired: 'Expired', rejected: 'Rejected' };

// Ready-made reasons; the admin can edit the text before sending
const REASONS = [
  { label: 'Blurry / cut off', text: 'The photo is blurry or part of the ID is cut off. Please upload a clear photo of the whole ID card, in good light.' },
  { label: 'Name does not match', text: 'The name on the ID does not match the name on your SPOUZY account. Please upload an ID in your own name, or contact us to correct the name on your account.' },
  { label: 'Valid-until date not visible', text: 'We could not see the date your ID is valid until. Please upload the side of the ID (or a bonafide certificate) that shows the validity date.' },
  { label: 'ID expired', text: 'This ID has already expired. Please upload your current, valid ID.' },
  { label: 'Not an accepted ID', text: 'This document is not an accepted ID. Students: please upload your college / institution ID card or a bonafide certificate. Ex-servicemen / defence: please upload your ESM identity card, service ID or discharge book.' },
  { label: 'Details unreadable', text: 'Some details on the ID cannot be read. Please upload a sharper photo or a PDF scan of the ID.' }
];

function Loading() {
  return <div style={{ textAlign: 'center', padding: '30px', color: '#666' }}><i className="fa fa-spinner fa-spin fa-2x"></i></div>;
}

function waLink(phone, text) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  const full = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}

function StatePill({ state }) {
  return <span className={`sp-ver-state is-${state}`}>{STATE_LABEL[state] || state}</span>;
}

function CategoryPill({ item }) {
  return (
    <span className={`sp-ver-cat is-${item.category}`}>
      <i className={`fa ${item.category === 'student' ? 'fa-graduation-cap' : 'fa-shield'}`}></i> {item.category_label}
    </span>
  );
}

function isImage(f) { return /^image\//.test(f.type || ''); }

function FileThumb({ file, large }) {
  if (isImage(file)) {
    return (
      <a href={file.url} target="_blank" rel="noopener noreferrer" className={`sp-ver-file ${large ? 'is-large' : ''}`} title={`Open ${file.which === 'back' ? 'back' : 'front'} side in a new tab`}>
        <img src={file.url} alt={`ID ${file.which}`} loading="lazy" />
        <span>{file.which === 'back' ? 'Back' : 'Front'}</span>
      </a>
    );
  }
  return (
    <a href={file.url} target="_blank" rel="noopener noreferrer" className={`sp-ver-file is-pdf ${large ? 'is-large' : ''}`} title="Open the PDF in a new tab">
      <i className="fa fa-file-pdf-o"></i>
      <span>{file.which === 'back' ? 'Back' : 'Front'} · PDF</span>
    </a>
  );
}

function Details({ item }) {
  return (
    <div className="sp-ver-facts">
      {item.category === 'student'
        ? <div><span>College / institution</span>{item.institution_name || '—'}</div>
        : <div><span>Service</span>{item.service_branch || '—'}</div>}
      <div><span>ID number</span>{item.id_number || '—'}</div>
      <div><span>Valid until</span>{item.category === 'student' ? (item.expiry_date ? formatDateIST(item.expiry_date) : '—') : 'No expiry (ex-servicemen)'}</div>
      <div><span>Uploaded</span>{formatDateTimeIST(item.submitted_at)}</div>
    </div>
  );
}

function ReviewModal({ id, canEdit, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [mode, setMode] = useState(null); // 'approve' | 'reject'
  const [expiry, setExpiry] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState('');

  const load = useCallback(() => {
    setError('');
    return api.get(`/admin/verifications/${id}`).then(r => {
      setData(r.data);
      setExpiry(r.data.expiry_date || '');
      setNote(r.data.internal_note || '');
    }).catch(e => setError(errorText(e)));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function act(kind) {
    setSaving(true);
    setError('');
    try {
      let r;
      if (kind === 'approve') {
        r = await api.post(`/admin/verifications/${id}/approve`, { ...(data.category === 'student' ? { expiry_date: expiry } : {}), internal_note: note });
        setDone('Approved. The customer can now book the free consultation without waiting.');
      } else if (kind === 'reject') {
        r = await api.post(`/admin/verifications/${id}/reject`, { message, internal_note: note });
        setDone('Rejected. The customer sees your message on their account page and can upload again.');
      } else {
        r = await api.post(`/admin/verifications/${id}/reminded`, {});
        setDone('Marked as reminded. The next reminder comes in a year.');
      }
      setData(r.data);
      setMode(null);
      onChanged();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const c = data?.customer || {};
  const b = data?.benefit;

  return (
    <Modal isOpen onClose={onClose} title={data ? `${data.category_label} ID — ${c.name || 'customer'}` : 'ID proof'} maxWidth="880px">
      {error && <div className="sp-inline-alert error">{error}</div>}
      {done && <div className="sp-inline-alert success"><i className="fa fa-check-circle"></i> {done}</div>}
      {!data && !error && <Loading />}
      {data && (
        <div className="sp-ver-review">
          <div className="sp-ver-review-files">
            {data.files.length ? data.files.map(f => <FileThumb key={f.id} file={f} large />) : <p className="sp-ver-muted">No file found.</p>}
            <p className="sp-ver-muted"><i className="fa fa-lock"></i> Only the admin can open these files. Click a file to open it full size.</p>
          </div>
          <div>
            <div className="sp-ver-review-head">
              <CategoryPill item={data} /> <StatePill state={data.state} />
            </div>
            <div className="sp-ver-facts">
              <div><span>Name on account</span><strong>{c.name}</strong></div>
              <div><span>Email</span>{c.email}</div>
              <div><span>Mobile</span>{c.phone || '—'}</div>
            </div>
            <Details item={data} />
            {data.reviewed_at && (
              <p className="sp-ver-muted">
                {data.status === 'approved' ? 'Approved' : data.status === 'rejected' ? 'Rejected' : 'Checked'} {formatDateTimeIST(data.reviewed_at)}{data.reviewer ? ` by ${data.reviewer}` : ''}
              </p>
            )}
            {data.status === 'rejected' && data.admin_message && (
              <div className="sp-ver-msg"><span>Message the customer sees</span>{data.admin_message}</div>
            )}
            {b && b.active && b.verification_id === data.id && (
              <div className="sp-ver-benefit">
                <i className="fa fa-gift"></i> Benefit active{b.valid_until ? ` until ${b.valid_until_text}` : ' (no expiry)'} — free consultation can be booked from today, one at a time.
                {b.category === 'ex_servicemen' && (
                  <div className="sp-ver-muted">Last consultation: {b.last_consultation ? formatDateIST(b.last_consultation) : 'none yet'} · Next yearly reminder: {b.next_reminder ? formatDateIST(b.next_reminder) : '—'}</div>
                )}
              </div>
            )}
            {data.state === 'expired' && <div className="sp-ver-warn"><i className="fa fa-calendar-times-o"></i> This ID expired on {formatDateIST(data.expiry_date)}. The customer now sees the normal options (paid plan, or free after 2 months) until they upload a new ID.</div>}

            {canEdit && !mode && (
              <div className="sp-ver-actions">
                {data.status !== 'approved' && data.state !== 'expired' && (
                  <button type="button" className="sp-btn sp-btn-primary" onClick={() => { setMode('approve'); setDone(''); }}><i className="fa fa-check"></i> Approve</button>
                )}
                {data.status === 'approved' && data.state !== 'expired' && data.category === 'student' && (
                  <button type="button" className="sp-btn sp-btn-secondary" onClick={() => { setMode('approve'); setDone(''); }}><i className="fa fa-calendar"></i> Change valid-until date</button>
                )}
                {data.status !== 'rejected' && (
                  <button type="button" className="sp-btn sp-btn-secondary sp-btn-danger" onClick={() => { setMode('reject'); setDone(''); }}><i className="fa fa-times"></i> {data.status === 'approved' ? 'Withdraw benefit' : 'Reject'}</button>
                )}
                {data.category === 'ex_servicemen' && data.status === 'approved' && (
                  <button type="button" className="sp-btn sp-btn-outline" disabled={saving} onClick={() => act('reminded')}><i className="fa fa-bell"></i> Mark yearly reminder done</button>
                )}
                {c.phone && (
                  <a className="sp-btn sp-btn-outline" target="_blank" rel="noreferrer"
                    href={waLink(c.phone, `Hello ${c.name || ''}, this is the SPOUZY team about the ID you uploaded for the ${data.category === 'student' ? 'student' : 'ex-servicemen'} benefit.`)}>
                    <i className="fa fa-whatsapp"></i> WhatsApp
                  </a>
                )}
              </div>
            )}

            {canEdit && mode === 'approve' && (
              <div className="sp-ver-panel">
                <h4><i className="fa fa-check-circle"></i> Approve this ID</h4>
                {data.category === 'student' ? (
                  <div className="sp-form-group">
                    <label className="sp-form-label">Valid until (check it matches the ID)</label>
                    <input type="date" className="sp-input" min={today} value={expiry} onChange={(e) => setExpiry(e.target.value)} required />
                    <small className="sp-ver-muted">After this date the free consultation from today is no longer offered.</small>
                  </div>
                ) : (
                  <p className="sp-ver-muted">Ex-servicemen / defence IDs do not expire. The team is reminded every year to check in with them.</p>
                )}
                <div className="sp-form-group">
                  <label className="sp-form-label">Note for the team (not shown to the customer)</label>
                  <input className="sp-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
                </div>
                <div className="sp-ver-actions">
                  <button type="button" className="sp-btn sp-btn-primary" disabled={saving || (data.category === 'student' && !expiry)} onClick={() => act('approve')}>{saving ? 'Saving…' : 'Approve'}</button>
                  <button type="button" className="sp-btn sp-btn-secondary" onClick={() => setMode(null)}>Cancel</button>
                </div>
              </div>
            )}

            {canEdit && mode === 'reject' && (
              <div className="sp-ver-panel is-reject">
                <h4><i className="fa fa-times-circle"></i> {data.status === 'approved' ? 'Withdraw the benefit' : 'Reject this ID'}</h4>
                <p className="sp-ver-muted">Tell the customer why and what to upload instead. They see this message on their account page and on the booking page, with a button to upload again.</p>
                <div className="sp-ver-reasons">
                  {REASONS.map(r => <button key={r.label} type="button" onClick={() => setMessage(r.text)}>{r.label}</button>)}
                </div>
                <div className="sp-form-group">
                  <label className="sp-form-label">Message to the customer</label>
                  <textarea className="sp-textarea" rows="4" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Why it failed and what to do next" />
                </div>
                <div className="sp-form-group">
                  <label className="sp-form-label">Note for the team (not shown to the customer)</label>
                  <input className="sp-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
                </div>
                <div className="sp-ver-actions">
                  <button type="button" className="sp-btn sp-btn-secondary sp-btn-danger" disabled={saving || message.trim().length < 10} onClick={() => act('reject')}>{saving ? 'Saving…' : 'Send and reject'}</button>
                  <button type="button" className="sp-btn sp-btn-secondary" onClick={() => setMode(null)}>Cancel</button>
                </div>
              </div>
            )}

            {data.internal_note && !mode && <p className="sp-ver-muted"><i className="fa fa-sticky-note-o"></i> Team note: {data.internal_note}</p>}

            {data.history && data.history.length > 0 && (
              <div className="sp-ver-history">
                <h4>Earlier uploads by this customer</h4>
                {data.history.map(h => (
                  <div key={h.id} className="sp-ver-history-row">
                    <StatePill state={h.state} />
                    <span>{formatDateTimeIST(h.submitted_at)}</span>
                    {h.files.map(f => <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer">{f.which === 'back' ? 'back' : 'front'}</a>)}
                    {h.admin_message && <small>“{h.admin_message}”</small>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function VerificationsPage() {
  const { user } = useAuth();
  const canEdit = user?.can('verifications:edit');
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const stateParam = searchParams.get('state');
  const tab = TABS.some(t => t.key === stateParam) ? stateParam : 'pending';
  const openId = parseInt(searchParams.get('id'), 10) || null;
  const [data, setData] = useState({ items: [], counts: {} });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pageError, setPageError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setPageError('');
    try {
      const q = new URLSearchParams({ state: tab, ...(search.trim() && { q: search.trim() }) });
      const r = await api.get(`/admin/verifications?${q}`);
      setData(r.data);
    } catch (err) {
      setPageError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [tab, search]);

  // reload when the tab changes or the page is opened again (menu, notification bell)
  const navKey = openId ? 'modal' : location.key;
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tab, navKey]);

  function setParams(next) {
    const p = {};
    const st = next.state !== undefined ? next.state : tab;
    if (st && st !== 'pending') p.state = st;
    const id = next.id !== undefined ? next.id : openId;
    if (id) p.id = String(id);
    setSearchParams(p);
  }

  const counts = data.counts || {};
  const items = data.items || [];

  return (
    <div className="sp-card">
      <div className="sp-card-header">
        <h2 className="sp-card-title"><i className="fa fa-id-card-o" style={{ marginRight: '8px' }}></i> Student &amp; Ex-servicemen IDs</h2>
      </div>
      {pageError && <div className="sp-inline-alert error">{pageError}</div>}
      <p style={{ marginTop: 0, fontSize: '13px', color: '#666' }}>
        Students and ex-servicemen / defence personnel upload an ID proof when they create their account (or later from their account page).
        Once you approve it they can book the free consultation straight away instead of waiting 2 months. Student benefits end on the ID&apos;s valid-until date;
        ex-servicemen IDs do not expire, and you get a reminder every year to check in with them. Everyone can have only one consultation booked at a time.
      </p>
      <div className="sp-tabs">
        {TABS.map(t => (
          <button key={t.key} type="button" className={`sp-tab-btn ${tab === t.key ? 'active' : ''}`} onClick={() => setParams({ state: t.key, id: null })}>
            <i className={`fa ${t.icon}`}></i> {t.label}{counts[t.key] !== undefined ? ` (${counts[t.key]})` : ''}
          </button>
        ))}
      </div>
      <HelpBox topic="verifications" />

      <form className="sp-filters-bar" onSubmit={(e) => { e.preventDefault(); load(); }}>
        <div style={{ flex: 1 }}><input className="sp-input" placeholder="Search name, email or mobile" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <button type="submit" className="sp-btn sp-btn-secondary">Search</button>
      </form>

      {loading ? <Loading /> : items.length === 0 ? (
        <div className="sp-ver-empty">
          <i className={`fa ${tab === 'pending' ? 'fa-check-circle' : 'fa-inbox'}`}></i>
          {tab === 'pending' ? 'Nothing waiting. New ID proofs appear here and in the notification bell.' : tab === 'reminders' ? 'No yearly reminders are due.' : 'Nothing here yet.'}
        </div>
      ) : (
        <div className="sp-ver-list">
          {items.map(item => (
            <div key={item.id} className={`sp-ver-item is-${item.state} ${openId === item.id ? 'is-focus' : ''}`}>
              <div>
                <div className="sp-ver-item-head">
                  <CategoryPill item={item} /> <StatePill state={item.state} />
                  {item.attempts > 1 && <span className="sp-ver-attempts">Upload {item.attempts}</span>}
                  <small>{formatDateTimeIST(item.submitted_at)}</small>
                </div>
                <div className="sp-ver-who"><strong>{item.customer.name}</strong> <span>{item.customer.email}</span> <span>{item.customer.phone}</span></div>
                <Details item={item} />
                {item.state === 'rejected' && item.admin_message && <div className="sp-ver-msg"><span>Message sent</span>{item.admin_message}</div>}
                {tab === 'reminders' && (
                  <div className="sp-ver-benefit">
                    <i className="fa fa-bell"></i> Yearly check-in due. Last consultation: {item.last_consultation ? formatDateIST(item.last_consultation) : 'none yet'}
                    {item.reminded_at ? ` · last reminded ${formatDateIST(item.reminded_at)}` : ''}
                  </div>
                )}
              </div>
              <div className="sp-ver-item-side">
                <div className="sp-ver-files">{item.files.map(f => <FileThumb key={f.id} file={f} />)}</div>
                <button type="button" className={`sp-btn ${item.state === 'pending' && canEdit ? 'sp-btn-primary' : 'sp-btn-secondary'} sp-btn-sm`} onClick={() => setParams({ id: item.id })}>
                  {item.state === 'pending' && canEdit ? 'Review' : 'Open'}
                </button>
                {tab === 'reminders' && item.customer.phone && (
                  <a className="sp-btn sp-btn-outline sp-btn-sm" target="_blank" rel="noreferrer"
                    href={waLink(item.customer.phone, `Hello ${item.customer.name || ''}, greetings from SPOUZY. It has been a while since your last consultation with us. As an ex-serviceman / defence family you can book your free consultation any time — just reply here or book on our website.`)}>
                    <i className="fa fa-whatsapp"></i> Remind on WhatsApp
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {openId && <ReviewModal id={openId} canEdit={canEdit} onClose={() => setParams({ id: null })} onChanged={load} />}
    </div>
  );
}
