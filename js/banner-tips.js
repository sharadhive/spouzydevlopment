(() => {
  const tip = document.querySelector('.hero-tip-copy');
  if (!tip) return;
  const tips = [
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
  ];
  const photos = document.querySelectorAll(".hero-tip-photos img");
  let deck = [];
  function rotate() {
    if (!deck.length) {
      deck = tips.slice();
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      const last = deck.length - 1;
      if (deck[last] === tip.textContent) {
        [deck[0], deck[last]] = [deck[last], deck[0]];
      }
    }
    tip.textContent = deck.pop();
    const current = tips.indexOf(tip.textContent);
    photos.forEach((photo, index) => { photo.hidden = index !== current; });
    if (tip.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      tip.animate([{opacity: 0}, {opacity: 1}], {duration: 650, easing: 'ease-out'});
    }
  }
  rotate();
  setInterval(() => { if (!document.hidden) rotate(); }, 7000);
})();
