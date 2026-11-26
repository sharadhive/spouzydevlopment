import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Modal from './Modal';
import { formatDateIST } from '../constants/statuses';
import { errorText, ImageField, Toggle, FormActions, Thumb, previewSrc } from './content/common';

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

const STATUS = {
  live: { label: 'Live on website', badge: 'published' },
  scheduled: { label: 'Starts later', badge: 'pending' },
  ended: { label: 'Ended', badge: 'closed' },
  off: { label: 'Switched off', badge: 'closed' },
  image_missing: { label: 'Image missing', badge: 'rejected' },
  package_hidden: { label: 'Package hidden', badge: 'rejected' }
};

const EMPTY = {
  title: '', badge_text: '', description: '', image_path: '', image_alt: '', package_id: '', offer_price_inr: '',
  cta_label: '', cta_url: '', terms: '', start_date: '', end_date: '', show_popup: true, is_active: true, sort_order: 1
};

function dateRange(o) {
  if (o.start_date && o.end_date) return `${formatDateIST(o.start_date)} – ${formatDateIST(o.end_date)}`;
  if (o.end_date) return `Until ${formatDateIST(o.end_date)}`;
  if (o.start_date) return `From ${formatDateIST(o.start_date)}, no end date`;
  return 'No end date';
}

/** How the offer looks in the website popup (simplified) */
function OfferPreview({ offer, pkg }) {
  const price = pkg && offer.offer_price_inr !== '' && Number(offer.offer_price_inr) > 0 && Number(offer.offer_price_inr) < pkg.price_inr ? Number(offer.offer_price_inr) : null;
  const cta = offer.cta_label || (pkg ? (price ? 'Claim this offer' : 'View package') : 'Learn more');
  return (
    <div className="sp-offer-preview" aria-label="Popup preview">
      <div className="sp-offer-preview-media">
        {offer.image_path ? <img src={previewSrc(offer.image_path)} alt="" /> : <span>Offer card image</span>}
        <span className="sp-offer-preview-close" aria-hidden="true">×</span>
      </div>
      <div className="sp-offer-preview-body">
        <span className="sp-offer-preview-kicker">{offer.badge_text && <span className="sp-offer-preview-badge">{offer.badge_text}</span>}SPOUZY offer</span>
        <strong className="sp-offer-preview-title">{offer.title || 'Offer title'}</strong>
        {offer.description && <p>{offer.description}</p>}
        {pkg && (
          <div className="sp-offer-preview-price">
            {price ? <><b>{inr(price)}</b> <s>{inr(pkg.price_inr)}</s> <em>Save {inr(pkg.price_inr - price)}</em></> : <b>{pkg.is_free ? 'Free' : inr(pkg.price_inr)}</b>}
            <small>{pkg.name}</small>
          </div>
        )}
        {offer.end_date && <small className="sp-offer-preview-valid">Offer valid till {formatDateIST(offer.end_date)}</small>}
        <div className="sp-offer-preview-actions"><span className="is-primary">{cta}</span><span>Maybe later</span></div>
        {offer.terms && <small className="sp-offer-preview-terms">{offer.terms}</small>}
      </div>
    </div>
  );
}

