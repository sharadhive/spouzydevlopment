import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { formatDateTimeIST } from '../constants/statuses';
import { errorText, Toggle, FormActions } from '../components/content/common';
import HelpBox from '../components/HelpBox';

const END_LABELS = { idle: 'Ended (no reply)', closed: 'Closed', user: 'Ended by customer' };

function Loading() {
  return <div style={{ textAlign: 'center', padding: '30px', color: '#666' }}><i className="fa fa-spinner fa-spin fa-2x"></i></div>;
}

function TranscriptModal({ id, onClose, onAddFaq }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api.get(`/admin/chats/${id}`).then(r => setData(r.data)).catch(e => setError(errorText(e)));
  }, [id]);
  return (
    <Modal isOpen onClose={onClose} title={data ? `Chat with ${data.customer?.name || 'customer'}` : 'Chat'} maxWidth="720px">
      {error && <div className="sp-inline-alert error">{error}</div>}
      {!data && !error && <Loading />}
      {data && (
        <>
          <div className="sp-detail-grid">
            <div><span className="sp-detail-label">Customer</span><div><strong>{data.customer?.name}</strong></div><div>{data.customer?.email}</div><div>{data.customer?.phone}</div></div>
            <div><span className="sp-detail-label">Chat</span><div>Started {formatDateTimeIST(data.started_at)}</div><div>{data.status === 'open' ? 'Open' : END_LABELS[data.ended_reason] || 'Ended'}{data.page ? ` · from ${data.page}` : ''}</div></div>
          </div>
          {data.customer?.phone && (
            <p><a className="sp-btn sp-btn-outline sp-btn-sm" target="_blank" rel="noreferrer"
              href={`https://wa.me/${String(data.customer.phone).replace(/\D/g, '')}?text=${encodeURIComponent(`Hello ${data.customer.name || ''}, this is the SPOUZY team following up on your chat.`)}`}>
              <i className="fa fa-whatsapp"></i> Follow up on WhatsApp
            </a></p>
          )}
          <div className="sp-chat-transcript">
            {data.messages.map(m => (
              <div key={m.id} className={`sp-chat-line ${m.sender === 'user' ? 'is-user' : 'is-bot'} ${m.sender === 'user' && m.matched === false ? 'is-missed' : ''}`}>
                <div className="sp-chat-line-bubble">
                  {m.text}
                  <div className="sp-chat-line-meta">
                    {new Date(m.at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}
                    {m.sender === 'user' && m.matched === false && (
                      <> · not understood {onAddFaq && <button type="button" className="sp-link-btn" onClick={() => onAddFaq(m.text)}>Add an answer</button>}</>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}

function AddFaqModal({ question, onClose, onSaved }) {
  const [form, setForm] = useState({ question: question || '', answer_html: '', category: 'General', is_published: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/admin/faqs', form);
      onSaved();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal isOpen onClose={onClose} title="Teach the assistant an answer">
      <form onSubmit={save}>
        <p style={{ marginTop: 0, fontSize: '13px', color: '#666' }}>This saves an FAQ. The chat assistant uses it straight away for similar questions, and it also appears on the FAQ page when published.</p>
        {error && <div className="sp-inline-alert error">{error}</div>}
        <div className="sp-form-group">
          <label className="sp-form-label">Question (write it the way customers ask)</label>
          <input className="sp-input" value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} required />
        </div>
        <div className="sp-form-group">
          <label className="sp-form-label">Answer</label>
          <textarea className="sp-textarea" rows="5" value={form.answer_html} onChange={(e) => setForm({ ...form, answer_html: e.target.value })} required />
        </div>
        <div className="sp-form-group">
          <label className="sp-form-label">Category</label>
          <input className="sp-input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
        </div>
        <Toggle label="Also show on the FAQ page" checked={form.is_published} onChange={(v) => setForm({ ...form, is_published: v })} />
        <FormActions onCancel={onClose} saving={saving} label="Save answer" />
      </form>
    </Modal>
  );
}

export default function ChatsPage() {
  const { user } = useAuth();
  const canTeach = user?.can('moderation:edit');
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'questions' ? 'questions' : 'chats';
  const [chats, setChats] = useState({ total: 0, conversations: [] });
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [onlyMissed, setOnlyMissed] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);
  const [faqQuestion, setFaqQuestion] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [pageError, setPageError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setPageError('');
    try {
      if (tab === 'chats') {
        const q = new URLSearchParams({ page, limit: 25, ...(onlyMissed && { unanswered: 'true' }), ...(search && { search }) });
        const r = await api.get(`/admin/chats?${q}`);
        setChats(r.data);
      } else {
        const r = await api.get('/admin/chat-unanswered?days=30');
        setQuestions(r.data || []);
      }
    } catch (err) {
      setPageError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [tab, page, onlyMissed, search]);

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tab, page, onlyMissed]);

  function saved() {
    setFaqQuestion(null);
    setFeedback('Answer saved. The assistant will use it from now on.');
    setTimeout(() => setFeedback(''), 5000);
    if (tab === 'questions') load();
  }

  return (
    <div className="sp-card">
      <div className="sp-card-header">
        <h2 className="sp-card-title"><i className="fa fa-comments" style={{ marginRight: '8px' }}></i> Website Chat</h2>
      </div>
      {feedback && <div className="sp-inline-alert success"><i className="fa fa-check-circle"></i> {feedback}</div>}
      {pageError && <div className="sp-inline-alert error">{pageError}</div>}
      <p style={{ marginTop: 0, fontSize: '13px', color: '#666' }}>
        Customers chat with the automatic assistant after logging in. It answers from your prices, packages, FAQs and contact settings.
        Questions it could not answer are listed under "Questions to answer" — add an answer once and the assistant learns it.
        Chat on/off and the idle time are in Settings.
      </p>
      <div className="sp-tabs">
        <button type="button" className={`sp-tab-btn ${tab === 'chats' ? 'active' : ''}`} onClick={() => setSearchParams({ tab: 'chats' })}><i className="fa fa-comments-o"></i> Conversations</button>
        <button type="button" className={`sp-tab-btn ${tab === 'questions' ? 'active' : ''}`} onClick={() => setSearchParams({ tab: 'questions' })}><i className="fa fa-question-circle"></i> Questions to answer</button>
      </div>
      <HelpBox topic="chats" />

      {tab === 'chats' && (
        <>
          <form className="sp-filters-bar" onSubmit={(e) => { e.preventDefault(); setPage(1); load(); }}>
            <div style={{ flex: 1 }}><input className="sp-input" placeholder="Search customer name, email or phone" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            <Toggle label="Only chats with unanswered questions" checked={onlyMissed} onChange={(v) => { setOnlyMissed(v); setPage(1); }} />
            <button type="submit" className="sp-btn sp-btn-secondary">Search</button>
          </form>
          {loading ? <Loading /> : (
            <div className="sp-table-wrapper">
              <table className="sp-table">
                <thead><tr><th>Customer</th><th>Started (IST)</th><th>First question</th><th>Messages</th><th>Not understood</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {chats.conversations.length === 0 ? (
                    <tr><td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: '#999' }}>No chats yet.</td></tr>
                  ) : chats.conversations.map(c => (
                    <tr key={c.id}>
                      <td><strong>{c.customer?.name}</strong><div><small style={{ color: '#888' }}>{c.customer?.email}</small></div></td>
                      <td>{formatDateTimeIST(c.started_at)}</td>
                      <td style={{ maxWidth: '280px' }}><small>{c.first_question || '—'}</small></td>
                      <td>{c.message_count}</td>
                      <td>{c.unanswered_count ? <span className="sp-badge pending">{c.unanswered_count}</span> : '—'}</td>
                      <td><span className={`sp-badge ${c.status === 'open' ? 'confirmed' : 'closed'}`}>{c.status === 'open' ? 'Open' : END_LABELS[c.ended_reason] || 'Ended'}</span></td>
                      <td><button className="sp-btn sp-btn-secondary sp-btn-sm" onClick={() => setOpenId(c.id)}>View</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '14px' }}>
            <span style={{ fontSize: '13px', color: '#666' }}>{chats.total} chats</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="sp-btn sp-btn-secondary sp-btn-sm">Previous</button>
              <button disabled={page * 25 >= chats.total} onClick={() => setPage(page + 1)} className="sp-btn sp-btn-secondary sp-btn-sm">Next</button>
            </div>
          </div>
        </>
      )}

      {tab === 'questions' && (loading ? <Loading /> : (
        <div className="sp-table-wrapper">
          <table className="sp-table">
            <thead><tr><th>Asked (IST)</th><th>Question the assistant did not understand</th><th></th></tr></thead>
            <tbody>
              {questions.length === 0 ? (
                <tr><td colSpan="3" style={{ textAlign: 'center', padding: '24px', color: '#999' }}>Nothing to answer in the last 30 days.</td></tr>
              ) : questions.map(q => (
                <tr key={q.id}>
                  <td>{formatDateTimeIST(q.at)}</td>
                  <td>{q.text}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {canTeach && <button className="sp-btn sp-btn-primary sp-btn-sm" onClick={() => setFaqQuestion(q.text)}>Add an answer</button>}
                      <button className="sp-btn sp-btn-outline sp-btn-sm" onClick={() => setOpenId(q.conversation_id)}>Open chat</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {openId && <TranscriptModal id={openId} onClose={() => setOpenId(null)} onAddFaq={canTeach ? (text) => { setOpenId(null); setFaqQuestion(text); } : null} />}
      {faqQuestion !== null && <AddFaqModal question={faqQuestion} onClose={() => setFaqQuestion(null)} onSaved={saved} />}
    </div>
  );
}
