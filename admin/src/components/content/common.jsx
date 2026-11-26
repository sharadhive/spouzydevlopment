import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { IMAGE_SPECS, specLine, checkDimensions } from '../../constants/imageSpecs';
import { optimiseImage, formatBytes } from '../../utils/imageOptimize';

/** Message from an API error, including per-field reasons when the backend sends them */
export function errorText(err) {
  const fields = err?.data?.errors ? Object.values(err.data.errors).filter(Boolean) : [];
  if (fields.length) return fields.join(' ');
  return err?.message || 'Something went wrong.';
}

/** Turn a stored image path into something the admin preview can load */
export function previewSrc(path) {
  const v = String(path || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v) || v.startsWith('/')) return v;
  return '/' + v;
}

/**
 * Small image preview for lists. When the file does not exist it shows a clear
 * "Image missing" box instead of a broken-image icon.
 */
export function Thumb({ src, width = 90, height = 50 }) {
  const [broken, setBroken] = useState(false);
  const url = previewSrc(src);
  useEffect(() => { setBroken(false); }, [url]);
  if (!url) return null;
  if (broken) {
    return (
      <span title={`Image not found: ${src}`} style={{ width: `${width}px`, height: `${height}px`, borderRadius: '4px', border: '1px dashed #E0A3A3', background: '#FFF4F4', color: '#B23B3B', fontSize: '11px', fontWeight: 600, display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1.2, textAlign: 'center' }}>
        <i className="fa fa-exclamation-triangle" aria-hidden="true"></i> Image missing
      </span>
    );
  }
  return <img src={url} alt="" onError={() => setBroken(true)} style={{ width: `${width}px`, height: `${height}px`, objectFit: 'cover', borderRadius: '4px', display: 'block' }} />;
}

/**
 * Text input for an image path with an "Upload" button.
 * With a `spec` (see constants/imageSpecs.js) it shows the recommended size, previews the image
 * in the shape the website uses, warns when the image is too small or the wrong shape, and
 * shrinks/converts uploads to WebP in the browser before sending them.
 */
export function ImageField({ label, value, onChange, required, hint, spec: specKey }) {
  const { user } = useAuth();
  const canUpload = user?.can('media:edit');
  const spec = specKey ? IMAGE_SPECS[specKey] : null;
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [natural, setNatural] = useState(null);
  const [previewBroken, setPreviewBroken] = useState(false);
  useEffect(() => { setPreviewBroken(false); setNatural(null); }, [value]);

  async function upload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setBusy(true);
    setError('');
    setNote('');
    try {
      let prepared = { file, optimised: false, before: null, after: null };
      try {
        prepared = await optimiseImage(file, spec || IMAGE_SPECS.library);
      } catch (readErr) {
        prepared = { file, optimised: false, before: null, after: null };
      }
      const fd = new FormData();
      fd.append('file', prepared.file);
      const res = await api.post('/admin/media', fd);
      onChange(res.data.url);
      const b = prepared.before;
      const a = prepared.after;
      if (prepared.optimised && b && a) {
        setNote(`Optimised for the website: ${b.w} × ${b.h} px, ${formatBytes(b.size)} → ${a.w} × ${a.h} px, ${formatBytes(a.size)}.`);
      } else if (b) {
        setNote(`Uploaded as is: ${b.w} × ${b.h} px, ${formatBytes(b.size)}.`);
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const warnings = spec && natural ? checkDimensions(spec, natural.w, natural.h) : [];
  const frameStyle = spec && spec.ratio
    ? { aspectRatio: String(spec.ratio), width: spec.ratio >= 1 ? '240px' : '140px' }
    : { maxWidth: '240px' };

  return (
    <div className="sp-form-group">
      <label className="sp-form-label">{label}{required ? ' *' : ''}</label>
      {spec && (
        <div className="sp-img-spec">
          <i className="fa fa-crop" aria-hidden="true"></i>
          <div>
            <strong>{specLine(spec)}</strong>
            <div>{spec.where} {spec.tip}</div>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input type="text" className="sp-input" value={value || ''} onChange={(e) => onChange(e.target.value)} required={required} placeholder="image/... or /media/public/..." />
        {canUpload && (
          <>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={upload} />
            <button type="button" className="sp-btn sp-btn-outline sp-btn-sm" disabled={busy} onClick={() => fileRef.current && fileRef.current.click()}>
              {busy ? <i className="fa fa-spinner fa-spin"></i> : <i className="fa fa-upload"></i>} Upload
            </button>
          </>
        )}
      </div>
      {value && !previewBroken && (
        <div className="sp-img-preview" style={frameStyle} title={spec ? `How it is cropped on the website (${spec.ratioText})` : ''}>
          <img src={previewSrc(value)} alt="" style={{ objectPosition: spec ? spec.focus : 'center' }}
            onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            onError={() => setPreviewBroken(true)} />
        </div>
      )}
      {value && natural && (
        <small className="sp-img-size">Image size: {natural.w} × {natural.h} px{spec && !warnings.length ? ' · good fit' : ''}</small>
      )}
      {warnings.map(w => <small key={w} className="sp-img-warn"><i className="fa fa-exclamation-triangle"></i> {w}</small>)}
      {note && <small className="sp-img-ok"><i className="fa fa-check-circle"></i> {note}</small>}
      {value && previewBroken && (
        <small style={{ color: '#B23B3B', display: 'block', marginTop: '6px' }}>
          <i className="fa fa-exclamation-triangle"></i> This image file was not found. Upload the photo{canUpload ? ' with the Upload button' : ''} or copy its address from the Media Library.
        </small>
      )}
      {error && <small style={{ color: '#C62828', display: 'block' }}>{error}</small>}
      {hint && <small style={{ color: '#777', display: 'block' }}>{hint}</small>}
    </div>
  );
}

export function Toggle({ label, checked, onChange, disabled }) {
  return (
    <label style={{ fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      <input type="checkbox" checked={!!checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} /> {label}
    </label>
  );
}

export function FormActions({ onCancel, saving, label = 'Save' }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
      <button type="button" className="sp-btn sp-btn-outline" onClick={onCancel}>Cancel</button>
      <button type="submit" className="sp-btn sp-btn-primary" disabled={saving}>{saving ? 'Saving…' : label}</button>
    </div>
  );
}
