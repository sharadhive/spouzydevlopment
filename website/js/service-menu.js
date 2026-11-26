(() => {
  const menu = document.querySelector('.service-menu');
  if (!menu) return;
  const groups = [...menu.querySelectorAll('details')];
  const mobile = menu.querySelector('.service-toggle');
  const desktop = matchMedia('(min-width: 960px) and (hover: hover)');
  let pinned = null;

  function closeAll() {
    groups.forEach(group => { group.open = false; });
    pinned = null;
  }
  function closeMenu() {
    closeAll();
    mobile.setAttribute('aria-expanded', 'false');
  }
  groups.forEach(group => {
    const trigger = group.querySelector('summary');
    function open() {
      groups.forEach(other => { other.open = other === group; });
    }
    trigger.addEventListener('pointerenter', event => {
      if (desktop.matches && event.pointerType === 'mouse') {
        if (pinned !== group) pinned = null;
        open();
      }
    });
    trigger.addEventListener('click', event => {
      event.preventDefault();
      if (group.open && (pinned === group || !desktop.matches)) closeAll();
      else { open(); pinned = group; }
    });
  });
  mobile.addEventListener('click', () => {
    const expanded = mobile.getAttribute('aria-expanded') === 'true';
    closeAll();
    mobile.setAttribute('aria-expanded', String(!expanded));
  });
  menu.addEventListener('pointerleave', () => {
    if (desktop.matches && !pinned && !menu.contains(document.activeElement)) closeAll();
  });
  document.addEventListener('pointerdown', event => { if (!menu.contains(event.target)) closeMenu(); });
  menu.addEventListener('focusout', event => {
    if (event.relatedTarget && !menu.contains(event.relatedTarget)) closeMenu();
  });
  menu.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const open = groups.find(group => group.open);
    if (open) { closeAll(); open.querySelector('summary').focus(); }
    else { closeMenu(); if (mobile.offsetWidth) mobile.focus(); }
  });
  desktop.addEventListener('change', closeMenu);
  const search = menu.querySelector('[type=search]');
  search.addEventListener('input', () => {
    const query = search.value.trim().toLowerCase();
    const results = menu.querySelectorAll('.service-results a');
    let count = 0;
    results.forEach(link => {
      link.hidden = !link.textContent.toLowerCase().includes(query);
      if (!link.hidden) count++;
    });
    menu.querySelector('.service-empty').hidden = count > 0;
  });
})();
