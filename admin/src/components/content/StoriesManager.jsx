import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Modal from '../Modal';
import { formatDateTimeIST } from '../../constants/statuses';
import { errorText, Toggle, FormActions } from './common';
import { Loading } from './HomepagePanels';
import { shownName } from '../../utils/faqText';

/*
 * Client stories: customers share them from their account (login needed). Nothing shows on the website until
 * approved here. The admin can edit, hide/show, delete, add stories and set the homepage order.
 * The website never shows the real name: only first and last letters ("R***t & P***a S.").
 */
const STATES = [
  { key: 'pending', label: 'Waiting for approval', icon: 'fa-clock-o' },
  { key: 'live', label: 'Live on website', icon: 'fa-globe' },
  { key: 'hidden', label: 'Hidden', icon: 'fa-eye-slash' },
  { key: 'rejected', label: 'Not approved', icon: 'fa-ban' },
  { key: 'all', label: 'All', icon: 'fa-list' }
];
const SOURCE = { user: 'Customer account', admin: 'Added by admin', visitor: 'Old public form' };
const BADGES = ['Verified Client', 'Verified Couple', 'Clinical Care', 'Amicable Resolution', 'Pre-Marriage Couple'];
const EMPTY = { story_text: '', display_name: '', is_anonymous: false, rating: 5, service_key: '', city: '', tag_line: '', badge_label: '', is_verified: false, show_on_home: true, internal_notes: '', customer_message: '', publish: true };

