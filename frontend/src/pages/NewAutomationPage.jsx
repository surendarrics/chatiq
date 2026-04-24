import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { instagramApi, automationsApi } from '../utils/api';
import toast from 'react-hot-toast';

const STEPS = ['Select Account', 'Pick Post', 'Set Trigger', 'Configure Actions', 'Review'];

export default function NewAutomationPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [accounts, setAccounts] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    instagram_account_id: '',
    post_id: '',
    post_url: '',
    post_thumbnail: '',
    post_caption: '',
    name: '',
    keywords: [''],
    match_all_comments: false,
    reply_text: 'Thanks! Check your DMs 👀',
    dm_text: '',
    require_follow: false,
    follow_gate_message: '🔔 The Workflow is exclusively for Followers. Follow to gain access to the AI tool! 🔔',
    follow_button_label: 'Following',
  });

  useEffect(() => {
    instagramApi.getAccounts()
      .then(res => setAccounts(res.data.accounts || []))
      .catch(() => toast.error('Failed to load accounts'));
  }, []);

  const selectedAccount = accounts.find(a => a.id === form.instagram_account_id);

  const handleSelectAccount = async (accountId) => {
    setForm(f => ({ ...f, instagram_account_id: accountId, post_id: '', post_thumbnail: '', post_url: '' }));
    setPosts([]);
    setLoadingPosts(true);
    try {
      const res = await instagramApi.getPosts(accountId, 24);
      setPosts(res.data.data || []);
    } catch {
      toast.error('Failed to load posts');
    } finally {
      setLoadingPosts(false);
    }
  };

  const handleSelectPost = (post) => {
    setForm(f => ({
      ...f,
      post_id: post.id,
      post_url: post.permalink,
      post_thumbnail: post.media_url || post.thumbnail_url || '',
      post_caption: post.caption || '',
      name: `Auto-reply: ${(post.caption || '').slice(0, 40) || post.id}`,
    }));
  };

  const addKeyword = () => setForm(f => ({ ...f, keywords: [...f.keywords, ''] }));
  const removeKeyword = (i) => setForm(f => ({ ...f, keywords: f.keywords.filter((_, idx) => idx !== i) }));
  const updateKeyword = (i, val) => setForm(f => ({
    ...f, keywords: f.keywords.map((k, idx) => idx === i ? val : k),
  }));

  const canNext = () => {
    if (step === 0) return !!form.instagram_account_id;
    if (step === 1) return !!form.post_id;
    if (step === 2) return form.match_all_comments || form.keywords.some(k => k.trim());
    if (step === 3) return !!(form.reply_text.trim() || form.dm_text.trim());
    return true;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        keywords: form.keywords.filter(k => k.trim()),
      };
      await automationsApi.create(payload);
      toast.success('Automation created! 🎉');
      navigate('/automations');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create automation');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', animation: 'fadeUp 0.4s ease both' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <button onClick={() => navigate('/automations')} style={backBtn}>
          ← Back to Automations
        </button>
        <h1 style={{ fontSize: 'clamp(26px, 5vw, 32px)', fontWeight: 800, marginTop: 12, marginBottom: 4, color: '#fff', letterSpacing: '-0.03em' }}>
          New Automation
        </h1>
        <p style={{ color: '#a0a0a0', fontSize: 14 }}>
          Set up keyword-triggered comment replies and DMs in minutes.
        </p>
      </div>

      {/* Stepper */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 32, position: 'relative' }}>
        {STEPS.map((s, i) => (
          <React.Fragment key={s}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: '0 0 auto' }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
                background: i <= step ? '#fff' : 'transparent',
                border: `1px solid ${i <= step ? '#fff' : '#2a2a2a'}`,
                color: i <= step ? '#000' : '#555',
                transition: 'all 0.3s',
              }}>
                {i < step ? '✓' : i + 1}
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{
                flex: 1, height: 1, marginTop: 15,
                background: i < step ? '#fff' : '#1a1a1a',
                transition: 'background 0.3s',
              }} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step Content */}
      <div style={{
        background: '#0a0a0a', border: '1px solid #1a1a1a',
        borderRadius: 14, padding: 'clamp(20px, 5vw, 32px)', marginBottom: 20,
      }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
          {STEPS[step]}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 28 }}>
          {STEP_HINTS[step]}
        </p>

        {step === 0 && (
          <AccountStep accounts={accounts} selected={form.instagram_account_id} onSelect={handleSelectAccount} />
        )}
        {step === 1 && (
          <PostStep posts={posts} selected={form.post_id} onSelect={handleSelectPost} loading={loadingPosts} />
        )}
        {step === 2 && (
          <TriggerStep form={form} setForm={setForm} addKeyword={addKeyword} removeKeyword={removeKeyword} updateKeyword={updateKeyword} />
        )}
        {step === 3 && (
          <ActionsStep form={form} setForm={setForm} />
        )}
        {step === 4 && (
          <ReviewStep form={form} account={selectedAccount} />
        )}
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button
          onClick={() => setStep(s => s - 1)}
          disabled={step === 0}
          style={{
            ...ghostBtn,
            opacity: step === 0 ? 0.4 : 1,
            cursor: step === 0 ? 'default' : 'pointer',
          }}
        >
          ← Previous
        </button>

        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep(s => s + 1)}
            disabled={!canNext()}
            style={{
              ...primaryBtn,
              opacity: canNext() ? 1 : 0.4,
              cursor: canNext() ? 'pointer' : 'default',
            }}
          >
            Continue →
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{ ...primaryBtn, minWidth: 160, justifyContent: 'center' }}
          >
            {submitting ? 'Creating…' : '🚀 Create Automation'}
          </button>
        )}
      </div>
    </div>
  );
}

