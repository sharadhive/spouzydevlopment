(() => {
  'use strict';
  const all = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const one = sel => document.querySelector(sel);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = matchMedia('(hover:hover) and (pointer:fine)');
  const el = (tag, cls) => Object.assign(document.createElement(tag), {className:cls});
  const clamp = n => Math.min(1,Math.max(0,n));
  const track = one('.care-track');
  if (track) {
    const buttons = all('.care-slider button');
    const move = dir => track.scrollBy({left:dir*(track.children[1].offsetLeft-track.children[0].offsetLeft),behavior:reduced.matches?'instant':'smooth'});
    buttons.forEach((btn,i)=>btn.onclick=()=>move(i?1:-1));
    const limits=()=>{
      buttons[0].disabled=track.scrollLeft<2;
      buttons[1].disabled=track.scrollLeft+track.clientWidth>=track.scrollWidth-2;
    };
    track.addEventListener('scroll',limits,{passive:true});
    new ResizeObserver(limits).observe(track);
    track.onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();move(e.key==='ArrowLeft'?-1:1)}};
  }

  // Testimonial Carousel — Smooth Automatic Horizontal Slider
  const testiSection = one('[aria-label="Client Testimonials"]');
  if (testiSection) {
    const track = testiSection.querySelector('.sp-testimonials-track');
    const cards = all('.sp-testimonial-card', testiSection);
    const dots = all('.sp-testi-dot', testiSection);
    const prevBtn = testiSection.querySelector('.sp-testi-prev');
    const nextBtn = testiSection.querySelector('.sp-testi-next');
    const carousel = testiSection.querySelector('.sp-testimonials-carousel');

    if (track && cards.length > 0) {
      let current = 0;
      let timer = null;
      let isPaused = false;
      let isIntersecting = false;

      function goToSlide(index) {
        current = (index + cards.length) % cards.length;
        track.style.transform = 'translateX(-' + (current * 100) + '%)';
        cards.forEach((card, i) => {
          const isActive = i === current;
          card.classList.toggle('active', isActive);
          card.setAttribute('aria-hidden', String(!isActive));
        });
        dots.forEach((dot, i) => {
          const isActive = i === current;
          dot.classList.toggle('active', isActive);
          dot.setAttribute('aria-selected', String(isActive));
        });
      }

      function startAutoSlide() {
        stopAutoSlide();
        if (reduced.matches || document.hidden || isPaused || !isIntersecting) return;
        timer = setTimeout(() => {
          goToSlide(current + 1);
          startAutoSlide();
        }, 4500);
      }

      function stopAutoSlide() {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      }

      if (prevBtn) {
        prevBtn.onclick = () => {
          goToSlide(current - 1);
          startAutoSlide();
        };
      }

      if (nextBtn) {
        nextBtn.onclick = () => {
          goToSlide(current + 1);
          startAutoSlide();
        };
      }

      dots.forEach((dot, idx) => {
        dot.onclick = () => {
          goToSlide(idx);
          startAutoSlide();
        };
      });

      // Pause auto-sliding on hover
      if (carousel) {
        carousel.addEventListener('mouseenter', () => {
          isPaused = true;
          stopAutoSlide();
        });
        carousel.addEventListener('mouseleave', () => {
          isPaused = false;
          startAutoSlide();
        });

        // Touch Swipe Support for Mobile
        let touchStartX = 0;
        carousel.addEventListener('touchstart', e => {
          touchStartX = e.touches[0].clientX;
          isPaused = true;
          stopAutoSlide();
        }, { passive: true });

        carousel.addEventListener('touchend', e => {
          const diff = e.changedTouches[0].clientX - touchStartX;
          if (Math.abs(diff) > 40) {
            if (diff > 0) goToSlide(current - 1);
            else goToSlide(current + 1);
          }
          isPaused = false;
          startAutoSlide();
        }, { passive: true });
      }

      // Intersection Observer — only run auto-slide when section is in viewport
      new IntersectionObserver(([entry]) => {
        isIntersecting = entry.isIntersecting;
        if (isIntersecting) {
          startAutoSlide();
        } else {
          stopAutoSlide();
        }
      }, { threshold: 0.15 }).observe(testiSection);

      document.addEventListener('visibilitychange', () => {
        if (document.hidden) stopAutoSlide();
        else startAutoSlide();
      });

      goToSlide(0);
    }
  }
  if(reduced.matches)return;
  reduced.addEventListener('change',()=>location.reload(),{once:true});
  document.documentElement.classList.add('motion-on');
  function split(heading){
    let index=0;
    heading.setAttribute('aria-label',heading.textContent.trim().replace(/\s+/g,' '));
    const walker=document.createTreeWalker(heading,NodeFilter.SHOW_TEXT);
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    for(const node of nodes){
      const frag=document.createDocumentFragment();
      for(const word of node.data.split(/(\s+)/)){
        if(!word.trim()){frag.append(word);continue}
        const wrap=el('span','motion-word');wrap.setAttribute('aria-hidden','true');
        for(const char of word){const c=el('span','motion-char');c.textContent=char;c.style.setProperty('--i',index++);wrap.append(c)}
        frag.append(wrap);
      }
      node.replaceWith(frag);
    }
    heading.style.setProperty('--count',index);
  }
  all('.sp-banner-headline,.ed-heading h2,.sp-section-title,#why-title').forEach(split);
  const observe=new IntersectionObserver(entries=>{for(const e of entries){if(e.isIntersecting){e.target.classList.add('entered');observe.unobserve(e.target)}}},{threshold:.08});
  all('.care-card,.sp-section-kicker,.ed-kicker,.sp-quiz-title').forEach(item=>observe.observe(item));
  const story=one('.ed-purpose h3');
  if(story){
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
    svg.setAttribute('viewBox','0 0 340 85');svg.setAttribute('aria-hidden','true');svg.classList.add('draw-title');
    ['Practical steps toward','peace of mind'].forEach((line,i)=>{const t=document.createElementNS(ns,'text');t.setAttribute('x','2');t.setAttribute('y',String(31+38*i));t.textContent=line;svg.append(t)});
    story.setAttribute('aria-label',story.textContent);story.replaceChildren(svg);observe.observe(story);
  }
  const iris=one('.ed-custom');
  if(iris){
    const frame=el('div','iris-track');iris.before(frame);frame.append(iris);
    const first=el('div','iris-first');
    first.textContent='Business, family and relationships can overlap.';
    const next=el('div','iris-next');
    while(iris.firstChild)next.append(iris.firstChild);
    iris.append(first,next);
  }
  const hero=one('.sp-hero-banner-frame');
  if(hero){const glow=el('div','motion-orb');glow.setAttribute('aria-hidden','true');hero.append(glow);const mark=el('span','hero-watermark');mark.setAttribute('aria-hidden','true');mark.textContent='SPOUZY';hero.append(mark)}
  const cardSelector = [
    '.care-card',
    '.sp-service-card-modern:not(.review-stage > *)',
    '.why-grid > li',
    '.sp-metric-item',
    '.sp-quiz-opt-btn',
    '.ed-pillars > article',
    '.ed-gallery-grid > .ed-photo',
    '.sp-story-pill',
    '.sp-story-quote-card',
    '.ed-directory > details',
    '#questions details'
  ].join(',');

  all(cardSelector).forEach((card,i)=>{
    card.style.setProperty('--side',i%2?'1':'-1');
    const tiles=card.querySelector('.tiles');
    if(tiles && !tiles.hasChildNodes()){
      for(let n=0;n<12;n++){const t=el('i','');t.style.setProperty('--delay',((n*7)%12)*12+'ms');tiles.append(t)}
    }
    card.addEventListener('pointerenter',e=>{
      if(!pointer.matches)return;
      const r=card.getBoundingClientRect();
      card.style.setProperty('--ox',(e.clientX-r.left)+'px');
      card.style.setProperty('--oy',(e.clientY-r.top)+'px');
    });
    card.addEventListener('pointermove',e=>{
      if(!pointer.matches)return;
      const r=card.getBoundingClientRect();
      card.style.setProperty('--ox',(e.clientX-r.left)+'px');
      card.style.setProperty('--oy',(e.clientY-r.top)+'px');
      card.style.setProperty('--ry',((e.clientX-r.left)/r.width-.5)*6+'deg');
      card.style.setProperty('--rx',(.5-(e.clientY-r.top)/r.height)*5+'deg');
    });
    card.addEventListener('pointerleave',()=>{
      card.style.removeProperty('--ry');
      card.style.removeProperty('--rx');
    });
    observe.observe(card);
  });
  const nav=one('.sp-menu-list');
  if(nav){
    const pill=el('span','nav-glide');pill.setAttribute('aria-hidden','true');one('.sp-nav-container').prepend(pill);
    function glide(e){const a=e.target.closest('.sp-nav-link');if(!a)return;const r=a.getBoundingClientRect(),p=pill.parentNode.getBoundingClientRect();Object.assign(pill.style,{width:r.width+'px',height:r.height+'px',transform:'translate('+(r.left-p.left)+'px,'+(r.top-p.top)+'px)',opacity:'1'})}
    nav.onpointerover=glide;nav.onfocusin=glide;nav.onpointerleave=()=>pill.style.opacity='0';nav.onfocusout=e=>{if(!nav.contains(e.relatedTarget))pill.style.opacity='0'};
  }
  const btns=all('.sp-banner-btn-primary,.sp-banner-btn-secondary,.sp-cta-primary');
  for(const link of [...btns,...all('.sp-nav-link')]){
    if(!link.hasAttribute('aria-label'))link.setAttribute('aria-label',link.textContent.trim().replace(/\s+/g,' '));
    for(const node of Array.from(link.childNodes)){
      if(node.nodeType!==3||!node.textContent.trim())continue;
      const mask=el('span','roll-mask'),word=el('span','roll-word');word.textContent=node.textContent.trim();word.dataset.label=word.textContent;mask.append(word);node.replaceWith(mask);
    }
  }
  if(pointer.matches){
    const ring=el('div','pointer-ring'),dot=el('div','pointer-dot');
    document.body.append(ring,dot);
    document.addEventListener('pointermove',e=>{
      if(e.pointerType==='touch')return;
      for(const n of [ring,dot]){n.style.transform='translate('+e.clientX+'px,'+e.clientY+'px)';n.style.opacity='1'}
      ring.classList.toggle('over',!!e.target.closest('button,a,summary'));
    },{passive:true});
    document.documentElement.addEventListener('pointerleave',()=>{ring.style.opacity=dot.style.opacity='0'});
    btns.forEach(btn=>{btn.onpointermove=e=>{const r=btn.getBoundingClientRect();btn.style.translate=((e.clientX-r.left-r.width/2)*.065)+'px '+((e.clientY-r.top-r.height/2)*.11)+'px'};btn.onpointerleave=()=>btn.style.translate=''});
  }
  const progress=el('div','read-progress');document.body.append(progress);
  const header=one('.sp-header-modern'), ticker=one('.sp-ticker-section');
  const heads=all('.ed-heading h2,.sp-section-title,#why-title');
  const stack=all('.sticky-stack-card');
  let y=scrollY,last=performance.now(),raf=0,settle;
  function redraw(){
    raf=0;
    const now=performance.now(),delta=scrollY-y;
    progress.style.transform='scaleX('+clamp(scrollY/Math.max(1,document.documentElement.scrollHeight-innerHeight))+')';
    if(header&&Math.abs(delta)>2)header.classList.toggle('motion-hidden',delta>0&&scrollY>220&&!header.contains(document.activeElement)&&!document.querySelector('.is-open'));
    if(hero){const r=hero.getBoundingClientRect();if(r.bottom>0)hero.style.setProperty('--shift',Math.min(24,Math.max(0,-r.top)*.07)+'px')}
    if(ticker&&delta){ticker.style.setProperty('--lean',Math.max(-5,Math.min(5,delta/Math.max(16,now-last)*4))+'deg');clearTimeout(settle);settle=setTimeout(()=>ticker.style.setProperty('--lean','0deg'),120)}
    for(const h of heads){const r=h.getBoundingClientRect();h.style.setProperty('--reveal',clamp((innerHeight*.96-r.top)/(innerHeight*.27)))}
    stack.forEach((card)=>{
      const parent=card.parentElement;
      const siblings=all('article, .sticky-stack-card',parent);
      const pos=siblings.indexOf(card);
      let recede=0;
      for(let j=pos+1;j<siblings.length;j++){
        const nextCard=siblings[j];
        const r=nextCard.getBoundingClientRect();
        const stickyTop=parseFloat(getComputedStyle(nextCard).top)||100;
        const overlapDistance=110;
        const progress=clamp((stickyTop+overlapDistance-r.top)/overlapDistance);
        recede+=progress;
      }
      card.style.setProperty('--recede',Math.min(2.5,recede).toFixed(3));
    });
    if(iris){const r=iris.parentElement.getBoundingClientRect();iris.style.setProperty('--iris',clamp((100-r.top)/Math.max(1,r.height-iris.offsetHeight))*125+'%')}
    y=scrollY;last=now;
  }
  function schedule(){if(!raf)raf=requestAnimationFrame(redraw)}
  addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule);redraw();
  function curtain(enter){
    const overlay=el('div','page-curtain '+(enter?'unveil':'veil'));overlay.setAttribute('aria-hidden','true');
    for(const delay of [0,35,70,70,35,0]){const strip=el('i','');strip.style.animationDelay=delay+'ms';overlay.append(strip)}
    document.body.append(overlay);return overlay;
  }
  try{if(sessionStorage.getItem('sp-arrival')){sessionStorage.removeItem('sp-arrival');const o=curtain(true);setTimeout(()=>o.remove(),500)}}catch{}
  document.addEventListener('click',e=>{
    const a=e.target.closest('a[href]');if(!a||e.defaultPrevented||e.button||e.ctrlKey||e.shiftKey||e.altKey||e.metaKey||a.target||a.hasAttribute('download'))return;
    const u=new URL(a.href,location.href);
    if(u.origin!==location.origin||(!/\.html?$/i.test(u.pathname)&&!u.searchParams.has('page'))||(u.pathname===location.pathname&&u.search===location.search&&u.hash))return;
    if(!['file:','http:','https:'].includes(u.protocol))return;
    e.preventDefault();if(one('.page-curtain.veil'))return;
    try{sessionStorage.setItem('sp-arrival','1')}catch{}
    curtain(false);setTimeout(()=>location.assign(u.href),350);
  });
  addEventListener('pageshow',e=>{if(e.persisted)all('.page-curtain').forEach(n=>n.remove())});
})();
