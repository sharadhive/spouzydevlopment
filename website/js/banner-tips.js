/**
 * Homepage "Daily Tip For You" card.
 * Tips (text + photo) come from Admin → Content & Media → Relationship Tips.
 * A tip whose photo cannot be loaded uses one of the built-in photos instead,
 * so the card never shows a broken image. Without the server, the built-in tips are used.
 */
(() => {
  const tipEl = document.querySelector('.hero-tip-copy');
  const frame = document.querySelector('.hero-tip-photos');
  if (!tipEl) return;

  const builtInPhotos = frame ? Array.from(frame.querySelectorAll('img')) : [];
  let tips = [
    'Ask what felt good about today.',
    'Name one small thing you appreciated.',
    'Let your partner finish their thought.',
    'Ask before offering advice.',
    'Make time for a phone-free meal.',
    'Share one thing you need this week.',
    'Choose a calm moment for a hard conversation.',
    'Check what you heard before you reply.',
    'Take a short walk and talk together.',
    'Leave room for a different point of view.'
  ].map((text, i) => ({ text, photo: null, alt: '', fallback: i }));

  const brokenPhotos = new Set();
  const photoEls = new Map(); // photo address → <img> in the card

  function cleanPhoto(src) {
    const v = String(src || '').trim();
    if (!v || /^(javascript|data|vbscript):/i.test(v)) return null;
    if (/^https?:\/\//i.test(v) || v.startsWith('/')) return v;
    return v.replace(/^\.\//, '');
  }

  function samePhoto(img, src) {
    const a = img.getAttribute('src') || '';
    return a === src || a.replace(/^\//, '') === src.replace(/^\//, '');
  }

  // The <img> that shows a tip's photo: a built-in one with the same address, or a new one
  function imageFor(tip, index) {
    const src = tip.photo && !brokenPhotos.has(tip.photo) ? tip.photo : null;
    if (src) {
      const builtIn = builtInPhotos.find(img => samePhoto(img, src));
      if (builtIn) return builtIn;
      if (!photoEls.has(src) && frame) {
        const img = document.createElement('img');
        img.alt = tip.alt || '';
        img.hidden = true;
        img.decoding = 'async';
        img.addEventListener('error', () => {
          brokenPhotos.add(src);
          if (!img.hidden) showPhoto(tip, index); // swap to a built-in photo straight away
        });
        img.src = src;
        frame.appendChild(img);
        photoEls.set(src, img);
      }
      if (photoEls.has(src)) return photoEls.get(src);
    }
    return builtInPhotos.length ? builtInPhotos[(tip.fallback != null ? tip.fallback : index) % builtInPhotos.length] : null;
  }

  function showPhoto(tip, index) {
    if (!frame) return;
    const target = imageFor(tip, index);
    frame.querySelectorAll('img').forEach(img => { img.hidden = img !== target; });
  }

  let deck = [];
  let currentIndex = -1;
  function rotate() {
    if (!tips.length) return;
    if (!deck.length) {
      deck = tips.map((_, i) => i);
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      if (deck.length > 1 && deck[deck.length - 1] === currentIndex) {
        [deck[0], deck[deck.length - 1]] = [deck[deck.length - 1], deck[0]];
      }
    }
    currentIndex = deck.pop();
    const tip = tips[currentIndex];
    tipEl.textContent = tip.text;
    showPhoto(tip, currentIndex);
    if (tipEl.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      tipEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 650, easing: 'ease-out' });
    }
  }

  // Tips from the admin panel (only active ones are returned)
  fetch('/api/content/tips')
    .then(r => r.json())
    .then(res => {
      const list = res && res.success && Array.isArray(res.data) ? res.data : [];
      const fresh = list
        .filter(t => t && String(t.tip_text || '').trim())
        .map((t, i) => ({ text: String(t.tip_text).trim(), photo: cleanPhoto(t.photo_url), alt: t.alt_text || '', fallback: i }));
      if (fresh.length) {
        tips = fresh;
        deck = [];
        // Load the photos in the background; a missing one is noted before it is ever shown
        tips.forEach((t, i) => { if (t.photo) imageFor(t, i); });
        rotate();
      }
    })
    .catch(() => {});

  rotate();
  setInterval(() => { if (!document.hidden) rotate(); }, 7000);
})();