function Stars({ n, onChange }) {
  return (
    <span className="sp-story-stars" aria-label={`${n} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(i => (
        onChange
          ? <button key={i} type="button" className={i <= n ? 'is-on' : ''} onClick={() => onChange(i)} aria-label={`${i} star${i > 1 ? 's' : ''}`}><i className="fa fa-star"></i></button>
          : <i key={i} className={`fa fa-star ${i <= n ? 'is-on' : ''}`} aria-hidden="true"></i>
      ))}
    </span>
  );
}

/** Looks like the card on the homepage */
function StoryCardPreview({ p }) {
  return (
    <div className="sp-story-card-preview">
      <Stars n={p.rating} />
      <p>“{p.quote}”</p>
      <div className="sp-story-card-foot">
        <strong>{p.name}</strong>
        {p.badge && <span className="sp-story-badge"><i className="fa fa-check-circle"></i> {p.badge}</span>}
        {p.tag && <span className="sp-story-tag">{p.tag}</span>}
      </div>
    </div>
  );
}

export function StoriesPanel({ onMessage, registerAdd }) {
  const { user } = useAuth();
  const canEdit = user?.can('moderation:edit');
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState('pending');
  const [q, setQ] = useState('');
  const [data, setData] = useState({ stories: [], counts: {}, services: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [focusId, setFocusId] = useState(() => parseInt(params.get('story'), 10) || null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get(`/admin/stories?state=${state}${q ? `&q=${encodeURIComponent(q)}` : ''}`);
      setData(r.data || { stories: [], counts: {}, services: [] });
      setError('');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [state, q]);
  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); }, [load, q]);

  // Opened from a notification (?story=ID): show that story's list and highlight it
  useEffect(() => {
    if (!focusId) return;
    api.get(`/admin/stories/${focusId}`).then(r => {
      const st = r.data.state;
      if (st && st !== state) setState(st);
    }).catch(() => setFocusId(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);
  useEffect(() => {
    if (!focusId || loading) return;
    const el = document.getElementById(`story-${focusId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const t = setTimeout(() => {
        setFocusId(null);
        const next = new URLSearchParams(params);
        next.delete('story');
        setParams(next, { replace: true });
      }, 2500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [focusId, loading, data, params, setParams]);

  useEffect(() => {
    if (registerAdd) registerAdd(canEdit ? () => setEditing({ ...EMPTY }) : null);
  }, [registerAdd, canEdit]);

  async function act(story, action, extra = {}) {
    setBusyId(story.id);
    try {
      await api.patch(`/admin/stories/${story.id}`, { action, ...extra });
      const msgs = {
        approve: 'Approved: the story is now live on the website',
        reject: 'Marked as not approved (it stays off the website)',
        hide: 'Hidden from the website',
        show: 'Shown on the website again'
      };
      onMessage(msgs[action] || 'Saved');
      load();
    } catch (err) {
      onMessage(errorText(err), true);
    } finally {
      setBusyId(null);
    }
  }

  async function reject(story) {
    const msg = window.prompt('Not approving this story. Optional message to the customer (they see it in My stories):', story.customer_message || '');
    if (msg === null) return;
    act(story, 'reject', { customer_message: msg });
  }

  async function remove(story) {
    if (!window.confirm('Delete this story for good? It is removed from the website and from the customer’s account. This cannot be undone.')) return;
    setBusyId(story.id);
    try {
      await api.delete(`/admin/stories/${story.id}`);
      onMessage('Story deleted');
      load();
    } catch (err) {
      onMessage(errorText(err), true);
    } finally {
      setBusyId(null);
    }
  }

  async function move(index, dir) {
    const ids = data.stories.map(s => s.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    try {
      await api.post('/admin/stories/reorder', { ids });
      load();
    } catch (err) {
      onMessage(errorText(err), true);
    }
  }

  async function toggleHome(story) {
    try {
      await api.put(`/admin/stories/${story.id}`, { show_on_home: !story.show_on_home });
      onMessage(story.show_on_home ? 'Removed from the homepage (still on the stories page)' : 'Shown on the homepage');
      load();
    } catch (err) {
      onMessage(errorText(err), true);
    }
  }

  const counts = data.counts || {};
  return (
    <div>
      <div className="sp-faq-views" role="tablist" aria-label="Story lists">
        {STATES.map(s => (
          <button key={s.key} type="button" className={state === s.key ? 'is-active' : ''} onClick={() => { setLoading(true); setState(s.key); }}>
            <i className={`fa ${s.icon}`}></i> {s.label}
            <span className={s.key === 'pending' && counts.pending ? 'is-alert' : ''}>{counts[s.key] ?? 0}</span>
          </button>
        ))}
      </div>
      <div className="sp-filters-bar">
        <div className="sp-faq-search">
          <i className="fa fa-search" aria-hidden="true"></i>
          <input className="sp-input" type="search" placeholder="Search story text, name or city…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search stories" />
        </div>
        {state === 'live' && data.stories.length > 1 && <small className="sp-faq-lead" style={{ margin: 0 }}>Use the arrows to set the order on the homepage.</small>}
      </div>
      {error && <div className="sp-inline-alert error">{error}</div>}
      {loading ? <Loading /> : data.stories.length === 0 ? (
        <div className="sp-faq-empty">
          <i className="fa fa-comments-o" aria-hidden="true"></i>
          <p>{state === 'pending' ? 'No stories are waiting. New stories from customers appear here and in your notifications.' : 'No stories here.'}</p>
          {canEdit && state !== 'pending' && <button type="button" className="sp-btn sp-btn-primary" onClick={() => setEditing({ ...EMPTY })}><i className="fa fa-plus"></i> Add a story</button>}
        </div>
      ) : (
        <div className="sp-story-list">
          {data.stories.map((s, i) => (
            <article key={s.id} id={`story-${s.id}`} className={`sp-story-item is-${s.state} ${focusId === s.id ? 'is-focus' : ''}`}>
              <div className="sp-story-item-main">
                <div className="sp-story-item-head">
                  <span className={`sp-story-state is-${s.state}`}>{STATES.find(x => x.key === s.state)?.label || s.state}</span>
                  <span className="sp-story-source">{SOURCE[s.source] || s.source}</span>
                  {s.is_verified ? <span className="sp-story-verified"><i className="fa fa-check-circle"></i> Used SPOUZY care</span> : (s.source === 'user' && <span className="sp-story-unverified">Not verified</span>)}
                  {s.edited_by_team && <span className="sp-story-source">Edited by team</span>}
                  <small>{formatDateTimeIST(s.createdAt)}</small>
                </div>
                <StoryCardPreview p={s.public_preview} />
                <div className="sp-story-private">
                  <div><span>Real name (private)</span>{s.is_anonymous ? `${s.display_name || '—'} · shown as Anonymous` : (s.display_name || '—')}</div>
                  {s.author && <div><span>Account</span>{s.author.name} · {s.author.email}{s.author.phone ? ` · ${s.author.phone}` : ''}</div>}
                  {!s.author && (s.private_email || s.private_phone) && <div><span>Contact</span>{[s.private_email, s.private_phone].filter(Boolean).join(' · ')}</div>}
                  {s.service_label && <div><span>Care used</span>{s.service_label}</div>}
                  {s.verified_note && <div><span>Check</span>{s.verified_note}</div>}
                  {s.internal_notes && <div><span>Note</span>{s.internal_notes}</div>}
                  {s.customer_message && <div><span>Message to customer</span>{s.customer_message}</div>}
                  {s.state === 'live' && <div><span>Homepage</span>{s.show_on_home ? 'Yes' : 'No (stories page only)'}</div>}
                </div>
              </div>
              {canEdit && (
                <div className="sp-story-item-actions">
                  {state === 'live' && data.stories.length > 1 && (
                    <div className="sp-story-order">
                      <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><i className="fa fa-chevron-up"></i></button>
                      <button type="button" onClick={() => move(i, 1)} disabled={i === data.stories.length - 1} aria-label="Move down"><i className="fa fa-chevron-down"></i></button>
                    </div>
                  )}
                  {s.state !== 'live' && s.state !== 'hidden' && <button className="sp-btn sp-btn-primary sp-btn-sm" disabled={busyId === s.id} onClick={() => act(s, 'approve')}><i className="fa fa-check"></i> Approve &amp; publish</button>}
                  {s.state === 'hidden' && <button className="sp-btn sp-btn-primary sp-btn-sm" disabled={busyId === s.id} onClick={() => act(s, 'show')}><i className="fa fa-eye"></i> Show</button>}
                  {s.state === 'live' && <button className="sp-btn sp-btn-outline sp-btn-sm" disabled={busyId === s.id} onClick={() => act(s, 'hide')}><i className="fa fa-eye-slash"></i> Hide</button>}
                  <button className="sp-btn sp-btn-secondary sp-btn-sm" onClick={() => setEditing({ ...EMPTY, ...s, service_key: s.service_key || '', city: s.city || '', tag_line: s.tag_line || '', badge_label: s.badge_label || '', internal_notes: s.internal_notes || '', customer_message: s.customer_message || '' })}><i className="fa fa-pencil"></i> Edit</button>
                  {s.state === 'live' && <button className="sp-btn sp-btn-outline sp-btn-sm" onClick={() => toggleHome(s)}>{s.show_on_home ? 'Off homepage' : 'On homepage'}</button>}
                  {s.state === 'pending' && <button className="sp-btn sp-btn-outline sp-btn-sm" disabled={busyId === s.id} onClick={() => reject(s)}><i className="fa fa-ban"></i> Don’t approve</button>}
                  <button className="sp-btn sp-btn-outline sp-btn-sm" disabled={busyId === s.id} onClick={() => remove(s)}><i className="fa fa-trash"></i> Delete</button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {editing && (
        <StoryEditor story={editing} services={data.services || []} onClose={() => setEditing(null)}
          onSaved={(msg) => { setEditing(null); onMessage(msg); load(); }} onError={(m) => onMessage(m, true)} />
      )}
    </div>
  );
}

function StoryEditor({ story, services, onClose, onSaved, onError }) {
  const [s, setS] = useState(() => ({ ...story }));
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setS(prev => ({ ...prev, [k]: v }));
  const isNew = !s.id;
  const preview = useMemo(() => ({
    name: shownName(s.display_name, s.is_anonymous),
    quote: s.story_text || 'The story text appears here.',
    rating: s.rating || 5,
    badge: s.badge_label || (s.is_verified ? 'Verified Client' : ''),
    tag: [s.tag_line, s.city].filter(Boolean).join(' • ') || (services.find(x => x.key === s.service_key) || {}).label || ''
  }), [s, services]);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        story_text: s.story_text, display_name: s.display_name, is_anonymous: !!s.is_anonymous, rating: s.rating,
        service_key: s.service_key || null, city: s.city, tag_line: s.tag_line, badge_label: s.badge_label,
        is_verified: !!s.is_verified, show_on_home: !!s.show_on_home, internal_notes: s.internal_notes
      };
      if (s.source === 'user') body.customer_message = s.customer_message;
      if (isNew) {
        body.publish = !!s.publish;
        await api.post('/admin/stories', body);
        onSaved(s.publish ? 'Story added and live on the website' : 'Story added (hidden until you choose Show)');
      } else {
        await api.put(`/admin/stories/${s.id}`, body);
        onSaved('Story saved');
      }
    } catch (err) {
      onError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={isNew ? 'Add a story' : 'Edit story'} maxWidth="860px">
      <form onSubmit={save} className="sp-story-editor">
        <div className="sp-story-editor-fields">
          <div className="sp-form-group">
            <label className="sp-form-label" htmlFor="stText">Story *</label>
            <textarea id="stText" className="sp-textarea" rows="6" value={s.story_text} onChange={(e) => set('story_text', e.target.value)} required minLength={40} maxLength={3000} />
            <small style={{ color: '#888' }}>{String(s.story_text || '').length} / 3000 characters. For customer stories, edit only to remove identifying details (your Reviews &amp; Testimonials Policy); never name a doctor or promise a medical result.</small>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '12px' }}>
            <div className="sp-form-group">
              <label className="sp-form-label" htmlFor="stName">Name (private)</label>
              <input id="stName" className="sp-input" value={s.display_name || ''} onChange={(e) => set('display_name', e.target.value)} placeholder="e.g. Rohit & Priya S." />
              <small style={{ color: '#888' }}>Website shows: <strong>{preview.name}</strong></small>
            </div>
            <div className="sp-form-group">
              <label className="sp-form-label">Rating</label>
              <div><Stars n={s.rating || 5} onChange={(n) => set('rating', n)} /></div>
            </div>
          </div>
          <Toggle label="Show as Anonymous (no letters at all)" checked={s.is_anonymous} onChange={(v) => set('is_anonymous', v)} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '10px' }}>
            <div className="sp-form-group">
              <label className="sp-form-label" htmlFor="stService">Care used</label>
              <select id="stService" className="sp-input" value={s.service_key || ''} onChange={(e) => set('service_key', e.target.value)}>
                <option value="">—</option>
                {services.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
              </select>
            </div>
            <div className="sp-form-group">
              <label className="sp-form-label" htmlFor="stCity">City</label>
              <input id="stCity" className="sp-input" value={s.city || ''} onChange={(e) => set('city', e.target.value)} placeholder="e.g. Mumbai or Online" maxLength={80} />
            </div>
            <div className="sp-form-group">
              <label className="sp-form-label" htmlFor="stTag">Detail line</label>
              <input id="stTag" className="sp-input" value={s.tag_line || ''} onChange={(e) => set('tag_line', e.target.value)} placeholder="e.g. Married 11 Years" maxLength={120} />
            </div>
            <div className="sp-form-group">
              <label className="sp-form-label" htmlFor="stBadge">Badge</label>
              <input id="stBadge" className="sp-input" list="sp-story-badges" value={s.badge_label || ''} onChange={(e) => set('badge_label', e.target.value)} placeholder={s.is_verified ? 'Verified Client (automatic)' : 'None'} maxLength={60} />
              <datalist id="sp-story-badges">{BADGES.map(b => <option key={b} value={b} />)}</datalist>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
            <Toggle label="Used SPOUZY care (verified)" checked={s.is_verified} onChange={(v) => set('is_verified', v)} />
            <Toggle label="Show on the homepage" checked={s.show_on_home} onChange={(v) => set('show_on_home', v)} />
            {isNew && <Toggle label="Publish now" checked={s.publish} onChange={(v) => set('publish', v)} />}
          </div>
          {s.verified_note && <small style={{ color: '#888', display: 'block', marginTop: '4px' }}>Check: {s.verified_note}</small>}
          <div className="sp-form-group" style={{ marginTop: '12px' }}>
            <label className="sp-form-label" htmlFor="stNote">Internal note (team only)</label>
            <textarea id="stNote" className="sp-textarea" rows="2" value={s.internal_notes || ''} onChange={(e) => set('internal_notes', e.target.value)} />
          </div>
          {s.source === 'user' && (
            <div className="sp-form-group">
              <label className="sp-form-label" htmlFor="stMsg">Message to the customer (shown in their account)</label>
              <input id="stMsg" className="sp-input" value={s.customer_message || ''} onChange={(e) => set('customer_message', e.target.value)} maxLength={500} placeholder="e.g. Thank you! We shortened it slightly to protect your privacy." />
            </div>
          )}
        </div>
        <aside className="sp-story-editor-preview">
          <span className="sp-form-label">How it looks on the website</span>
          <StoryCardPreview p={preview} />
          {!isNew && s.state === 'pending' && <small>Saving keeps it waiting. Use “Approve &amp; publish” to put it live.</small>}
        </aside>
        <div className="sp-story-editor-actions">
          <FormActions onCancel={onClose} saving={saving} label={isNew ? 'Add story' : 'Save changes'} />
        </div>
      </form>
    </Modal>
  );
}
