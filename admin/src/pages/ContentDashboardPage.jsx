import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import HelpBox from '../components/HelpBox';

export default function ContentDashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const abortControllerRef = useRef(null);

  useEffect(() => {
    loadContentSummary();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  async function loadContentSummary() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError('');

    try {
      const res = await api.get('/admin/dashboard/content-summary', {
        signal: abortControllerRef.current.signal
      });
      if (res.success) {
        setSummary(res.data);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Failed to load content metrics');
      }
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#666' }}>
        <i className="fa fa-spinner fa-spin fa-2x"></i>
        <p style={{ marginTop: '12px' }}>Loading authorised content metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sp-card" style={{ borderLeft: '4px solid var(--sp-danger)', padding: '24px' }}>
        <h3 style={{ color: 'var(--sp-danger)', marginBottom: '8px' }}>
          <i className="fa fa-exclamation-circle"></i> Error Loading Content Hub
        </h3>
        <p style={{ color: '#555', marginBottom: '16px' }}>{error}</p>
        <button onClick={loadContentSummary} className="sp-btn sp-btn-secondary">
          <i className="fa fa-refresh"></i> Retry
        </button>
      </div>
    );
  }

  const hasAnyModules = summary && Object.keys(summary).length > 0;

  if (!hasAnyModules) {
    return (
      <div className="sp-card" style={{ textAlign: 'center', padding: '40px' }}>
        <i className="fa fa-info-circle fa-2x" style={{ color: '#888', marginBottom: '12px' }}></i>
        <h3 style={{ color: '#4B2030' }}>No Modules Assigned</h3>
        <p style={{ color: '#666', marginTop: '8px' }}>
          Your account currently does not have any content modules granted. Please contact an administrator.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header welcome */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#4B2030', marginBottom: '4px' }}>
          Content &amp; Public Information Hub
        </h2>
        <p style={{ color: '#666', fontSize: '14px' }}>
          Welcome back, {user?.name || 'Content Editor'}. Here is your live content overview and publishing status.
        </p>
      </div>
      <HelpBox topic="contentHub" />

      {/* Metrics Grid */}
      <div className="sp-stats-grid" style={{ marginBottom: '32px' }}>
        {/* Homepage Sections */}
        {summary.homepageSections && (
          <div className="sp-stat-card">
            <div className="sp-stat-icon wine">
              <i className="fa fa-home"></i>
            </div>
            <div>
              <div className="sp-stat-value">{summary.homepageSections.total}</div>
              <div className="sp-stat-label">Homepage Sections</div>
            </div>
          </div>
        )}

        {/* Hero Banners */}
        {summary.heroBanners && (
          <div className="sp-stat-card">
            <div className="sp-stat-icon copper">
              <i className="fa fa-picture-o"></i>
            </div>
            <div>
              <div className="sp-stat-value">{summary.heroBanners.total}</div>
              <div className="sp-stat-label">
                Hero Banners ({summary.heroBanners.active} active &middot; {summary.heroBanners.drafts} drafts)
              </div>
            </div>
          </div>
        )}

        {/* Relationship Tips */}
        {summary.tips && (
          <div className="sp-stat-card">
            <div className="sp-stat-icon green">
              <i className="fa fa-lightbulb-o"></i>
            </div>
            <div>
              <div className="sp-stat-value">{summary.tips.total}</div>
              <div className="sp-stat-label">
                Relationship Tips ({summary.tips.active} active)
              </div>
            </div>
          </div>
        )}

        {/* Blog Articles */}
        {summary.blogs && (
          <div className="sp-stat-card">
            <div className="sp-stat-icon blue">
              <i className="fa fa-book"></i>
            </div>
            <div>
              <div className="sp-stat-value">{summary.blogs.total}</div>
              <div className="sp-stat-label">
                Blog Articles ({summary.blogs.published} published &middot; {summary.blogs.drafts} drafts)
              </div>
            </div>
          </div>
        )}

        {/* FAQs & Questions */}
        {summary.visitorQuestions && (
          <div className="sp-stat-card">
            <div className="sp-stat-icon wine">
              <i className="fa fa-question-circle"></i>
            </div>
            <div>
              <div className="sp-stat-value">{summary.visitorQuestions.pending}</div>
              <div className="sp-stat-label">
                Questions Pending ({summary.faqs?.total || 0} active FAQs)
              </div>
            </div>
          </div>
        )}

        {/* Stories Moderation */}
        {summary.visitorStories && (
          <div className="sp-stat-card">
            <div className="sp-stat-icon copper">
              <i className="fa fa-heart"></i>
            </div>
            <div>
              <div className="sp-stat-value">{summary.visitorStories.pending}</div>
              <div className="sp-stat-label">
                Stories to Review ({summary.visitorStories.total} total)
              </div>
            </div>
          </div>
        )}

        {/* Public Media */}
        {summary.publicMedia && (
          <div className="sp-stat-card">
            <div className="sp-stat-icon green">
              <i className="fa fa-camera"></i>
            </div>
            <div>
              <div className="sp-stat-value">{summary.publicMedia.total}</div>
              <div className="sp-stat-label">Public Media Assets</div>
            </div>
          </div>
        )}

        {/* Social Links */}
        {summary.socialLinks && (
          <div className="sp-stat-card">
            <div className="sp-stat-icon blue">
              <i className="fa fa-share-alt"></i>
            </div>
            <div>
              <div className="sp-stat-value">{summary.socialLinks.total}</div>
              <div className="sp-stat-label">Configured Social Links</div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Launchpad & Workflows */}
      <div className="sp-card">
        <div className="sp-card-header">
          <h3 className="sp-card-title">
            <i className="fa fa-bolt" style={{ marginRight: '8px' }}></i> Content Management Launchpad
          </h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', padding: '16px' }}>
          <Link to="/content?tab=banners" className="sp-btn sp-btn-secondary" style={{ padding: '16px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '15px', color: '#4B2030' }}>
              <i className="fa fa-picture-o"></i> Hero Banners
            </span>
            <small style={{ color: '#666' }}>Homepage slides: upload photos, edit headlines, pills and buttons</small>
          </Link>

          <Link to="/content?tab=sections" className="sp-btn sp-btn-secondary" style={{ padding: '16px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '15px', color: '#4B2030' }}>
              <i className="fa fa-home"></i> Homepage Titles &amp; Tips
            </span>
            <small style={{ color: '#666' }}>Section titles and subtitles, plus the rotating relationship tips</small>
          </Link>

          <Link to="/content?tab=blogs" className="sp-btn sp-btn-secondary" style={{ padding: '16px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '15px', color: '#4B2030' }}>
              <i className="fa fa-book"></i> Blog Articles &amp; Categories
            </span>
            <small style={{ color: '#666' }}>Write, publish or unpublish articles on the Blog page</small>
          </Link>

          <Link to="/content?tab=faqs" className="sp-btn sp-btn-secondary" style={{ padding: '16px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '15px', color: '#4B2030' }}>
              <i className="fa fa-comments-o"></i> FAQs &amp; Moderation
            </span>
            <small style={{ color: '#666' }}>Answer submitted visitor questions and approve client stories</small>
          </Link>

          <Link to="/content?tab=social" className="sp-btn sp-btn-secondary" style={{ padding: '16px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '15px', color: '#4B2030' }}>
              <i className="fa fa-share-alt"></i> Footer Social Links
            </span>
            <small style={{ color: '#666' }}>Manage official Facebook, LinkedIn, X, and Instagram profile URLs</small>
          </Link>
        </div>
      </div>
    </div>
  );
}