export default function OffersPanel({ onMessage, registerAdd }) {
  const { user } = useAuth();
  const canEdit = user?.can('offers:edit');
  const canPrice = user?.can('packages:edit');
  const [rows, setRows] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const [o, p] = await Promise.all([api.get('/admin/offers'), api.get('/admin/packages')]);
      setRows(o.data || []);
      setPackages(p.data || []);
    } catch (err) {
      onMessage(errorText(err), true);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => {
    registerAdd(canEdit ? () => setEditing({ ...EMPTY, sort_order: rows.length + 1 }) : null);
  }, [registerAdd, canEdit, rows.length]);

  function open(o) {
    setEditing({
      ...EMPTY, ...o,
      package_id: o.package_id || '',
      offer_price_inr: o.offer_price_inr ?? '',
      start_date: o.start_date || '', end_date: o.end_date || '',
      badge_text: o.badge_text || '', description: o.description || '', image_alt: o.image_alt || '',
      cta_label: o.cta_label || '', cta_url: o.cta_url || '', terms: o.terms || ''
    });
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        title: editing.title, badge_text: editing.badge_text, description: editing.description,
        image_path: editing.image_path, image_alt: editing.image_alt,
        package_id: editing.package_id === '' ? null : Number(editing.package_id),
        cta_label: editing.cta_label, cta_url: editing.package_id ? '' : editing.cta_url, terms: editing.terms,
        start_date: editing.start_date || null, end_date: editing.end_date || null,
        show_popup: !!editing.show_popup, is_active: !!editing.is_active, sort_order: editing.sort_order
      };
      // Only staff who may change prices send the offer price (others keep whatever is there)
      if (canPrice) body.offer_price_inr = editing.package_id && editing.offer_price_inr !== '' ? Number(editing.offer_price_inr) : null;
      if (editing.id) await api.put(`/admin/offers/${editing.id}`, body);
      else await api.post('/admin/offers', body);
      onMessage(editing.id ? 'Offer saved. The website shows the change straight away.' : 'Offer added. It shows on the website on its first day.');
      setEditing(null);
      load();
    } catch (err) {
      onMessage(errorText(err), true);
    } finally {
      setSaving(false);
    }
  }

  async function toggle(o) {
    try {
      await api.put(`/admin/offers/${o.id}`, { is_active: !o.is_active });
      load();
    } catch (err) {
      onMessage(errorText(err), true);
    }
  }

  async function remove() {
    try {
      await api.delete(`/admin/offers/${confirmDelete.id}`);
      onMessage('Offer deleted.');
      setConfirmDelete(null);
      load();
    } catch (err) {
      onMessage(errorText(err), true);
    }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '30px', color: '#666' }}><i className="fa fa-spinner fa-spin fa-2x"></i></div>;

  const live = rows.filter(r => r.status === 'live');
  const pkgOf = (id) => packages.find(p => String(p.id) === String(id)) || null;
  const editPkg = editing ? pkgOf(editing.package_id) : null;

  return (
    <div>
      <div className={`sp-offer-state ${live.length ? 'is-live' : ''}`}>
        <i className={`fa ${live.length ? 'fa-bullhorn' : 'fa-eye-slash'}`} aria-hidden="true"></i>
        {live.length
          ? <span><strong>{live.length} offer{live.length > 1 ? 's are' : ' is'} live.</strong> Visitors see {live.filter(r => r.show_popup).length ? 'the offer popup a few seconds after a page opens, and ' : ''}the offer on the linked package cards.</span>
          : <span><strong>No offer is live, so the website shows no offer popup.</strong> Add an offer with a card image to start one.</span>}
      </div>

      <div className="sp-table-wrapper">
        <table className="sp-table">
          <thead><tr><th>Card</th><th>Offer</th><th>Package &amp; price</th><th>Dates</th><th>Popup</th><th>Status</th>{canEdit && <th></th>}</tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: '#999' }}>No offers yet.{canEdit ? ' Press "Add Offer" to upload your first offer card.' : ''}</td></tr>
            ) : rows.map(o => {
              const st = STATUS[o.status] || STATUS.off;
              return (
                <tr key={o.id}>
                  <td><Thumb src={o.image_path} width={56} height={70} /></td>
                  <td style={{ maxWidth: '260px' }}>
                    <strong>{o.title}</strong>{o.badge_text && <span className="sp-badge new" style={{ marginLeft: '6px' }}>{o.badge_text}</span>}
                    {o.description && <div><small style={{ color: '#888' }}>{o.description}</small></div>}
                  </td>
                  <td>
                    {o.package ? (
                      <>
                        <div>{o.package.name}</div>
                        {o.offer_price_inr ? <small><strong>{inr(o.offer_price_inr)}</strong> <s style={{ color: '#999' }}>{inr(o.package.price_inr)}</s></small> : <small style={{ color: '#888' }}>Normal price</small>}
                      </>
                    ) : <small style={{ color: '#888' }}>{o.cta_url ? `Links to ${o.cta_url}` : 'Links to Packages'}</small>}
                  </td>
                  <td><small>{dateRange(o)}</small></td>
                  <td>{o.show_popup ? 'Yes' : <span style={{ color: '#999' }}>No</span>}</td>
                  <td>
                    <span className={`sp-badge ${st.badge}`}>{st.label}</span>
                    {o.status === 'image_missing' && <div><small style={{ color: '#B23B3B' }}>Upload the image again.</small></div>}
                    {o.status === 'package_hidden' && <div><small style={{ color: '#B23B3B' }}>Show the package again or link another.</small></div>}
                  </td>
                  {canEdit && (
                    <td>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <button className="sp-btn sp-btn-secondary sp-btn-sm" onClick={() => open(o)}>Edit</button>
                        <button className="sp-btn sp-btn-outline sp-btn-sm" onClick={() => toggle(o)}>{o.is_active ? 'Turn off' : 'Turn on'}</button>
                        <button className="sp-btn sp-btn-outline sp-btn-sm" onClick={() => setConfirmDelete(o)}>Delete</button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal isOpen onClose={() => setEditing(null)} title={editing.id ? `Edit offer: ${editing.title}` : 'New offer'} maxWidth="1040px">
          <form onSubmit={save} className="sp-offer-editor">
            <div className="sp-offer-editor-fields">
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div className="sp-form-group">
                  <label className="sp-form-label">Offer title *</label>
                  <input className="sp-input" maxLength={120} placeholder="e.g. Diwali Couple Care Offer" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} required />
                </div>
                <div className="sp-form-group">
                  <label className="sp-form-label">Badge</label>
                  <input className="sp-input" maxLength={40} placeholder="e.g. 20% OFF" value={editing.badge_text} onChange={(e) => setEditing({ ...editing, badge_text: e.target.value })} />
                </div>
              </div>
              <div className="sp-form-group">
                <label className="sp-form-label">Short text under the image</label>
                <input className="sp-input" maxLength={300} placeholder="One line about the offer" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <ImageField label="Offer card image" spec="offerCard" required value={editing.image_path} onChange={(v) => setEditing({ ...editing, image_path: v })} />
              <div className="sp-form-group">
                <label className="sp-form-label">Describe the image (for screen readers)</label>
                <input className="sp-input" maxLength={160} placeholder="e.g. Diwali offer: Couple Care Plan at ₹4,499" value={editing.image_alt} onChange={(e) => setEditing({ ...editing, image_alt: e.target.value })} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div className="sp-form-group">
                  <label className="sp-form-label">Package this offer is for</label>
                  <select className="sp-select" value={editing.package_id} onChange={(e) => setEditing({ ...editing, package_id: e.target.value, offer_price_inr: e.target.value ? editing.offer_price_inr : '' })}>
                    <option value="">No package (general offer)</option>
                    {packages.map(p => <option key={p.id} value={p.id}>{p.name} · {p.is_free ? 'Free' : inr(p.price_inr)}{p.is_active ? '' : ' (hidden)'}</option>)}
                  </select>
                </div>
                <div className="sp-form-group">
                  <label className="sp-form-label">Offer price (₹)</label>
                  <input type="number" min="1" step="1" className="sp-input" placeholder={editPkg && !editPkg.is_free ? `below ${editPkg.price_inr}` : 'optional'}
                    value={editing.offer_price_inr} disabled={!canPrice || !editing.package_id || (editPkg && editPkg.is_free)}
                    onChange={(e) => setEditing({ ...editing, offer_price_inr: e.target.value })} />
                </div>
              </div>
              <small className="sp-offer-help">
                {editing.package_id
                  ? (canPrice ? 'With an offer price, customers pay that price in the cart while the offer runs; the normal price shows crossed out. Leave it empty to only show the offer on the package card.' : 'Only administrators can set an offer price. Your offer will show on the package card at the normal price.')
                  : 'A general offer opens the page you choose below.'}
              </small>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginTop: '10px' }}>
                <div className="sp-form-group">
                  <label className="sp-form-label">Button text</label>
                  <input className="sp-input" maxLength={40} placeholder={editing.package_id ? 'Claim this offer' : 'Learn more'} value={editing.cta_label} onChange={(e) => setEditing({ ...editing, cta_label: e.target.value })} />
                </div>
                <div className="sp-form-group">
                  <label className="sp-form-label">Button opens</label>
                  {editing.package_id
                    ? <input className="sp-input" disabled value={`Packages page, ${editPkg ? editPkg.name : 'the package'} highlighted`} />
                    : <input className="sp-input" maxLength={255} placeholder="packages.htm, pre-marriage.htm or https://…" value={editing.cta_url} onChange={(e) => setEditing({ ...editing, cta_url: e.target.value })} />}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 90px', gap: '12px' }}>
                <div className="sp-form-group">
                  <label className="sp-form-label">First day</label>
                  <input type="date" className="sp-input" value={editing.start_date} onChange={(e) => setEditing({ ...editing, start_date: e.target.value })} />
                  <small style={{ color: '#888' }}>Empty = starts now</small>
                </div>
                <div className="sp-form-group">
                  <label className="sp-form-label">Last day</label>
                  <input type="date" className="sp-input" value={editing.end_date} min={editing.start_date || undefined} onChange={(e) => setEditing({ ...editing, end_date: e.target.value })} />
                  <small style={{ color: '#888' }}>Ends at midnight (India time). Empty = no end</small>
                </div>
                <div className="sp-form-group">
                  <label className="sp-form-label">Order</label>
                  <input type="number" min="0" className="sp-input" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: e.target.value })} />
                </div>
              </div>
              <div className="sp-form-group">
                <label className="sp-form-label">Small print (optional)</label>
                <input className="sp-input" maxLength={500} placeholder="e.g. One offer per customer. Valid on new bookings." value={editing.terms} onChange={(e) => setEditing({ ...editing, terms: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <Toggle label="Show in the website popup" checked={editing.show_popup} onChange={(v) => setEditing({ ...editing, show_popup: v })} />
                <Toggle label="Offer switched on" checked={editing.is_active} onChange={(v) => setEditing({ ...editing, is_active: v })} />
              </div>
              <FormActions onCancel={() => setEditing(null)} saving={saving} label={editing.id ? 'Save offer' : 'Add offer'} />
            </div>
            <div className="sp-offer-editor-preview">
              <div className="sp-form-label">Preview of the popup</div>
              <OfferPreview offer={editing} pkg={editPkg} />
              {editPkg && <small style={{ color: '#888', display: 'block', marginTop: '8px' }}>The {editPkg.name} card on the homepage and Packages page also shows this offer.</small>}
            </div>
          </form>
        </Modal>
      )}

      {confirmDelete && (
        <Modal isOpen onClose={() => setConfirmDelete(null)} title="Delete this offer?" maxWidth="440px">
          <p>"{confirmDelete.title}" will be removed from the website straight away. This cannot be undone. To pause an offer instead, use <strong>Turn off</strong>.</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" className="sp-btn sp-btn-outline" onClick={() => setConfirmDelete(null)}>Cancel</button>
            <button type="button" className="sp-btn sp-btn-primary" onClick={remove}>Delete offer</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
