/**
 * Preview helpers that mirror the server (backend/src/services/faq.service.js and story.service.js).
 * Only for showing a preview in the admin: the server always makes the final, cleaned version.
 */
function esc(t) {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function safeHref(u) {
  const v = String(u || '').trim();
  if (/^(https?:\/\/|mailto:|tel:)/i.test(v)) return v;
  if (/^[a-z0-9][a-z0-9_\-/]*\.html?(#[\w-]*)?(\?[\w=&%-]*)?$/i.test(v)) return v;
  if (/^www\./i.test(v)) return 'https://' + v;
  return null;
}

function inline(text) {
  let out = '';
  let rest = String(text);
  const re = /\[([^\]\n]{1,200})\]\(([^)\s]{1,500})\)/;
  let m;
  const plain = (s) => esc(s)
    .replace(/(^|[\s(])((?:https?:\/\/|www\.)[^\s<]+[^\s<.,;:!?)'"])/gi, (all, pre, url) => (safeHref(url) ? `${pre}<a href="${esc(safeHref(url))}">${url}</a>` : all))
    .replace(/\*\*([^*\n]{1,300})\*\*/g, '<strong>$1</strong>');
  while ((m = re.exec(rest))) {
    out += plain(rest.slice(0, m.index));
    const href = safeHref(m[2]);
    out += href ? `<a href="${esc(href)}">${esc(m[1])}</a>` : esc(m[0]);
    rest = rest.slice(m.index + m[0].length);
  }
  return out + plain(rest);
}

export function textToHtmlPreview(text) {
  const t = String(text || '').replace(/\r\n?/g, '\n').trim();
  if (!t) return '';
  const out = [];
  t.split(/\n\s*\n+/).forEach(block => {
    let para = [];
    let list = null;
    const flushPara = () => { if (para.length) { out.push('<p>' + para.map(inline).join('<br>') + '</p>'); para = []; } };
    const flushList = () => { if (list) { out.push(`<${list.type}>` + list.items.map(i => `<li>${inline(i)}</li>`).join('') + `</${list.type}>`); list = null; } };
    block.split('\n').map(l => l.trim()).filter(Boolean).forEach(line => {
      const bullet = line.match(/^(?:[-•*·▪●]|✓|✔)\s+(.+)$/);
      const numbered = line.match(/^\d{1,2}[.)]\s+(.+)$/);
      if (bullet || numbered) {
        const type = bullet ? 'ul' : 'ol';
        flushPara();
        if (list && list.type !== type) flushList();
        if (!list) list = { type, items: [] };
        list.items.push((bullet || numbered)[1]);
      } else {
        flushList();
        para.push(line);
      }
    });
    flushList();
    flushPara();
  });
  return out.join('');
}

function maskWord(word) {
  const m = word.match(/^([^\p{L}\p{N}]*)([\p{L}\p{N}\p{M}'’-]+)([^\p{L}\p{N}]*)$/u);
  if (!m) return word;
  const [, pre, core, post] = m;
  const chars = Array.from(core.replace(/[’']/g, ''));
  if (chars.length <= 1) return pre + core + post;
  if (chars.length === 2) return pre + chars[0] + '*' + post;
  return pre + chars[0] + '*'.repeat(Math.min(4, chars.length - 2)) + chars[chars.length - 1] + post;
}

/** "Rohit & Priya S." -> "R***t & P***a S." */
export function maskName(name) {
  const n = String(name || '').replace(/\s+/g, ' ').trim();
  if (!n) return '';
  return n.split(' ').map(w => (/^(&|and|aur|\+|\/|-)$/i.test(w) ? w : maskWord(w))).join(' ');
}

export function shownName(displayName, anonymous) {
  const d = String(displayName || '').trim();
  if (anonymous || !d || /^anonymous/i.test(d)) return /^anonymous/i.test(d) ? d : 'Anonymous';
  return maskName(d);
}

export const PAGE_SHORT = {
  'pre-marriage': 'Pre-Marriage',
  'post-marriage': 'Post-Marriage',
  relationships: 'Relationships',
  'intimate-health': 'Intimate Health',
  'intimate-aesthetics': 'Aesthetics',
  'divorce-mediation': 'Divorce',
  'harassment-support': 'Prevent Violence'
};
