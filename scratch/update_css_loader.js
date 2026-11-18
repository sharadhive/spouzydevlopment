const fs = require('fs');
let css = fs.readFileSync('css/spouzy-modern.css', 'utf8');
const start = css.indexOf('/* --------------------------------------------------------------------------\n   12. SPOUZY TEDDY HUG ANIMATED LOADER');
const end = css.indexOf('/* ==========================================================================\n   12. DEDICATED APPOINTMENT SCHEDULER');

if (start === -1 || end === -1) {
  console.error('Indices not found!', { start, end });
  process.exit(1);
}

const replacement = `/* --------------------------------------------------------------------------
   SPOUZY FLOATING CURRENT-PAGE TEDDY TRANSITION (NO SCREEN, NO CARD, NO LOGO)
   -------------------------------------------------------------------------- */
.sp-transition-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent !important; /* Current page remains 100% visible */
  z-index: 999999;
  pointer-events: auto; /* Block competing clicks during transition */
  user-select: none;
  -webkit-user-select: none;
  overflow: hidden;
}

/* Floating animation stage */
.sp-transition-stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: min(85vw, 420px);
  max-width: 420px;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  outline: none !important;
  opacity: 0;
  transition: opacity 120ms ease-out;
  pointer-events: none;
}

.sp-transition-stage.is-visible {
  opacity: 1 !important;
}

/* Transparent WebM video: full teddy visibility with feet preserved */
.sp-transition-video {
  width: 100%;
  height: auto;
  aspect-ratio: 16 / 9;
  object-fit: contain;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  outline: none !important;
  display: block;
  pointer-events: none;
  filter: drop-shadow(0 10px 28px rgba(72, 30, 40, 0.14));
}

@media (max-width: 767px) {
  .sp-transition-stage {
    width: min(88vw, 340px);
    max-width: 340px;
  }
}

/* Reduced motion preference */
@media (prefers-reduced-motion: reduce) {
  .sp-transition-overlay {
    display: none !important;
  }
}


`;

css = css.slice(0, start) + replacement + css.slice(end);
fs.writeFileSync('css/spouzy-modern.css', css, 'utf8');
console.log('Successfully updated Section 12 in css/spouzy-modern.css');
