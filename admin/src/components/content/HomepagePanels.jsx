import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Modal from '../Modal';
import { formatDateTimeIST } from '../../constants/statuses';
import { errorText, ImageField, Toggle, FormActions, Thumb } from './common';

function useList(url, pickRows = (d) => d) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  async function reload() {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(url);
      setRows(pickRows(res.data) || []);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [url]);
  return { rows, loading, error, reload };
}
export { useList };

function Loading() {
  return <div style={{ textAlign: 'center', padding: '30px', color: '#666' }}><i className="fa fa-spinner fa-spin fa-2x"></i></div>;
}
export { Loading };

/* ------------------------------------------------------------------ */
/* Homepage section titles (services, testimonials, questions)          */
/* ------------------------------------------------------------------ */
export function SectionsPanel({ onMessage }) {
  const { user } = useAuth();
  const canEdit = user?.can('content:edit');
  const { rows, loading, error, reload } = useList('/admin/homepage-sections');
  const [editing, setEditing] = useState(null);
  const [history, setHistory] = useState(null);
  const [saving, setSaving] = useState(false);

  function open(sec) {
    const extra = sec.content_json && typeof sec.content_json === 'object' ? sec.content_json : {};
    setEditing({ ...sec, kicker: extra.kicker || '', emphasis: extra.emphasis || '', extra });
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put(`/admin/homepage-sections/${editing.section_key}`, {
        headline: editing.headline || '',
        subheadline: editing.subheadline || '',
        body_text: editing.body_text || null,
        is_visible: !!editing.is_visible,
        content_json: { ...editing.extra, kicker: editing.kicker, emphasis: editing.emphasis }
      });
      onMessage(`"${editing.section_name}" saved (version ${res.data.version}). The homepage shows it on the next load.`);
      setEditing(null);
      reload();
    } catch (err) {
      onMessage(errorText(err), true);
    } finally {
      setSaving(false);
    }
  }

  async function openHistory(sec) {
    try {
      const res = await api.get(`/admin/homepage-sections/${sec.section_key}/history`);
      setHistory({ section: sec, rows: res.data || [] });
    } catch (err) {
      onMessage(errorText(err), true);
    }
  }

  async function rollback(version) {
    if (!window.confirm(`Restore version ${version} of "${history.section.section_name}"?`)) return;
    try {
      await api.post(`/admin/homepage-sections/${history.section.section_key}/rollback`, { version });
      onMessage(`Restored version ${version}`);
      setHistory(null);
      reload();
    } catch (err) {
      onMessage(errorText(err), true);
    }
  }

  if (loading) return <Loading />;
  if (error) return <div className="sp-inline-alert error">{error} <button className="sp-btn sp-btn-secondary sp-btn-sm" onClick={reload}>Retry</button></div>;

  return (
    <div>
      <p style={{ marginTop: 0, fontSize: '13px', color: '#666' }}>Titles of the homepage blocks. The small line above the title is the "kicker"; the highlighted words come after the title.</p>
      <div className="sp-table-wrapper">
        <table className="sp-table">
          <thead><tr><th>Block</th><th>Shown title</th><th>Visible</th><th>Version</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: '#999' }}>No homepage blocks yet. Run <code>npm run db:seed</code> on the server.</td></tr>
            ) : rows.map(sec => (
              <tr key={sec.id}>
                <td><strong>{sec.section_name}</strong><div><small style={{ color: '#888' }}>{sec.section_key}</small></div></td>
                <td>
                  <small style={{ color: '#985942' }}>{sec.content_json?.kicker}</small>
                  <div>{sec.headline} <em style={{ color: '#7A2E45' }}>{sec.content_json?.emphasis}</em></div>
                </td>
                <td><span className={`sp-badge ${sec.is_visible ? 'published' : 'closed'}`}>{sec.is_visible ? 'Visible' : 'Hidden'}</span></td>
                <td>v{sec.version || 1}</td>
                <td>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {canEdit && <button className="sp-btn sp-btn-secondary sp-btn-sm" onClick={() => open(sec)}>Edit</button>}
                    <button className="sp-btn sp-btn-outline sp-btn-sm" onClick={() => openHistory(sec)}>History</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal isOpen onClose={() => setEditing(null)} title={`Edit ${editing.section_name}`}>
          <form onSubmit={save}>
            <div className="sp-form-group">
              <label className="sp-form-label">Kicker (small line above)</label>
              <input className="sp-input" value={editing.kicker} onChange={(e) => setEditing({ ...editing, kicker: e.target.value })} />
            </div>
            <div className="sp-form-group">
              <label className="sp-form-label">Title</label>
              <input className="sp-input" value={editing.headline || ''} onChange={(e) => setEditing({ ...editing, headline: e.target.value })} />
            </div>
            <div className="sp-form-group">
              <label className="sp-form-label">Highlighted words (after the title)</label>
              <input className="sp-input" value={editing.emphasis} onChange={(e) => setEditing({ ...editing, emphasis: e.target.value })} />
            </div>
            <div className="sp-form-group">
              <label className="sp-form-label">Subtitle</label>
              <textarea className="sp-textarea" rows="3" value={editing.subheadline || ''} onChange={(e) => setEditing({ ...editing, subheadline: e.target.value })} />
            </div>
            <Toggle label="Show this block on the homepage" checked={editing.is_visible} onChange={(v) => setEditing({ ...editing, is_visible: v })} />
            <FormActions onCancel={() => setEditing(null)} saving={saving} />
          </form>
        </Modal>
      )}

      {history && (
        <Modal isOpen onClose={() => setHistory(null)} title={`History — ${history.section.section_name}`}>
          {history.rows.length === 0 ? <p>No earlier versions yet.</p> : (
            <table className="sp-table">
              <thead><tr><th>Version</th><th>Saved</th><th>Title</th><th></th></tr></thead>
              <tbody>
                {history.rows.map(h => (
                  <tr key={h.id}>
                    <td>v{h.version}</td>
                    <td>{formatDateTimeIST(h.createdAt)}</td>
                    <td>{h.content_json?.headline}</td>
                    <td>{canEdit && <button className="sp-btn sp-btn-outline sp-btn-sm" onClick={() => rollback(h.version)}>Restore</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hero banner slides                                                  */
/* ------------------------------------------------------------------ */
const EMPTY_BANNER = {
  admin_title: '', tag_eyebrow: 'PSG CLINICAL WING', category_sub: '', headline: '', headline_emphasis: '', description: '',
  pillsText: '', cta_label: 'Book Free Consultation ↗', cta_url: 'book-appoinment.htm?type=free', secondary_cta_label: '', secondary_cta_url: '',
  image_path: '', mobile_image_path: '', alt_text: '', sort_order: 1, status: 'published', is_active: true
};

export function BannersPanel({ onMessage, registerAdd }) {
  const { user } = useAuth();
  const canEdit = user?.can('content:edit');
  const canDelete = user?.can('content:delete');
  const { rows, loading, error, reload } = useList('/admin/hero-banners');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (registerAdd) registerAdd(canEdit ? () => setEditing({ ...EMPTY_BANNER, sort_order: rows.length + 1 }) : null);
  }, [registerAdd, canEdit, rows.length]);

  function open(b) {
    setEditing({ ...EMPTY_BANNER, ...b, pillsText: (Array.isArray(b.pills) ? b.pills : []).join('\n') });
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { pillsText, id, createdAt, updatedAt, ...rest } = editing;
      const body = { ...rest, pills: pillsText.split('\n').map(s => s.trim()).filter(Boolean) };
      if (id) await api.put(`/admin/hero-banners/${id}`, body);
      else await api.post('/admin/hero-banners', body);
      onMessage(id ? 'Banner saved' : 'Banner added');
      setEditing(null);
      reload();
    } catch (err) {
      onMessage(errorText(err), true);
    } finally {
      setSaving(false);
    }
  }

  async function duplicate(id) {
    try {
      await api.post(`/admin/hero-banners/${id}/duplicate`, {});
      onMessage('Copy created (hidden until you activate it)');
      reload();
    } catch (err) {
      onMessage(errorText(err), true);
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete this banner slide?')) return;
    try {
      await api.delete(`/admin/hero-banners/${id}`);
      onMessage('Banner deleted');
      reload();
    } catch (err) {
      onMessage(errorText(err), true);
    }
  }

  async function toggleActive(b) {
    try {
      await api.put(`/admin/hero-banners/${b.id}`, { is_active: !b.is_active });
      reload();
    } catch (err) {
      onMessage(errorText(err), true);
    }
  }

  if (loading) return <Loading />;
  if (error) return <div className="sp-inline-alert error">{error}</div>;

  return (
    <div>
      <p style={{ marginTop: 0, fontSize: '13px', color: '#666' }}>Slides of the homepage hero, shown in the order below. Only active, published slides appear on the website.</p>
      <div className="sp-table-wrapper">
        <table className="sp-table">
          <thead><tr><th>#</th><th>Image</th><th>Slide</th><th>Button</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: '#999' }}>No banners — the homepage keeps its built-in slides.</td></tr>
            ) : rows.map(b => (
              <tr key={b.id}>
                <td>{b.sort_order}</td>
                <td><Thumb src={b.image_path} width={90} height={50} /></td>
                <td>
                  <small style={{ color: '#985942' }}>{b.tag_eyebrow}{b.category_sub ? ` · ${b.category_sub}` : ''}</small>
                  <div><strong>{b.headline}</strong> <em style={{ color: '#7A2E45' }}>{b.headline_emphasis}</em></div>
                </td>
                <td><small>{b.cta_label}<br /><span style={{ color: '#888' }}>{b.cta_url}</span></small></td>
                <td>
                  <span className={`sp-badge ${b.is_active && b.status === 'published' ? 'published' : 'closed'}`}>{b.is_active && b.status === 'published' ? 'Live' : (b.status === 'published' ? 'Inactive' : b.status)}</span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {canEdit && <button className="sp-btn sp-btn-secondary sp-btn-sm" onClick={() => open(b)}>Edit</button>}
                    {canEdit && <button className="sp-btn sp-btn-outline sp-btn-sm" onClick={() => toggleActive(b)}>{b.is_active ? 'Hide' : 'Show'}</button>}
                    {canEdit && <button className="sp-btn sp-btn-outline sp-btn-sm" onClick={() => duplicate(b.id)}>Copy</button>}
                    {canDelete && <button className="sp-btn sp-btn-outline sp-btn-sm" onClick={() => remove(b.id)}>Delete</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal isOpen onClose={() => setEditing(null)} title={editing.id ? 'Edit banner' : 'New banner'} maxWidth="760px">
          <form onSubmit={save}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="sp-form-group">
                <label className="sp-form-label">Small label (eyebrow)</label>
                <input className="sp-input" value={editing.tag_eyebrow || ''} onChange={(e) => setEditing({ ...editing, tag_eyebrow: e.target.value })} />
              </div>
              <div className="sp-form-group">
                <label className="sp-form-label">Category line</label>
                <input className="sp-input" value={editing.category_sub || ''} onChange={(e) => setEditing({ ...editing, category_sub: e.target.value })} />
              </div>
              <div className="sp-form-group">
                <label className="sp-form-label">Headline *</label>
                <input className="sp-input" value={editing.headline || ''} onChange={(e) => setEditing({ ...editing, headline: e.target.value })} required />
              </div>
              <div className="sp-form-group">
                <label className="sp-form-label">Highlighted second line</label>
                <input className="sp-input" value={editing.headline_emphasis || ''} onChange={(e) => setEditing({ ...editing, headline_emphasis: e.target.value })} />
              </div>
            </div>
            <div className="sp-form-group">
              <label className="sp-form-label">Description *</label>
              <textarea className="sp-textarea" rows="2" value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} required />
            </div>
            <div className="sp-form-group">
              <label className="sp-form-label">Feature pills (one per line, up to 6)</label>
              <textarea className="sp-textarea" rows="3" value={editing.pillsText} onChange={(e) => setEditing({ ...editing, pillsText: e.target.value })} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="sp-form-group">
                <label className="sp-form-label">Main button text</label>
                <input className="sp-input" value={editing.cta_label || ''} onChange={(e) => setEditing({ ...editing, cta_label: e.target.value })} />
              </div>
              <div className="sp-form-group">
                <label className="sp-form-label">Main button link</label>
                <input className="sp-input" value={editing.cta_url || ''} onChange={(e) => setEditing({ ...editing, cta_url: e.target.value })} />
              </div>
              <div className="sp-form-group">
                <label className="sp-form-label">Second button text</label>
                <input className="sp-input" value={editing.secondary_cta_label || ''} onChange={(e) => setEditing({ ...editing, secondary_cta_label: e.target.value })} />
              </div>
              <div className="sp-form-group">
                <label className="sp-form-label">Second button link</label>
                <input className="sp-input" value={editing.secondary_cta_url || ''} onChange={(e) => setEditing({ ...editing, secondary_cta_url: e.target.value })} />
              </div>
            </div>
            <ImageField label="Desktop image" spec="bannerDesktop" required value={editing.image_path} onChange={(v) => setEditing({ ...editing, image_path: v })} />
            <ImageField label="Mobile image (optional)" spec="bannerMobile" value={editing.mobile_image_path} onChange={(v) => setEditing({ ...editing, mobile_image_path: v })} />
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
              <div className="sp-form-group">
                <label className="sp-form-label">Image description (alt text)</label>
                <input className="sp-input" value={editing.alt_text || ''} onChange={(e) => setEditing({ ...editing, alt_text: e.target.value })} />
              </div>
              <div className="sp-form-group">
                <label className="sp-form-label">Order</label>
                <input type="number" className="sp-input" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: e.target.value })} />
              </div>
              <div className="sp-form-group">
                <label className="sp-form-label">Status</label>
                <select className="sp-select" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
            </div>
            <Toggle label="Active" checked={editing.is_active} onChange={(v) => setEditing({ ...editing, is_active: v })} />
            <FormActions onCancel={() => setEditing(null)} saving={saving} />
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Daily relationship tips (homepage tip card)                          */
/* ------------------------------------------------------------------ */
const EMPTY_TIP = { tip_text: '', photo_url: '', category: 'Communication', alt_text: '', cta_label: '', cta_url: '', rotation_interval: 6, sort_order: 1, is_active: true };

export function TipsPanel({ onMessage, registerAdd }) {
  const { user } = useAuth();
  const canEdit = user?.can('content:edit');
  const canDelete = user?.can('content:delete');
  const { rows, loading, error, reload } = useList('/admin/tips');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (registerAdd) registerAdd(canEdit ? () => setEditing({ ...EMPTY_TIP, sort_order: rows.length + 1 }) : null);
  }, [registerAdd, canEdit, rows.length]);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { id, createdAt, updatedAt, ...body } = editing;
      if (id) await api.put(`/admin/tips/${id}`, body);
      else await api.post('/admin/tips', body);
      onMessage(id ? 'Tip saved' : 'Tip added');
      setEditing(null);
      reload();
    } catch (err) {
      onMessage(errorText(err), true);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete this tip?')) return;
    try {
      await api.delete(`/admin/tips/${id}`);
      onMessage('Tip deleted');
      reload();
    } catch (err) {
      onMessage(errorText(err), true);
    }
  }

  if (loading) return <Loading />;
  if (error) return <div className="sp-inline-alert error">{error}</div>;

  return (
    <div>
      <div className="sp-table-wrapper">
        <table className="sp-table">
          <thead><tr><th>#</th><th>Photo</th><th>Tip</th><th>Category</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: '#999' }}>No tips yet.</td></tr>
            ) : rows.map(t => (
              <tr key={t.id}>
                <td>{t.sort_order}</td>
                <td><Thumb src={t.photo_url} width={60} height={45} /></td>
                <td style={{ maxWidth: '380px' }}>{t.tip_text}</td>
                <td>{t.category}</td>
                <td><span className={`sp-badge ${t.is_active ? 'published' : 'closed'}`}>{t.is_active ? 'Active' : 'Hidden'}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {canEdit && <button className="sp-btn sp-btn-secondary sp-btn-sm" onClick={() => setEditing({ ...EMPTY_TIP, ...t })}>Edit</button>}
                    {canDelete && <button className="sp-btn sp-btn-outline sp-btn-sm" onClick={() => remove(t.id)}>Delete</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal isOpen onClose={() => setEditing(null)} title={editing.id ? 'Edit tip' : 'New tip'}>
          <form onSubmit={save}>
            <div className="sp-form-group">
              <label className="sp-form-label">Tip text *</label>
              <textarea className="sp-textarea" rows="3" value={editing.tip_text} onChange={(e) => setEditing({ ...editing, tip_text: e.target.value })} required />
            </div>
            <ImageField label="Photo" spec="tipPhoto" required value={editing.photo_url} onChange={(v) => setEditing({ ...editing, photo_url: v })} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="sp-form-group">
                <label className="sp-form-label">Category</label>
                <input className="sp-input" value={editing.category || ''} onChange={(e) => setEditing({ ...editing, category: e.target.value })} />
              </div>
              <div className="sp-form-group">
                <label className="sp-form-label">Alt text</label>
                <input className="sp-input" value={editing.alt_text || ''} onChange={(e) => setEditing({ ...editing, alt_text: e.target.value })} />
              </div>
              <div className="sp-form-group">
                <label className="sp-form-label">Order</label>
                <input type="number" className="sp-input" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: e.target.value })} />
              </div>
              <div className="sp-form-group">
                <label className="sp-form-label">Seconds on screen</label>
                <input type="number" min="3" className="sp-input" value={editing.rotation_interval} onChange={(e) => setEditing({ ...editing, rotation_interval: e.target.value })} />
              </div>
            </div>
            <Toggle label="Active" checked={editing.is_active} onChange={(v) => setEditing({ ...editing, is_active: v })} />
            <FormActions onCancel={() => setEditing(null)} saving={saving} />
          </form>
        </Modal>
      )}
    </div>
  );
}
