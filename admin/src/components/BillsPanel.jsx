import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Modal from './Modal';
import { formatDateTimeIST, formatDateIST } from '../constants/statuses';
import { errorText } from './content/common';

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const GST_RATES = [0, 5, 12, 18];
const NEW = 'new';
const ACCOUNT = 'account';

const EMPTY_SELLER = { business_name: '', address: '', gstin: '', gst_rate: 0, sac_code: '', phone: '', email: '', website: '', footer_note: '' };

/** Same GST maths as the server: prices include GST */
function taxPreview(totalMinor, seller, customer) {
  const rate = Number(seller && seller.gst_rate) || 0;
  if (!seller || !seller.gstin || rate <= 0 || !totalMinor) return null;
  const taxable = Math.round(totalMinor * 100 / (100 + rate));
  const tax = totalMinor - taxable;
  const sameState = !customer || !customer.gstin || String(customer.gstin).slice(0, 2) === String(seller.gstin).slice(0, 2);
  if (sameState) {
    const c = Math.floor(tax / 2);
    return { taxable, lines: [[`CGST @ ${rate / 2}%`, c], [`SGST @ ${rate / 2}%`, tax - c]] };
  }
  return { taxable, lines: [[`IGST @ ${rate}%`, tax]] };
}

function sellerLine(p) {
  return [p.business_name, p.gstin ? `GSTIN ${p.gstin}` : 'no GSTIN', String(p.address || '').split('\n')[0]].filter(Boolean).join(' · ');
}

function StatusBadge({ inv }) {
  if (inv.status === 'sent') {
    return <span className="sp-badge confirmed" title={inv.sent_at ? `Sent ${formatDateTimeIST(inv.sent_at)}` : ''}>{inv.viewed_at ? 'Sent · seen by customer' : 'Sent to customer'}</span>;
  }
  if (inv.status === 'void') return <span className="sp-badge cancelled">Cancelled</span>;
  return <span className="sp-badge pending">Ready to send</span>;
}

