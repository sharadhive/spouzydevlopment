import React, { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SectionsPanel, BannersPanel, TipsPanel } from '../components/content/HomepagePanels';
import { BlogsPanel } from '../components/content/PublishingPanels';
import { FaqsPanel } from '../components/content/FaqManager';
import { StoriesPanel } from '../components/content/StoriesManager';
import { SocialPanel, MediaPanel } from '../components/content/LibraryPanels';
import HelpBox from '../components/HelpBox';

const TABS = [
  { key: 'banners', label: 'Hero Banners', icon: 'fa-picture-o', perm: 'content:view', add: 'Add Banner' },
  { key: 'sections', label: 'Homepage Titles', icon: 'fa-header', perm: 'content:view' },
  { key: 'tips', label: 'Relationship Tips', icon: 'fa-lightbulb-o', perm: 'content:view', add: 'Add Tip' },
  { key: 'blogs', label: 'Blog', icon: 'fa-newspaper-o', perm: 'blogs:view', add: 'New Article' },
  { key: 'faqs', label: 'FAQs', icon: 'fa-question-circle', perm: 'moderation:view', add: 'Add question' },
  { key: 'stories', label: 'Client Stories', icon: 'fa-comments-o', perm: 'moderation:view', add: 'Add story' },
  { key: 'media', label: 'Media Library', icon: 'fa-image', perm: 'media:view' },
  { key: 'social', label: 'Social Links', icon: 'fa-share-alt', perm: ['settings:content', 'content:view'] }
];

export default function ContentPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const allowed = TABS.filter(t => (Array.isArray(t.perm) ? t.perm : [t.perm]).some(p => user?.can(p)));
  const requested = searchParams.get('tab');
  const tab = allowed.find(t => t.key === requested) ? requested : (allowed[0]?.key || '');
  const current = allowed.find(t => t.key === tab);

  const [feedback, setFeedback] = useState('');
  const [pageError, setPageError] = useState('');
  const [addHandler, setAddHandler] = useState(null);

  const showMessage = useCallback((msg, isErr = false) => {
    if (isErr) {
      setPageError(msg);
      setTimeout(() => setPageError(''), 7000);
    } else {
      setFeedback(msg);
      setTimeout(() => setFeedback(''), 5000);
    }
  }, []);

  // Panels register their "add" action so the button can sit in the card header
  const registerAdd = useCallback((fn) => setAddHandler(() => fn), []);

  function selectTab(key) {
    setAddHandler(null);
    setSearchParams({ tab: key });
  }

  if (!allowed.length) {
    return <div className="sp-card"><p>You do not have access to any content sections.</p></div>;
  }

  const panelProps = { onMessage: showMessage, registerAdd };

  return (
    <div className="sp-card">
      <div className="sp-card-header">
        <h2 className="sp-card-title"><i className="fa fa-newspaper-o" style={{ marginRight: '8px' }}></i> Website Content</h2>
        {current?.add && addHandler && (
          <button type="button" className="sp-btn sp-btn-primary sp-btn-sm" onClick={() => addHandler()}>
            <i className="fa fa-plus"></i> {current.add}
          </button>
        )}
      </div>

      {feedback && <div className="sp-inline-alert success"><i className="fa fa-check-circle"></i> {feedback}</div>}
      {pageError && <div className="sp-inline-alert error"><i className="fa fa-exclamation-circle"></i> {pageError}</div>}

      <div className="sp-tabs" style={{ flexWrap: 'wrap' }}>
        {allowed.map(t => (
          <button key={t.key} type="button" className={`sp-tab-btn ${tab === t.key ? 'active' : ''}`} onClick={() => selectTab(t.key)}>
            <i className={`fa ${t.icon}`}></i> {t.label}
          </button>
        ))}
      </div>
      {tab && <HelpBox key={`help-${tab}`} topic={`content.${tab}`} />}

      {tab === 'banners' && <BannersPanel key="banners" {...panelProps} />}
      {tab === 'sections' && <SectionsPanel key="sections" {...panelProps} />}
      {tab === 'tips' && <TipsPanel key="tips" {...panelProps} />}
      {tab === 'blogs' && <BlogsPanel key="blogs" {...panelProps} />}
      {tab === 'faqs' && <FaqsPanel key="faqs" {...panelProps} />}
      {tab === 'stories' && <StoriesPanel key="stories" {...panelProps} />}
      {tab === 'media' && <MediaPanel key="media" {...panelProps} />}
      {tab === 'social' && <SocialPanel key="social" {...panelProps} />}
    </div>
  );
}
