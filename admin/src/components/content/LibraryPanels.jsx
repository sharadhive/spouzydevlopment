import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { formatDateTimeIST } from '../../constants/statuses';
import { errorText } from './common';
import { IMAGE_SPECS, SPEC_ORDER } from '../../constants/imageSpecs';
import { optimiseImage, formatBytes } from '../../utils/imageOptimize';
import { useList, Loading } from './HomepagePanels';

/* ------------------------------------------------------------------ */
/* Footer social links                                                  */
/* ------------------------------------------------------------------ */
const PLATFORMS = [
  { key: 'facebook', label: 'Facebook', placeholder: 'https://www.facebook.com/...' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://www.instagram.com/...' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://www.linkedin.com/company/...' },
  { key: 'x', label: 'X (Twitter)', placeholder: 'https://x.com/...' }
];

export function SocialPanel({ onMessage }) {
  const { user } = useAuth();
  const canEdit = user?.can('settings:content');
  const [links, setLinks] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/admin/social-links').then(res => setLinks(res.data || {})).catch(err => { setLinks({}); onMessage(errorText(err), true); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {};
      PLATFORMS.forEach(p => { body[p.key] = links[p.key] || ''; });
      await api.put('/admin/social-links', body);
      onMessage('Social links saved. Empty links are hidden in the footer.');
    } catch (err) {
      onMessage(errorText(err), true);
    } finally {
      setSaving(false);
    }
  }

  if (!links) return <Loading />;
  return (
    <form onSubmit={save} style={{ maxWidth: '620px' }}>
      {PLATFORMS.map(p => (
        <div key={p.key} className="sp-form-group">
          <label className="sp-form-label">{p.label}</label>
          <input type="url" className="sp-input" disabled={!canEdit} placeholder={p.placeholder} value={links[p.key] || ''} onChange={(e) => setLinks({ ...links, [p.key]: e.target.value })} />
        </div>
      ))}
      {canEdit ? <button type="submit" className="sp-btn sp-btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Links'}</button>
        : <p style={{ fontSize: '13px', color: '#777' }}>You can view these links; changing them needs the "settings:content" permission.</p>}
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Public media library (banner, tip and blog images)                   */
/* ------------------------------------------------------------------ */
export function MediaPanel({ onMessage }) {
  const { user } = useAuth();
  const canUpload = user?.can('media:edit');
  const { rows, loading, error, reload } = useList('/admin/media');
  const fileRef = useRef(null);
  const [altText, setAltText] = useState('');
  const [busy, setBusy] = useState(false);
  const [sizes, setSizes] = useState({});

  async function upload(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setBusy(true);
    let ok = 0;
    let saved = 0;
    for (const file of files) {
      try {
        let prepared = { file, optimised: false };
        try { prepared = await optimiseImage(file, IMAGE_SPECS.library); } catch (readErr) { /* upload as is */ }
        if (prepared.optimised) saved += prepared.before.size - prepared.after.size;
        const fd = new FormData();
        fd.append('file', prepared.file);
        if (altText) fd.append('alt_text', altText);
        await api.post('/admin/media', fd);
        ok += 1;
      } catch (err) {
        onMessage(`${file.name}: ${errorText(err)}`, true);
      }
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
    if (ok) {
      onMessage(`${ok} image${ok > 1 ? 's' : ''} uploaded${saved > 0 ? ` (optimised, ${formatBytes(saved)} smaller)` : ''}. Use "Copy path" and paste it into a banner, tip or article.`);
      setAltText('');
      reload();
    }
  }

  async function copy(url) {
    try {
      await navigator.clipboard.writeText(url);
      onMessage(`Copied ${url}`);
    } catch (e) {
      window.prompt('Copy this path:', url);
    }
  }

  return (
    <div>
      {canUpload && (
        <div className="sp-card" style={{ background: '#FBF8F3', marginBottom: '16px' }}>
          <h3 style={{ marginTop: 0, fontSize: '15px' }}>Upload images</h3>
          <p style={{ fontSize: '13px', color: '#666', marginTop: 0 }}>JPG, PNG or WebP, up to 10 MB each. Large photos are reduced to 1920 px on the longest side and converted to WebP before upload. These are public images for the website (never upload private documents here).</p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input className="sp-input" style={{ maxWidth: '320px' }} placeholder="Image description (alt text, optional)" value={altText} onChange={(e) => setAltText(e.target.value)} />
            <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={upload} />
            <button type="button" className="sp-btn sp-btn-primary" disabled={busy} onClick={() => fileRef.current && fileRef.current.click()}>
              {busy ? <><i className="fa fa-spinner fa-spin"></i> Uploading…</> : <><i className="fa fa-upload"></i> Choose images</>}
            </button>
          </div>
        </div>
      )}

      <ImageSizeGuide />

      {loading ? <Loading /> : error ? <div className="sp-inline-alert error">{error}</div> : rows.length === 0 ? (
        <p style={{ color: '#999' }}>No images uploaded yet.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px' }}>
          {rows.map(m => (
            <div key={m.id} style={{ border: '1px solid #eee', borderRadius: '8px', overflow: 'hidden', background: '#fff' }}>
              <img src={m.url} alt={m.alt_text || ''} style={{ width: '100%', height: '120px', objectFit: 'cover', display: 'block' }}
                onLoad={(e) => { const t = e.currentTarget; setSizes(prev => (prev[m.id] ? prev : { ...prev, [m.id]: `${t.naturalWidth} × ${t.naturalHeight} px` })); }} />
              <div style={{ padding: '8px', fontSize: '12px' }}>
                <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={m.original_name}>{m.original_name}</div>
                <div style={{ color: '#888' }}>{sizes[m.id] ? `${sizes[m.id]} · ` : ''}{formatBytes(m.file_size || 0)}</div>
                <div style={{ color: '#aaa' }}>{formatDateTimeIST(m.createdAt)}</div>
                <button type="button" className="sp-btn sp-btn-outline sp-btn-sm" style={{ marginTop: '6px', width: '100%' }} onClick={() => copy(m.url)}>Copy path</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Table of recommended image sizes for every spot on the website */
export function ImageSizeGuide({ open: startOpen = false }) {
  const [open, setOpen] = useState(startOpen);
  return (
    <div className="sp-size-guide">
      <button type="button" className="sp-size-guide-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <i className="fa fa-crop" aria-hidden="true"></i> Image sizes for each spot on the website
        <i className={`fa fa-chevron-${open ? 'up' : 'down'}`} aria-hidden="true" style={{ marginLeft: 'auto' }}></i>
      </button>
      {open && (
        <div className="sp-table-wrapper">
          <table className="sp-table">
            <thead><tr><th>Image</th><th>Best size</th><th>Smallest</th><th>Shape</th><th>Where it shows</th></tr></thead>
            <tbody>
              {SPEC_ORDER.map(k => {
                const sp = IMAGE_SPECS[k];
                return (
                  <tr key={k}>
                    <td><strong>{sp.title}</strong><div><small style={{ color: '#888' }}>{sp.tip}</small></div></td>
                    <td>{sp.width} × {sp.height} px</td>
                    <td>{sp.minWidth} × {sp.minHeight} px</td>
                    <td>{sp.ratioText}</td>
                    <td><small>{sp.where}</small></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p style={{ fontSize: '12px', color: '#777', margin: '8px 0 0' }}>
            Use JPG or WebP for photos and PNG only when the image needs a transparent background. Every upload is checked
            and optimised automatically, so you can upload straight from your phone or camera.
          </p>
        </div>
      )}
    </div>
  );
}