/* ------------------------------------------------------------------ */
/* Prepare & send one bill                                              */
/* ------------------------------------------------------------------ */
function BillEditor({ billId, onClose, onChanged, onMessage }) {
  const { user } = useAuth();
  const canEdit = user?.can('orders:edit');
  const [data, setData] = useState(null);
  const [sellerChoice, setSellerChoice] = useState('');
  const [seller, setSeller] = useState(EMPTY_SELLER);
  const [editingSeller, setEditingSeller] = useState(false);
  const [makeDefault, setMakeDefault] = useState(false);
  const [customerChoice, setCustomerChoice] = useState(ACCOUNT);
  const [customer, setCustomer] = useState({ name: '', company: '', email: '', phone: '', address: '', gstin: '' });
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const fill = useCallback((d) => {
    setData(d);
    const inv = d.invoice;
    const current = inv.seller;
    const match = current && d.profiles.find(p => p.id === current.profile_id);
    if (match) { setSellerChoice(String(match.id)); setSeller({ ...EMPTY_SELLER, ...match }); setEditingSeller(false); }
    else if (current) { setSellerChoice(NEW); setSeller({ ...EMPTY_SELLER, ...current }); setEditingSeller(true); }
    else if (d.profiles.length) { const def = d.profiles[0]; setSellerChoice(String(def.id)); setSeller({ ...EMPTY_SELLER, ...def }); setEditingSeller(false); }
    else { setSellerChoice(NEW); setSeller({ ...EMPTY_SELLER, business_name: 'SPOUZY · Problem Solver Group (PSG)' }); setEditingSeller(true); }
    const c = inv.customer || {};
    setCustomer({ name: c.name || '', company: c.company || '', email: c.email || '', phone: c.phone || '', address: c.address || '', gstin: c.gstin || '' });
    const savedMatch = d.customer_details.find(x => x.name === c.name && (x.address || '') === (c.address || '') && (x.gstin || '') === (c.gstin || '') && (x.company || '') === (c.company || ''));
    setCustomerChoice(savedMatch ? String(savedMatch.id) : (c.address || c.gstin || c.company ? NEW : ACCOUNT));
    setNotes(inv.notes || '');
  }, []);

  useEffect(() => {
    let alive = true;
    api.get(`/admin/invoices/${billId}`).then(r => { if (alive) fill(r.data); }).catch(err => setError(errorText(err)));
    return () => { alive = false; };
  }, [billId, fill]);

  if (error && !data) return <Modal isOpen onClose={onClose} title="Bill" maxWidth="520px"><div className="sp-inline-alert error">{error}</div></Modal>;
  if (!data) return <Modal isOpen onClose={onClose} title="Bill" maxWidth="520px"><div style={{ textAlign: 'center', padding: '30px' }}><i className="fa fa-spinner fa-spin fa-2x"></i></div></Modal>;

  const inv = data.invoice;
  const locked = inv.status !== 'ready' || !canEdit;
  const tax = taxPreview(inv.total_minor, seller, customer);
  const viewUrl = `/invoice.htm?id=${inv.id}&staff=1`;

  function chooseSeller(v) {
    setSellerChoice(v);
    setErrors({});
    if (v === NEW) { setSeller({ ...EMPTY_SELLER }); setEditingSeller(true); return; }
    const p = data.profiles.find(x => String(x.id) === v);
    if (p) { setSeller({ ...EMPTY_SELLER, ...p }); setEditingSeller(false); }
  }
  function chooseCustomer(v) {
    setCustomerChoice(v);
    const c = inv.customer || {};
    if (v === ACCOUNT) { setCustomer({ name: c.name || '', company: '', email: c.email || '', phone: c.phone || '', address: '', gstin: '' }); return; }
    if (v === NEW) { setCustomer({ name: c.name || '', company: '', email: c.email || '', phone: c.phone || '', address: '', gstin: '' }); return; }
    const d = data.customer_details.find(x => String(x.id) === v);
    if (d) setCustomer({ name: d.name || '', company: d.company || '', email: d.email || c.email || '', phone: d.phone || c.phone || '', address: d.address || '', gstin: d.gstin || '' });
  }

  function body() {
    const s = (sellerChoice !== NEW && !editingSeller)
      ? { profile_id: Number(sellerChoice), make_default: makeDefault }
      : { ...seller, profile_id: sellerChoice !== NEW ? Number(sellerChoice) : undefined, edit: sellerChoice !== NEW, make_default: makeDefault };
    return { seller: s, customer, notes };
  }

  async function save(andSend) {
    setBusy(andSend ? 'send' : 'save');
    setErrors({});
    try {
      const r = await api.put(`/admin/invoices/${inv.id}`, body());
      let d = r.data;
      if (andSend) {
        const s = await api.post(`/admin/invoices/${inv.id}/send`, {});
        d = s.data;
        onMessage(`Bill ${inv.invoice_no} sent. ${inv.user_id ? 'The customer can now see it under My bills in their account.' : 'This customer has no account: use View bill to print or share it.'}`);
      } else {
        onMessage('Bill details saved. New details were added to the dropdowns for next time.');
      }
      fill(d);
      onChanged();
      if (andSend) onClose();
    } catch (err) {
      setErrors(err.data?.errors || {});
      setError(errorText(err));
      setTimeout(() => setError(''), 7000);
    } finally {
      setBusy('');
    }
  }

  const fe = (k) => errors[k] ? <small className="sp-field-error">{errors[k]}</small> : null;
  const sellerFields = (
    <div className="sp-bill-fields">
      <div className="sp-form-group sp-col-2">
        <label className="sp-form-label">Business name *</label>
        <input className="sp-input" value={seller.business_name} onChange={(e) => setSeller({ ...seller, business_name: e.target.value })} disabled={locked} />
        {fe('seller.business_name')}
      </div>
      <div className="sp-form-group sp-col-2">
        <label className="sp-form-label">Address *</label>
        <textarea className="sp-textarea" rows="2" value={seller.address} onChange={(e) => setSeller({ ...seller, address: e.target.value })} disabled={locked} placeholder="Building, street, area, city, PIN" />
        {fe('seller.address')}
      </div>
      <div className="sp-form-group">
        <label className="sp-form-label">GSTIN</label>
        <input className="sp-input" maxLength={15} value={seller.gstin || ''} onChange={(e) => setSeller({ ...seller, gstin: e.target.value.toUpperCase() })} disabled={locked} placeholder="27ABCDE1234F1Z5 (optional)" />
        {fe('seller.gstin')}
      </div>
      <div className="sp-form-group">
        <label className="sp-form-label">GST included in prices</label>
        <select className="sp-select" value={Number(seller.gst_rate) || 0} onChange={(e) => setSeller({ ...seller, gst_rate: Number(e.target.value) })} disabled={locked}>
          {GST_RATES.map(r => <option key={r} value={r}>{r ? `${r}% GST` : 'No GST on the bill'}</option>)}
        </select>
        {fe('seller.gst_rate')}
      </div>
      <div className="sp-form-group">
        <label className="sp-form-label">Phone</label>
        <input className="sp-input" value={seller.phone || ''} onChange={(e) => setSeller({ ...seller, phone: e.target.value })} disabled={locked} />
      </div>
      <div className="sp-form-group">
        <label className="sp-form-label">Email</label>
        <input className="sp-input" value={seller.email || ''} onChange={(e) => setSeller({ ...seller, email: e.target.value })} disabled={locked} />
        {fe('seller.email')}
      </div>
      <div className="sp-form-group">
        <label className="sp-form-label">SAC code</label>
        <input className="sp-input" maxLength={10} value={seller.sac_code || ''} onChange={(e) => setSeller({ ...seller, sac_code: e.target.value })} disabled={locked} placeholder="optional" />
      </div>
      <div className="sp-form-group">
        <label className="sp-form-label">Website</label>
        <input className="sp-input" value={seller.website || ''} onChange={(e) => setSeller({ ...seller, website: e.target.value })} disabled={locked} placeholder="optional" />
      </div>
      <div className="sp-form-group sp-col-2">
        <label className="sp-form-label">Thank-you line at the bottom of the bill</label>
        <input className="sp-input" maxLength={300} value={seller.footer_note || ''} onChange={(e) => setSeller({ ...seller, footer_note: e.target.value })} disabled={locked} placeholder="e.g. Thank you for trusting SPOUZY." />
      </div>
    </div>
  );

  return (
    <Modal isOpen onClose={onClose} title={`${locked ? 'Bill' : 'Prepare bill'} ${inv.invoice_no}`} maxWidth="1080px">
      {error && <div className="sp-inline-alert error"><i className="fa fa-exclamation-circle"></i> {error}</div>}
      {inv.status === 'sent' && (
        <div className="sp-inline-alert success">
          Sent to the customer {formatDateTimeIST(inv.sent_at)}{inv.sent_by ? ` by ${inv.sent_by}` : ''}.{inv.viewed_at ? ` The customer opened it ${formatDateTimeIST(inv.viewed_at)}.` : ''} A sent bill cannot be changed.
        </div>
      )}
      <div className="sp-bill-editor">
        <div>
          <section className="sp-bill-box">
            <h4>Bill from <small>(your business)</small></h4>
            {!locked && (
              <div className="sp-form-group">
                <label className="sp-form-label">Saved details</label>
                <select className="sp-select" value={sellerChoice} onChange={(e) => chooseSeller(e.target.value)}>
                  {data.profiles.map(p => <option key={p.id} value={p.id}>{p.is_default ? '★ ' : ''}{sellerLine(p)}</option>)}
                  <option value={NEW}>+ Enter new details</option>
                </select>
              </div>
            )}
            {(editingSeller || locked) ? sellerFields : (
              <div className="sp-bill-summary">
                <strong>{seller.business_name}</strong>
                <div style={{ whiteSpace: 'pre-line' }}>{seller.address}</div>
                <div>{seller.gstin ? `GSTIN ${seller.gstin}` : 'No GSTIN'}{Number(seller.gst_rate) ? ` · ${seller.gst_rate}% GST included` : ''}</div>
                {(seller.phone || seller.email) && <div>{[seller.phone, seller.email].filter(Boolean).join(' · ')}</div>}
                <button type="button" className="sp-btn sp-btn-outline sp-btn-sm" onClick={() => setEditingSeller(true)}>Edit these saved details</button>
              </div>
            )}
            {!locked && (
              <label className="sp-bill-check"><input type="checkbox" checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} /> Use as the default for new bills</label>
            )}
          </section>

          <section className="sp-bill-box">
            <h4>Bill to <small>(customer)</small></h4>
            {!locked && (
              <div className="sp-form-group">
                <label className="sp-form-label">Customer details</label>
                <select className="sp-select" value={customerChoice} onChange={(e) => chooseCustomer(e.target.value)}>
                  <option value={ACCOUNT}>Name, email and phone from the account</option>
                  {data.customer_details.map(d => <option key={d.id} value={d.id}>{[d.company || d.name, d.gstin ? `GSTIN ${d.gstin}` : null, String(d.address || '').split('\n')[0]].filter(Boolean).join(' · ')}</option>)}
                  <option value={NEW}>+ Add billing address / GSTIN</option>
                </select>
              </div>
            )}
            <div className="sp-bill-fields">
              <div className="sp-form-group">
                <label className="sp-form-label">Name *</label>
                <input className="sp-input" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} disabled={locked} />
                {fe('customer.name')}
              </div>
              <div className="sp-form-group">
                <label className="sp-form-label">Company</label>
                <input className="sp-input" value={customer.company} onChange={(e) => setCustomer({ ...customer, company: e.target.value })} disabled={locked || customerChoice === ACCOUNT} placeholder="optional" />
              </div>
              <div className="sp-form-group">
                <label className="sp-form-label">Email</label>
                <input className="sp-input" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} disabled={locked} />
                {fe('customer.email')}
              </div>
              <div className="sp-form-group">
                <label className="sp-form-label">Phone</label>
                <input className="sp-input" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} disabled={locked} />
              </div>
              {customerChoice !== ACCOUNT && (
                <>
                  <div className="sp-form-group sp-col-2">
                    <label className="sp-form-label">Billing address</label>
                    <textarea className="sp-textarea" rows="2" value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} disabled={locked} />
                  </div>
                  <div className="sp-form-group">
                    <label className="sp-form-label">Customer GSTIN</label>
                    <input className="sp-input" maxLength={15} value={customer.gstin} onChange={(e) => setCustomer({ ...customer, gstin: e.target.value.toUpperCase() })} disabled={locked} placeholder="optional" />
                    {fe('customer.gstin')}
                  </div>
                </>
              )}
            </div>
          </section>

          <div className="sp-form-group">
            <label className="sp-form-label">Note on the bill (optional)</label>
            <input className="sp-input" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={locked} placeholder="e.g. Sessions can be taken online or at the clinic." />
          </div>
        </div>

        <aside className="sp-bill-side">
          <div className="sp-bill-paper">
            <div className="sp-bill-paper-head">
              <span>{tax ? 'TAX INVOICE' : 'BILL'}</span>
              <strong>{inv.invoice_no}</strong>
              <small>{formatDateIST(inv.issued_at)}</small>
            </div>
            {inv.items.map((it, i) => (
              <div className="sp-bill-line" key={i}>
                <div><strong>{it.description}</strong>{it.quantity > 1 ? ` × ${it.quantity}` : ''}{it.detail && <small>{it.detail}</small>}</div>
                <span>{inr(it.total_inr)}</span>
              </div>
            ))}
            {inv.discount_inr > 0 && <div className="sp-bill-line is-muted"><div>Normal price {inr(inv.subtotal_inr)}, offer saving</div><span>−{inr(inv.discount_inr)}</span></div>}
            {tax && (
              <>
                <div className="sp-bill-line is-muted"><div>Taxable value</div><span>{inr(tax.taxable / 100)}</span></div>
                {tax.lines.map(([label, minor]) => <div className="sp-bill-line is-muted" key={label}><div>{label} (included)</div><span>{inr(minor / 100)}</span></div>)}
              </>
            )}
            <div className="sp-bill-total"><span>Total paid</span><strong>{inr(inv.total_inr)}</strong></div>
            <small className="sp-bill-words">{inv.amount_in_words}</small>
            {inv.payment && (
              <small className="sp-bill-pay">
                {inv.payment.method}{inv.payment.gateway_payment_id ? ` · ${inv.payment.gateway_payment_id}` : ''}<br />
                {inv.payment.reference_label} {inv.payment.reference}{inv.payment.paid_at ? ` · ${formatDateTimeIST(inv.payment.paid_at)}` : ''}
              </small>
            )}
          </div>
          <a className="sp-btn sp-btn-outline sp-btn-sm sp-bill-view" href={viewUrl} target="_blank" rel="noreferrer">
            <i className="fa fa-external-link"></i> View bill as the customer sees it{inv.status === 'ready' ? ' (saved details)' : ''}
          </a>
          {!inv.user_id && <small style={{ color: '#8a6d3b', display: 'block', marginTop: '8px' }}>This customer booked without an account, so the bill cannot appear in an account. Open the bill and print or save it as PDF to share it.</small>}
        </aside>
      </div>

      <div className="sp-bill-actions">
        <button type="button" className="sp-btn sp-btn-outline" onClick={onClose}>Close</button>
        {!locked && <button type="button" className="sp-btn sp-btn-secondary" disabled={!!busy} onClick={() => save(false)}>{busy === 'save' ? 'Saving…' : 'Save details'}</button>}
        {!locked && <button type="button" className="sp-btn sp-btn-primary" disabled={!!busy} onClick={() => save(true)}><i className="fa fa-paper-plane"></i> {busy === 'send' ? 'Sending…' : 'Save & send to customer'}</button>}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Saved "Bill from" details                                             */