function AccountStep({ accounts, selected, onSelect }) {
  if (accounts.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>📷</div>
        <p>No Instagram accounts connected.</p>
        <a href="/connect" style={{ color: 'var(--accent)', fontSize: 14 }}>Connect an account →</a>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {accounts.map(acc => (
        <button
          key={acc.id}
          onClick={() => onSelect(acc.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 16,
            padding: '16px 20px', borderRadius: 'var(--radius)',
            background: selected === acc.id ? '#1a1a1a' : '#0a0a0a',
            border: `1px solid ${selected === acc.id ? 'var(--accent)' : 'var(--border)'}`,
            cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
          }}
        >
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: '#0a0a0a', border: '1px solid #1a1a1a',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, flexShrink: 0, overflow: 'hidden', color: '#fff',
          }}>
            {acc.profile_picture_url
              ? <img src={acc.profile_picture_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : '📷'}
          </div>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>
              @{acc.username || acc.page_name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {acc.followers_count?.toLocaleString() || '—'} followers · {acc.page_name}
            </div>
          </div>
          {selected === acc.id && (
            <div style={{ marginLeft: 'auto', color: 'var(--accent)', fontSize: 20 }}>✓</div>
          )}
        </button>
      ))}
    </div>
  );
}

function PostStep({ posts, selected, onSelect, loading }) {
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          border: '3px solid var(--bg-elevated)', borderTop: '3px solid var(--accent)',
          animation: 'spin 0.8s linear infinite',
        }} />
      </div>
    );
  }

  if (posts.length === 0) {
    return <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>No posts found for this account.</p>;
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
      {posts.map(post => (
        <button
          key={post.id}
          onClick={() => onSelect(post)}
          style={{
            position: 'relative', aspectRatio: '1', borderRadius: 10,
            overflow: 'hidden', border: `2px solid ${selected === post.id ? 'var(--accent)' : 'var(--border)'}`,
            cursor: 'pointer', background: 'var(--bg-elevated)', transition: 'border-color 0.15s',
          }}
        >
          {(() => {
            const isVideo = post.media_type === 'VIDEO';
            const imgSrc = isVideo
              ? (post.thumbnail_url || post.media_url)
              : (post.media_url || post.thumbnail_url);
            return imgSrc ? (
            <img
              src={imgSrc}
              alt={post.caption || ''}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling && (e.target.nextSibling.style.display = 'flex'); }}
            />
            ) : null;
          })()}
          <div style={{ display: 'none', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 32 }}>
            {post.media_type === 'VIDEO' ? '🎬' : '📷'}
          </div>
          {selected === post.id && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, color: '#fff', fontWeight: 700,
            }}>✓</div>
          )}
          {post.media_type === 'VIDEO' && (
            <div style={{
              position: 'absolute', top: 4, left: 4,
              background: 'rgba(0,0,0,0.6)', borderRadius: 6,
              fontSize: 10, padding: '2px 6px', color: '#fff',
            }}>
              {post.media_product_type === 'REELS' ? '🎬 Reel' : '📹 Video'}
            </div>
          )}
          {post.media_type === 'CAROUSEL_ALBUM' && (
            <div style={{
              position: 'absolute', top: 4, left: 4,
              background: 'rgba(0,0,0,0.6)', borderRadius: 6,
              fontSize: 10, padding: '2px 6px', color: '#fff',
            }}>
              📸 Carousel
            </div>
          )}
          {post.comments_count > 0 && (
            <div style={{
              position: 'absolute', bottom: 4, right: 4,
              background: 'rgba(0,0,0,0.6)', borderRadius: 6,
              fontSize: 10, padding: '2px 6px', color: '#fff',
            }}>
              💬 {post.comments_count}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

function TriggerStep({ form, setForm, addKeyword, removeKeyword, updateKeyword }) {
  return (
    <div>
      <label style={labelStyle}>
        <input
          type="checkbox"
          checked={form.match_all_comments}
          onChange={e => setForm(f => ({ ...f, match_all_comments: e.target.checked }))}
          style={{ width: 'auto', marginRight: 10, accentColor: 'var(--accent)' }}
        />
        Trigger on ALL comments (ignore keywords)
      </label>

      {!form.match_all_comments && (
        <div style={{ marginTop: 24 }}>
          <div style={{ ...labelStyle, marginBottom: 12 }}>
            Trigger Keywords
            <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8, fontSize: 12 }}>
              (comment must contain at least one)
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {form.keywords.map((kw, i) => (
              <div key={i} style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={kw}
                  onChange={e => updateKeyword(i, e.target.value)}
                  placeholder={`e.g. "${['link', 'price', 'info', 'send me', 'details'][i % 5]}"`}
                  style={{ flex: 1 }}
                />
                <button
                  onClick={() => removeKeyword(i)}
                  disabled={form.keywords.length === 1}
                  style={{
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    color: 'var(--danger)', borderRadius: 8, padding: '0 14px',
                    cursor: form.keywords.length === 1 ? 'default' : 'pointer',
                    opacity: form.keywords.length === 1 ? 0.3 : 1,
                    fontSize: 16,
                  }}
                >×</button>
              </div>
            ))}
          </div>
          <button onClick={addKeyword} style={{ ...ghostBtn, marginTop: 12, fontSize: 13 }}>
            + Add keyword
          </button>
          <p style={{ marginTop: 16, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            💡 Tip: Use words your audience commonly comments. e.g. "send", "link", "price", "how to"
          </p>
        </div>
      )}
    </div>
  );
}

function ActionsStep({ form, setForm }) {
  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Automation name */}
      <div>
        <label style={{ ...labelStyle, display: 'block', marginBottom: 8 }}>Automation Name</label>
        <input type="text" value={form.name} onChange={set('name')} placeholder="e.g. Summer Sale DM Campaign" />
      </div>

      {/* Comment reply */}
      <div style={{
        background: 'var(--bg-elevated)', borderRadius: 'var(--radius)',
        border: '1px solid var(--border)', padding: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 20 }}>💬</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Comment Reply</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Publicly reply to the comment</div>
          </div>
        </div>
        <textarea
          value={form.reply_text}
          onChange={set('reply_text')}
          placeholder="e.g. Hey! I've sent you the details in your DMs 👀"
          rows={3}
          style={{ resize: 'vertical' }}
        />
        <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
          {form.reply_text.length}/2200 characters · Leave blank to skip comment reply
        </p>
      </div>

      {/* DM text */}
      <div style={{
        background: 'var(--bg-elevated)', borderRadius: 'var(--radius)',
        border: '1px solid var(--border)', padding: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 20 }}>📩</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Direct Message</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Private DM to the commenter</div>
          </div>
        </div>
        <textarea
          value={form.dm_text}
          onChange={set('dm_text')}
          placeholder="e.g. Hey! Here's the link you asked for: https://yourlink.com 🎉"
          rows={4}
          style={{ resize: 'vertical' }}
        />
        <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
          {form.dm_text.length}/1000 characters · Leave blank to skip DM · User must have DMs open
        </p>
      </div>

      {/* Follow gate */}
      <div style={{
        background: '#0a0a0a', borderRadius: 12,
        border: '1px solid #1a1a1a', padding: 20,
      }}>
        <label style={{
          display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer',
        }}>
          <input
            type="checkbox"
            checked={!!form.require_follow}
            onChange={e => setForm(f => ({ ...f, require_follow: e.target.checked }))}
            style={{ width: 18, height: 18, marginTop: 2, accentColor: '#fff', flexShrink: 0 }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 15, color: '#fff' }}>
              Require follow before sending the link
            </div>
            <div style={{ fontSize: 12, color: '#a0a0a0', marginTop: 4, lineHeight: 1.5 }}>
              If the commenter doesn't follow you yet, send a gate message with a "Following" button.
              When they tap it, ChatIQ rechecks via the Instagram API and only sends the link if they're now a follower.
            </div>
          </div>
        </label>

        {form.require_follow && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ ...labelStyle, display: 'block', marginBottom: 6 }}>
                Gate message (sent if not yet following)
              </label>
              <textarea
                value={form.follow_gate_message}
                onChange={set('follow_gate_message')}
                rows={3}
                style={{ resize: 'vertical' }}
              />
            </div>
            <div>
              <label style={{ ...labelStyle, display: 'block', marginBottom: 6 }}>
                Button label
              </label>
              <input
                type="text"
                value={form.follow_button_label}
                onChange={set('follow_button_label')}
                placeholder="Following"
                maxLength={20}
              />
              <p style={{ marginTop: 6, fontSize: 11, color: '#555' }}>
                Max 20 characters (Instagram quick-reply limit).
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewStep({ form, account }) {
  const keywords = form.keywords.filter(k => k.trim());
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <ReviewRow label="Account" value={account ? `@${account.username || account.page_name}` : '—'} />
      <ReviewRow label="Post ID" value={form.post_id || '—'} />
      <ReviewRow label="Automation Name" value={form.name || '—'} />
      <ReviewRow
        label="Triggers"
        value={form.match_all_comments ? 'All comments' : keywords.join(', ') || '—'}
      />
      <ReviewRow label="Comment Reply" value={form.reply_text || '(none)'} />
      <ReviewRow label="DM Message" value={form.dm_text || '(none)'} />
      <ReviewRow
        label="Follow Gate"
        value={form.require_follow
          ? `On — "${form.follow_button_label || 'Following'}" button`
          : 'Off'}
      />

      <div style={{
        marginTop: 8, padding: 16, borderRadius: 'var(--radius-sm)',
        background: 'rgba(34,211,165,0.06)', border: '1px solid rgba(34,211,165,0.2)',
        fontSize: 13, color: 'var(--success)',
      }}>
        ✓ Your automation will be active immediately after creation. Comments on the selected post will be monitored via Meta webhooks in real-time.
      </div>
    </div>
  );
}

function ReviewRow({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 140, flexShrink: 0, fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1, wordBreak: 'break-word' }}>{value}</div>
    </div>
  );
}

const STEP_HINTS = [
  'Choose which Instagram Business account to use for this automation.',
  'Select a post to monitor. ChatIQ will watch for comments on this post.',
  'Define what words trigger the automation when found in a comment.',
  'Set up what happens when the trigger fires — a comment reply and/or a DM.',
  'Review your automation before going live.',
];

const primaryBtn = {
  background: '#fff', color: '#000',
  border: 'none', padding: '12px 22px',
  borderRadius: 10, fontSize: 14, fontWeight: 600,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
  minHeight: 44,
};
const ghostBtn = {
  background: 'transparent', border: '1px solid #2a2a2a',
  color: '#fff', padding: '11px 18px',
  borderRadius: 10, fontSize: 14, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 8,
  minHeight: 44, transition: 'border-color 0.15s',
};
const backBtn = {
  background: 'none', border: 'none', color: 'var(--text-muted)',
  fontSize: 13, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 6,
};
const labelStyle = {
  display: 'flex', alignItems: 'center',
  fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
};
