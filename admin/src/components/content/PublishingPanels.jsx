import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Modal from '../Modal';
import { formatDateTimeIST } from '../../constants/statuses';
import { errorText, ImageField, Toggle, FormActions, Thumb } from './common';
import { useList, Loading } from './HomepagePanels';

/* ------------------------------------------------------------------ */
/* Blog articles (shown on blog.htm)                                    */
/* ------------------------------------------------------------------ */
const EMPTY_BLOG = { title: '', excerpt: '', body_html: '', category_id: '', cover_image: '', banner_image: '', thumbnail_image: '', show_in_banner: true, alt_text: '', author_name: 'Problem Solver Group (PSG)', is_published: false };

export function BlogsPanel({ onMessage, registerAdd }) {
  const { user } = useAuth();
  const canEdit = user?.can('blogs:edit');
  const canDelete = user?.can('blogs:delete');
  const { rows, loading, error, reload } = useList('/admin/blogs?limit=100', (d) => d.articles);
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(null);
  const [newCategory, setNewCategory] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadCategories() {
    try {
      const res = await api.get('/admin/blog-categories');
      setCategories(res.data || []);
    } catch (e) {
      setCategories([]);
    }
  }
  useEffect(() => { loadCategories(); }, []);

  useEffect(() => {
    if (registerAdd) registerAdd(canEdit ? () => setEditing({ ...EMPTY_BLOG }) : null);
  }, [registerAdd, canEdit]);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        title: editing.title, excerpt: editing.excerpt, body_html: editing.body_html,
        category_id: editing.category_id || null, cover_image: editing.cover_image || null,
        banner_image: editing.banner_image || null, thumbnail_image: editing.thumbnail_image || null, show_in_banner: editing.show_in_banner !== false,
        alt_text: editing.alt_text || null, author_name: editing.author_name || null, is_published: !!editing.is_published
      };
      if (editing.id) await api.put(`/admin/blogs/${editing.id}`, body);
      else await api.post('/admin/blogs', body);
      onMessage(editing.is_published ? 'Article saved and published on the Blog page' : 'Article saved as draft');
      setEditing(null);
      reload();
    } catch (err) {
      onMessage(errorText(err), true);
    } finally {
      setSaving(false);
    }
  }

  async function remove(a) {
    if (!window.confirm(`Delete "${a.title}"?`)) return;
    try {
      await api.delete(`/admin/blogs/${a.id}`);
      onMessage('Article deleted');
      reload();
    } catch (err) {
      onMessage(errorText(err), true);
    }
  }

  async function addCategory() {
    if (!newCategory.trim()) return;
    try {
      const res = await api.post('/admin/blog-categories', { name: newCategory.trim() });
      setNewCategory('');
      await loadCategories();
      if (editing) setEditing({ ...editing, category_id: res.data.id });
    } catch (err) {
      onMessage(errorText(err), true);
    }
  }

  if (loading) return <Loading />;
  if (error) return <div className="sp-inline-alert error">{error}</div>;

  return (
    <div>
      <p style={{ marginTop: 0, fontSize: '13px', color: '#666' }}>Published articles appear on the website's Blog page as picture cards, each with its own page (<code>blog.htm?article=…</code>). Articles with a 16:9 banner also slide in the banner at the top of the Blog page.</p>
      <div className="sp-table-wrapper">
        <table className="sp-table">
          <thead><tr><th style={{ width: '110px' }}>Picture</th><th>Title</th><th>Category</th><th>Status</th><th>Published</th><th>Views</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: '20px', color: '#999' }}>No articles yet.</td></tr>
            ) : rows.map(a => (
              <tr key={a.id}>
                <td>
                  {(a.thumbnail_image || a.banner_image || a.cover_image)
                    ? <Thumb src={a.thumbnail_image || a.banner_image || a.cover_image} width={96} height={54} />
                    : <span className="sp-blog-nopic">No picture</span>}
                </td>
                <td>
                  <strong>{a.title}</strong><div><small style={{ color: '#888' }}>{a.slug}</small></div>
                  {a.banner_image && a.show_in_banner !== false && <span className="sp-blog-chip">In sliding banner</span>}
                  {!a.thumbnail_image && !a.banner_image && <span className="sp-blog-chip is-warn">Add a thumbnail</span>}
                </td>
                <td>{a.category?.name || '—'}</td>
                <td><span className={`sp-badge ${a.is_published ? 'published' : 'closed'}`}>{a.is_published ? 'Published' : 'Draft'}</span></td>
                <td>{a.is_published && a.published_at ? formatDateTimeIST(a.published_at) : '—'}</td>
                <td>{a.view_count || 0}</td>
                <td>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {a.is_published && <a className="sp-btn sp-btn-outline sp-btn-sm" href={`/blog.htm?article=${encodeURIComponent(a.slug)}`} target="_blank" rel="noreferrer">View</a>}
                    {canEdit && <button className="sp-btn sp-btn-secondary sp-btn-sm" onClick={() => setEditing({ ...EMPTY_BLOG, ...a, category_id: a.category_id || '' })}>Edit</button>}
                    {canDelete && <button className="sp-btn sp-btn-outline sp-btn-sm" onClick={() => remove(a)}>Delete</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal isOpen onClose={() => setEditing(null)} title={editing.id ? 'Edit article' : 'New article'} maxWidth="820px">
          <form onSubmit={save}>
            <div className="sp-form-group">
              <label className="sp-form-label">Title *</label>
              <input className="sp-input" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} required />
            </div>
            <div className="sp-form-group">
              <label className="sp-form-label">Short summary (shown in the list) *</label>
              <textarea className="sp-textarea" rows="2" value={editing.excerpt} onChange={(e) => setEditing({ ...editing, excerpt: e.target.value })} required />
            </div>
            <div className="sp-form-group">
              <label className="sp-form-label">Article body *</label>
              <textarea className="sp-textarea" rows="12" style={{ fontFamily: 'monospace', fontSize: '13px' }} value={editing.body_html} onChange={(e) => setEditing({ ...editing, body_html: e.target.value })} required />
              <small style={{ color: '#777' }}>Simple HTML: &lt;p&gt;paragraph&lt;/p&gt;, &lt;h2&gt;heading&lt;/h2&gt;, &lt;ul&gt;&lt;li&gt;point&lt;/li&gt;&lt;/ul&gt;, &lt;strong&gt;bold&lt;/strong&gt;.</small>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="sp-form-group">
                <label className="sp-form-label">Category</label>
                <select className="sp-select" value={editing.category_id || ''} onChange={(e) => setEditing({ ...editing, category_id: e.target.value })}>
                  <option value="">No category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                  <input className="sp-input" placeholder="New category" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
                  <button type="button" className="sp-btn sp-btn-outline sp-btn-sm" onClick={addCategory}>Add</button>
                </div>
              </div>
              <div className="sp-form-group">
                <label className="sp-form-label">Author</label>
                <input className="sp-input" value={editing.author_name || ''} onChange={(e) => setEditing({ ...editing, author_name: e.target.value })} />
              </div>
            </div>
            <fieldset className="sp-blog-pics">
              <legend>Pictures</legend>
              <div className="sp-blog-pics-grid">
                <ImageField label="Banner (16:9)" spec="blogBanner" value={editing.banner_image} onChange={(v) => setEditing({ ...editing, banner_image: v })}
                  hint="Top of the article page, and in the sliding banner on the Blog page." />
                <ImageField label="Thumbnail (16:9)" spec="blogThumb" value={editing.thumbnail_image} onChange={(v) => setEditing({ ...editing, thumbnail_image: v })}
                  hint="The article card on the Blog list. Leave empty to use the banner." />
              </div>
              <Toggle label="Show this article in the sliding banner on the Blog page" checked={editing.show_in_banner !== false} onChange={(v) => setEditing({ ...editing, show_in_banner: v })} />
              {editing.show_in_banner !== false && !editing.banner_image && <small style={{ color: '#9a4b00', display: 'block', marginTop: '4px' }}>Add a banner picture so the article can appear in the sliding banner.</small>}
              <ImageField label="Picture inside the article (optional, as before)" spec="blogCover" value={editing.cover_image} onChange={(v) => setEditing({ ...editing, cover_image: v })} />
              <div className="sp-form-group">
                <label className="sp-form-label">Picture description (alt text, used for all pictures of this article)</label>
                <input className="sp-input" value={editing.alt_text || ''} onChange={(e) => setEditing({ ...editing, alt_text: e.target.value })} placeholder="e.g. A couple talking at a table" />
              </div>
            </fieldset>
            <Toggle label="Published (visible on the website)" checked={editing.is_published} onChange={(v) => setEditing({ ...editing, is_published: v })} />
            <FormActions onCancel={() => setEditing(null)} saving={saving} />
          </form>
        </Modal>
      )}
    </div>
  );
}

// FAQs: see FaqManager.jsx · Client stories: see StoriesManager.jsx