/* ------------------------------------------------------------------ */
function SavedProfiles({ onMessage }) {
  const { user } = useAuth();
  const canEdit = user?.can('orders:edit');
  const [rows, setRows] = useState(null);
  const load = useCallback(() => api.get('/admin/billing-profiles').then(r => setRows(r.data || [])).catch(() => setRows([])), []);
  useEffect(() => { load(); }, [load]);
  if (!rows || !rows.length) return null;
  async function act(fn, msg) {
    try { await fn(); onMessage(msg); load(); } catch (err) { onMessage(errorText(err), true); }
  }
  return (
    <details className="sp-bill-profiles">
      <summary>Saved "Bill from" details ({rows.length})</summary>
      <ul>
        {rows.map(p => (
          <li key={p.id}>
            <div>{p.is_default && <span className="sp-badge confirmed" style={{ marginRight: '6px' }}>Default</span>}<strong>{p.business_name}</strong><small>{sellerLine(p)}</small></div>
            {canEdit && (
              <div style={{ display: 'flex', gap: '6px' }}>
                {!p.is_default && <button className="sp-btn sp-btn-outline sp-btn-sm" onClick={() => act(() => api.post(`/admin/billing-profiles/${p.id}/default`, {}), `${p.business_name} is now the default for new bills.`)}>Make default</button>}
                <button className="sp-btn sp-btn-outline sp-btn-sm" onClick={() => window.confirm('Remove these saved details from the dropdown? Bills already made keep their own copy.') && act(() => api.delete(`/admin/billing-profiles/${p.id}`), 'Saved details removed.')}>Remove</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

/* ------------------------------------------------------------------ */
/* Bills list                                                            */
/* ------------------------------------------------------------------ */
export default function BillsPanel({ onMessage, openBillId, onCloseBill, initialStatus }) {
  const { user } = useAuth();
  const canEdit = user?.can('orders:edit');
  const [status, setStatus] = useState(['ready', 'sent'].includes(initialStatus) ? initialStatus : '');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ total: 0, counts: {}, invoices: [] });
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(openBillId || null);
  const [profilesKey, setProfilesKey] = useState(0);

  useEffect(() => { if (openBillId) setOpenId(openBillId); }, [openBillId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page, limit: 20, ...(status && { status }), ...(search && { search }) });
      const res = await api.get(`/admin/invoices?${q}`);
      setData(res.data || { total: 0, counts: {}, invoices: [] });
    } catch (err) {
      onMessage(errorText(err), true);
    } finally {
      setLoading(false);
    }
  }, [page, status, search, onMessage]);
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [page, status]);
  // A new payment arrived while this page is open: show its bill straight away
  useEffect(() => {
    const onNew = (e) => { if ((e.detail || []).some(n => n.category === 'payments')) load(); };
    window.addEventListener('spouzy:new-notifications', onNew);
    return () => window.removeEventListener('spouzy:new-notifications', onNew);
  }, [load]);

  const ready = data.counts.ready || 0;

  return (
    <div>
      <div className={`sp-offer-state ${ready ? '' : 'is-live'}`}>
        <i className={`fa ${ready ? 'fa-paper-plane' : 'fa-check-circle'}`} aria-hidden="true"></i>
        {ready
          ? <span><strong>{ready} bill{ready > 1 ? 's are' : ' is'} ready to send.</strong> A bill is made automatically when a payment comes in. Open it, check the details and press <strong>Save &amp; send to customer</strong>; it then appears in the customer's account under My bills.</span>
          : <span><strong>All bills are sent.</strong> New bills appear here automatically after each payment, and the bell at the top tells you.</span>}
      </div>

      <form className="sp-filters-bar" onSubmit={(e) => { e.preventDefault(); setPage(1); load(); }}>
        <div className="sp-segmented" role="group" aria-label="Filter bills">
          {[['', 'All bills'], ['ready', `Ready to send${ready ? ` (${ready})` : ''}`], ['sent', 'Sent']].map(([v, l]) => (
            <button key={v} type="button" className={status === v ? 'is-active' : ''} onClick={() => { setStatus(v); setPage(1); }}>{l}</button>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: '220px' }}>
          <input className="sp-input" placeholder="Search bill number, customer name, email or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button type="submit" className="sp-btn sp-btn-secondary">Search</button>
      </form>

      <div className="sp-table-wrapper">
        <table className="sp-table">
          <thead><tr><th>Bill</th><th>Customer</th><th>For</th><th>Amount</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '24px' }}><i className="fa fa-spinner fa-spin"></i></td></tr>
            ) : data.invoices.length === 0 ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: '#999' }}>No bills yet. The first bill is made automatically when a customer pays.</td></tr>
            ) : data.invoices.map(b => (
              <tr key={b.id} className={b.status === 'ready' ? 'sp-row-attention' : ''}>
                <td><strong style={{ color: 'var(--sp-copper)' }}>{b.invoice_no}</strong><div><small style={{ color: '#888' }}>{formatDateTimeIST(b.issued_at)}</small></div></td>
                <td>{b.customer.name}<div><small style={{ color: '#888' }}>{b.customer.email || b.customer.phone || ''}</small></div></td>
                <td style={{ maxWidth: '260px' }}><small>{b.items.map(i => i.description + (i.quantity > 1 ? ` × ${i.quantity}` : '')).join(', ')}</small>{b.source === 'manual' && <div><small style={{ color: '#888' }}>Payment recorded by staff</small></div>}</td>
                <td><strong>{inr(b.total_inr)}</strong></td>
                <td><StatusBadge inv={b} /></td>
                <td>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {b.status === 'ready' && canEdit
                      ? <button className="sp-btn sp-btn-primary sp-btn-sm" onClick={() => setOpenId(b.id)}>Prepare &amp; send</button>
                      : <button className="sp-btn sp-btn-secondary sp-btn-sm" onClick={() => setOpenId(b.id)}>Details</button>}
                    <a className="sp-btn sp-btn-outline sp-btn-sm" href={`/invoice.htm?id=${b.id}&staff=1`} target="_blank" rel="noreferrer">View bill</a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '14px', alignItems: 'center' }}>
        <span style={{ fontSize: '13px', color: '#666' }}>{data.total} bills</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="sp-btn sp-btn-secondary sp-btn-sm">Previous</button>
          <button disabled={page * 20 >= data.total} onClick={() => setPage(page + 1)} className="sp-btn sp-btn-secondary sp-btn-sm">Next</button>
        </div>
      </div>

      <SavedProfiles key={profilesKey} onMessage={onMessage} />

      {openId && (
        <BillEditor
          billId={openId}
          onMessage={onMessage}
          onChanged={() => { load(); setProfilesKey(k => k + 1); }}
          onClose={() => { setOpenId(null); if (onCloseBill) onCloseBill(); }}
        />
      )}
    </div>
  );
}
