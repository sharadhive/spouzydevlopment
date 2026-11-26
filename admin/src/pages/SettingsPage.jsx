import React, { useEffect, useState, useRef } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatDateTimeIST } from '../constants/statuses';
import HelpBox from '../components/HelpBox';

// Only these keys are accepted by the backend (EDITABLE_SETTINGS in content.service.js)
const SETTING_KEYS = ['announcement_text', 'whatsapp_number', 'contact_phone', 'support_email', 'cursor_enabled', 'booking_requires_account', 'chat_enabled', 'chat_idle_seconds'];

export default function SettingsPage() {
  const { user } = useAuth();
  const canManageGateway = user && (user.isAdmin || user.can('settings:gateway'));
  const canEditSettings = user && (user.isAdmin || user.can('settings:content'));

  const [tab, setTab] = useState(canEditSettings ? 'settings' : 'gateway');
  const [settings, setSettings] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [gatewayConfig, setGatewayConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [pageError, setPageError] = useState('');
  const [gwForm, setGwForm] = useState({ provider: 'razorpay', mode: 'test', key_id: '', secret: '', webhook_secret: '', is_active: false });

  const abortControllerRef = useRef(null);

  useEffect(() => {
    if (tab === 'gateway' && !canManageGateway) { setTab('settings'); return; }
    loadData();
    return () => { if (abortControllerRef.current) abortControllerRef.current.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, canManageGateway]);

  async function loadData() {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    setLoading(true);
    setPageError('');
    try {
      if (tab === 'settings') {
        const res = await api.get('/admin/settings', { signal: abortControllerRef.current.signal });
        if (res.success) {
          const map = {};
          (res.data || []).forEach(s => { if (SETTING_KEYS.includes(s.setting_key)) map[s.setting_key] = s.setting_value; });
          setSettings(map);
        }
      } else if (canManageGateway) {
        const res = await api.get('/admin/gateway-config', { signal: abortControllerRef.current.signal });
        if (res.success && res.data) {
          setGatewayConfig(res.data);
          setGwForm({
            provider: 'razorpay',
            mode: res.data.mode || 'test',
            key_id: res.data.key_id || '',
            secret: '',
            webhook_secret: '',
            is_active: !!res.data.is_active
          });
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') setPageError(e.message || 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  }

  function showMessage(msg, isErr = false) {
    if (isErr) {
      setPageError(msg);
      setTimeout(() => setPageError(''), 7000);
    } else {
      setFeedback(msg);
      setTimeout(() => setFeedback(''), 5000);
    }
  }

  async function handleSaveSettings(e) {
    e.preventDefault();
    setSaving(true);
    setFieldErrors({});
    try {
      const payload = {};
      SETTING_KEYS.forEach(k => { if (settings[k] !== undefined) payload[k] = settings[k]; });
      await api.put('/admin/settings', payload);
      showMessage('Settings saved. The website shows the new details on the next page load.');
    } catch (err) {
      setFieldErrors(err.data?.errors || {});
      showMessage(err.message, true);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveGateway(e) {
    e.preventDefault();
    if (!canManageGateway) return;
    setSaving(true);
    setFieldErrors({});
    try {
      const payload = { ...gwForm };
      if (!payload.secret) delete payload.secret;
      if (!payload.webhook_secret) delete payload.webhook_secret;
      const res = await api.put('/admin/gateway-config', payload);
      if (res.data) setGatewayConfig(res.data);
      showMessage(res.data?.online_enabled ? 'Payment driver saved and active — online payment is now live on the website.' : 'Payment driver saved. Online payment is switched off; the website shows "coming soon".');
      loadData();
    } catch (err) {
      setFieldErrors(err.data?.errors || {});
      showMessage(err.message, true);
    } finally {
      setSaving(false);
    }
  }

  const fieldError = (k) => fieldErrors[k] ? <small style={{ color: '#C62828' }}>{fieldErrors[k]}</small> : null;
  const webhookUrl = `${window.location.origin}${gatewayConfig?.webhook_url_path || '/api/payments/webhook'}`;

  return (
    <div>
      <div className="sp-card">
        <div className="sp-card-header">
          <h2 className="sp-card-title"><i className="fa fa-sliders" style={{ marginRight: '8px' }}></i> {canManageGateway ? 'Settings & Payment Driver' : 'Site Settings'}</h2>
        </div>

        {feedback && <div className="sp-inline-alert success"><i className="fa fa-check-circle"></i> {feedback}</div>}
        {pageError && (
          <div className="sp-inline-alert error">
            <i className="fa fa-exclamation-circle"></i> {pageError}
          </div>
        )}

        <div className="sp-tabs">
          {canEditSettings && (
            <button type="button" className={`sp-tab-btn ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}><i className="fa fa-cog"></i> Website Contact &amp; Display</button>
          )}
          {canManageGateway && (
            <button type="button" className={`sp-tab-btn ${tab === 'gateway' ? 'active' : ''}`} onClick={() => setTab('gateway')}><i className="fa fa-credit-card"></i> Payment Driver (Razorpay)</button>
          )}
        </div>
        <HelpBox key={`help-${tab}`} topic={tab === 'gateway' ? 'settings.gateway' : 'settings'} />

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}><i className="fa fa-spinner fa-spin fa-2x"></i></div>
        ) : tab === 'settings' ? (
          <form onSubmit={handleSaveSettings} style={{ maxWidth: '640px', padding: '10px 0' }}>
            <div className="sp-form-group">
              <label className="sp-form-label">Announcement bar text</label>
              <textarea className="sp-textarea" rows="2" value={settings.announcement_text || ''} onChange={(e) => setSettings({ ...settings, announcement_text: e.target.value })} />
              <small style={{ color: '#777' }}>Shown in the scrolling bar at the top of every page.</small>
            </div>
            <div className="sp-form-group">
              <label className="sp-form-label">WhatsApp number</label>
              <input type="text" className="sp-input" placeholder="+91 85919 45055" value={settings.whatsapp_number || ''} onChange={(e) => setSettings({ ...settings, whatsapp_number: e.target.value })} />
              {fieldError('whatsapp_number') || <small style={{ color: '#777' }}>Used for every WhatsApp button and after form submissions.</small>}
            </div>
            <div className="sp-form-group">
              <label className="sp-form-label">Phone number</label>
              <input type="text" className="sp-input" value={settings.contact_phone || ''} onChange={(e) => setSettings({ ...settings, contact_phone: e.target.value })} />
              {fieldError('contact_phone')}
            </div>
            <div className="sp-form-group">
              <label className="sp-form-label">Support email</label>
              <input type="email" className="sp-input" value={settings.support_email || ''} onChange={(e) => setSettings({ ...settings, support_email: e.target.value })} />
              {fieldError('support_email')}
            </div>
            <div className="sp-form-group">
              <label className="sp-form-label">Custom cursor</label>
              <select className="sp-select" value={String(settings.cursor_enabled ?? 'true')} onChange={(e) => setSettings({ ...settings, cursor_enabled: e.target.value })}>
                <option value="true">On</option>
                <option value="false">Off (standard cursor)</option>
              </select>
            </div>
            <div className="sp-form-group">
              <label className="sp-form-label">Appointment booking</label>
              <select className="sp-select" value={String(settings.booking_requires_account ?? 'true')} onChange={(e) => setSettings({ ...settings, booking_requires_account: e.target.value })}>
                <option value="true">Customers must log in or create an account to book (recommended)</option>
                <option value="false">Anyone can book without an account</option>
              </select>
              <small style={{ color: '#777' }}>With accounts, bookings appear in the customer's My Account and their details are filled in automatically.</small>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
              <div className="sp-form-group">
                <label className="sp-form-label">Website chat assistant</label>
                <select className="sp-select" value={String(settings.chat_enabled ?? 'true')} onChange={(e) => setSettings({ ...settings, chat_enabled: e.target.value })}>
                  <option value="true">On — the chat button opens the assistant</option>
                  <option value="false">Off — the button shows WhatsApp and call options</option>
                </select>
              </div>
              <div className="sp-form-group">
                <label className="sp-form-label">End chat after (seconds without a reply)</label>
                <input type="number" min="15" max="600" className="sp-input" value={settings.chat_idle_seconds ?? '30'} onChange={(e) => setSettings({ ...settings, chat_idle_seconds: e.target.value })} />
                {fieldError('chat_idle_seconds')}
              </div>
            </div>
            <button type="submit" disabled={saving} className="sp-btn sp-btn-primary" style={{ marginTop: '12px' }}>{saving ? 'Saving…' : 'Save Settings'}</button>
          </form>
        ) : (
          canManageGateway && (
            <form onSubmit={handleSaveGateway} style={{ maxWidth: '680px', padding: '10px 0' }}>
              <div className={`sp-inline-alert ${gatewayConfig?.online_enabled ? 'success' : 'info'}`}>
                <strong>{gatewayConfig?.online_enabled ? 'Online payment is LIVE' : 'Online payment is OFF — website shows "coming soon"'}</strong>
                <div style={{ fontSize: '13px', marginTop: '4px' }}>{gatewayConfig?.website_message}</div>
                {gatewayConfig?.updated_at && <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.8 }}>Last saved {formatDateTimeIST(gatewayConfig.updated_at)}{gatewayConfig.version ? ` · version ${gatewayConfig.version}` : ''}</div>}
                {gatewayConfig?.using_env_keys && <div style={{ fontSize: '12px', marginTop: '4px' }}>Currently using keys from the server .env file. Saving here replaces them.</div>}
              </div>

              <div className="sp-form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input id="gwActive" type="checkbox" checked={gwForm.is_active} onChange={(e) => setGwForm({ ...gwForm, is_active: e.target.checked })} />
                <label htmlFor="gwActive" style={{ fontWeight: 600 }}>Driver active (take online payments on the website)</label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="sp-form-group">
                  <label className="sp-form-label">Driver</label>
                  <select className="sp-select" value="razorpay" disabled><option value="razorpay">Razorpay Standard Checkout</option></select>
                </div>
                <div className="sp-form-group">
                  <label className="sp-form-label">Mode</label>
                  <select className="sp-select" value={gwForm.mode} onChange={(e) => setGwForm({ ...gwForm, mode: e.target.value })}>
                    <option value="test">Test (rzp_test_…)</option>
                    <option value="live">Live (rzp_live_…)</option>
                  </select>
                  {fieldError('mode')}
                </div>
              </div>

              <div className="sp-form-group">
                <label className="sp-form-label">Razorpay Key ID</label>
                <input type="text" className="sp-input" value={gwForm.key_id} onChange={(e) => setGwForm({ ...gwForm, key_id: e.target.value.trim() })} placeholder={`rzp_${gwForm.mode}_...`} required={gwForm.is_active} />
                {fieldError('key_id')}
              </div>
              <div className="sp-form-group">
                <label className="sp-form-label">Razorpay Key Secret {gatewayConfig?.masked_secret && <span style={{ color: '#888', fontWeight: 'normal' }}>(saved: {gatewayConfig.masked_secret})</span>}</label>
                <input type="password" className="sp-input" autoComplete="new-password" value={gwForm.secret} onChange={(e) => setGwForm({ ...gwForm, secret: e.target.value })} placeholder={gatewayConfig?.has_secret ? 'Leave empty to keep the saved secret' : 'Paste the key secret'} />
                {fieldError('secret')}
              </div>
              <div className="sp-form-group">
                <label className="sp-form-label">Webhook secret {gatewayConfig?.has_webhook_secret && <span style={{ color: '#888', fontWeight: 'normal' }}>(saved)</span>}</label>
                <input type="password" className="sp-input" autoComplete="new-password" value={gwForm.webhook_secret} onChange={(e) => setGwForm({ ...gwForm, webhook_secret: e.target.value })} placeholder="Optional — the secret you set on the Razorpay webhook" />
                <small style={{ color: '#777' }}>In Razorpay Dashboard → Webhooks, add <code>{webhookUrl}</code> with the events <code>payment.captured</code> and <code>order.paid</code>.</small>
              </div>

              <p style={{ fontSize: '12.5px', color: '#777' }}><i className="fa fa-lock"></i> Secrets are stored encrypted (AES-256-GCM) and never sent back to the browser.</p>
              <button type="submit" disabled={saving} className="sp-btn sp-btn-primary">{saving ? 'Saving…' : 'Save Payment Driver'}</button>
            </form>
          )
        )}
      </div>
    </div>
  );
}
