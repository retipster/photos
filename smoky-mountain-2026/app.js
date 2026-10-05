(() => {
  const G = window.GALLERY;
  const $ = (s, el = document) => el.querySelector(s);
  const flat = [];          // every item in album order, for lightbox paging
  const byId = {};

  // ---------- Build sections ----------
  const main = $('#gallery');
  const nav = $('#daynav-inner');
  const play = '<svg viewBox="0 0 24 24"><path d="M7 4v16l13-8z"/></svg>';
  const fmt = s => { s = Math.round(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

  G.sections.forEach(sec => {
    const total = sec.groups.reduce((n, g) => n + g.items.length, 0);
    const a = document.createElement('a');
    a.href = '#' + sec.key; a.dataset.key = sec.key;
    a.innerHTML = `${sec.label}<small>${total}</small>`;
    nav.appendChild(a);

    const el = document.createElement('section');
    el.className = 'day'; el.id = sec.key;
    el.innerHTML = `<div class="day-head"><div><h2>${sec.label}</h2>${sec.date ? `<p class="date">${sec.date}</p>` : ''}</div>
      </div>`;
    sec.groups.forEach(g => {
      const ge = document.createElement('div');
      ge.className = 'group';
      ge.innerHTML = `<div class="group-head"><h3>${g.label}</h3><span class="n">${g.items.length}</span><span class="rule"></span></div><div class="grid"></div>`;
      const grid = $('.grid', ge);
      grid._items = g.items;
      g.items.forEach(it => { it.section = sec.label; it.group = g.label; it.index = flat.length; flat.push(it); byId[it.id] = it; });
      el.appendChild(ge);
    });
    main.appendChild(el);
  });

  const nPhotos = flat.filter(i => i.type === 'photo').length;
  const nVideos = flat.filter(i => i.type === 'video').length;
  $('#counts').innerHTML = `<span>${nPhotos} photos</span><span>${nVideos} video clips</span><span>4 days</span>`;

  // ---------- Justified rows (keeps shot order left to right) ----------
  function makeTile(it) {
    const b = document.createElement('button');
    b.className = 'tile'; b.dataset.id = it.id;
    b.setAttribute('aria-label', `${it.section} ${it.type === 'video' ? 'video' : 'photo'} ${it.index + 1}`);
    const img = new Image();
    img.loading = 'lazy'; img.decoding = 'async'; img.alt = '';
    img.onload = () => img.classList.add('loaded');
    img.src = it.thumb;
    b.appendChild(img);
    if (it.type === 'video') {
      b.insertAdjacentHTML('beforeend', `<span class="badge">${play}${fmt(it.duration)}</span>`);
      b.addEventListener('mouseenter', () => {
        let v = b.querySelector('video');
        if (!v) { v = document.createElement('video'); v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto'; v.src = it.preview; b.insertBefore(v, b.children[1]); }
        v.play().then(() => b.classList.add('playing')).catch(() => {});
      });
      b.addEventListener('mouseleave', () => { const v = b.querySelector('video'); if (v) { v.pause(); b.classList.remove('playing'); } });
    }
    b.addEventListener('click', () => openLB(it.index));
    return b;
  }

  function layoutGrid(grid) {
    const W = grid.clientWidth; if (!W) return;
    const gap = W < 700 ? 3 : 6;
    const target = W < 500 ? 150 : W < 900 ? 200 : W < 1400 ? 260 : 300;
    if (grid._w === W) return; grid._w = W;
    grid.innerHTML = '';
    const items = grid._items;
    let row = [], ratio = 0;
    const flush = (last) => {
      let h = (W - gap * (row.length - 1)) / ratio;
      if (last && h > target * 1.25) h = target;
      const r = document.createElement('div'); r.className = 'row';
      row.forEach(it => {
        const t = it._tile || (it._tile = makeTile(it));
        t.style.width = Math.floor(h * it.w / it.h) + 'px'; t.style.height = Math.round(h) + 'px';
        r.appendChild(t);
      });
      grid.appendChild(r); row = []; ratio = 0;
    };
    items.forEach(it => {
      row.push(it); ratio += it.w / it.h;
      if ((W - gap * (row.length - 1)) / ratio <= target) flush(false);
    });
    if (row.length) flush(true);
  }
  const grids = [...document.querySelectorAll('.grid')];
  const layoutAll = () => grids.forEach(layoutGrid);
  layoutAll();
  let rT; window.addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(layoutAll, 120); });

  // ---------- Active day in nav ----------
  const links = [...nav.querySelectorAll('a')];
  const io = new IntersectionObserver(es => {
    es.forEach(e => {
      if (e.isIntersecting) {
        links.forEach(l => l.classList.toggle('active', l.dataset.key === e.target.id));
        const act = nav.querySelector('.active'); if (act) act.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  document.querySelectorAll('.day').forEach(s => io.observe(s));

  // ---------- Lightbox ----------
  const lb = $('#lightbox'), stage = $('#lb-stage');
  let cur = -1;
  function preload(i) { const it = flat[i]; if (it && it.type === 'photo') { const im = new Image(); im.src = it.large; } }
  function render() {
    const it = flat[cur];
    stage.classList.remove('zoomed');
    stage.innerHTML = '<div class="lb-spinner"></div>';
    let m;
    if (it.type === 'photo') {
      m = new Image(); m.alt = '';
      m.onload = () => { const s = stage.querySelector('.lb-spinner'); if (s) s.remove(); };
      m.src = it.large;
      m.addEventListener('click', e => toggleZoom(e, it));
    } else {
      m = document.createElement('video');
      m.controls = true; m.autoplay = true; m.playsInline = true; m.poster = it.poster; m.src = it.video;
      m.addEventListener('loadeddata', () => { const s = stage.querySelector('.lb-spinner'); if (s) s.remove(); });
    }
    stage.appendChild(m);
    $('#lb-title').textContent = `${it.section} · ${it.group}`;
    $('#lb-count').textContent = `${cur + 1} of ${flat.length}`;
    history.replaceState(null, '', '#' + it.id);
    preload(cur + 1); preload(cur - 1);
  }
  function toggleZoom(e, it) {
    const img = e.currentTarget;
    if (stage.classList.contains('zoomed')) { stage.classList.remove('zoomed'); img.src = it.large; return; }
    const r = img.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    stage.classList.add('zoomed');
    img.src = it.full;
    const go = () => { stage.scrollLeft = img.offsetWidth * fx - stage.clientWidth / 2; stage.scrollTop = img.offsetHeight * fy - stage.clientHeight / 2; };
    img.complete ? go() : img.addEventListener('load', go, { once: true });
  }
  function openLB(i) {
    cur = i; lb.classList.add('open'); lb.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden'; render();
  }
  function closeLB() {
    lb.classList.remove('open'); lb.setAttribute('aria-hidden', 'true');
    stage.innerHTML = ''; document.body.style.overflow = '';
    const it = flat[cur]; history.replaceState(null, '', location.pathname + location.search);
    if (it && it._tile) it._tile.focus({ preventScroll: true });
    cur = -1;
  }
  const step = d => { if (cur < 0) return; cur = (cur + d + flat.length) % flat.length; render(); };
  $('#lb-prev').onclick = () => step(-1);
  $('#lb-next').onclick = () => step(1);
  $('#lb-close').onclick = closeLB;
  lb.addEventListener('click', e => { if (e.target === stage || e.target === lb) closeLB(); });
  document.addEventListener('keydown', e => {
    if ($('#sharesheet').classList.contains('open')) { if (e.key === 'Escape') closeShare(); return; }
    if (cur < 0) return;
    if (e.key === 'Escape') closeLB();
    else if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowLeft') step(-1);
  });
  let tx = null, ty = null;
  stage.addEventListener('touchstart', e => { if (stage.classList.contains('zoomed')) return; tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
  stage.addEventListener('touchend', e => {
    if (tx === null) return;
    const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
    else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) closeLB();
    tx = null;
  });

  // ---------- Sharing ----------
  const abs = p => new URL(p, G.base).href;
  const albumUrl = G.base;
  const itemUrl = it => abs('p/' + it.id + '.html');
  const toast = msg => { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 1800); };
  async function share(url, title) {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      try { await navigator.share({ title, url }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    const ss = $('#sharesheet');
    $('#ss-title').textContent = title;
    $('#ss-url').value = url;
    const u = encodeURIComponent(url), t = encodeURIComponent(title);
    $('#ss-fb').href = `https://www.facebook.com/sharer/sharer.php?u=${u}`;
    $('#ss-x').href = `https://twitter.com/intent/tweet?url=${u}&text=${t}`;
    $('#ss-li').href = `https://www.linkedin.com/sharing/share-offsite/?url=${u}`;
    $('#ss-mail').href = `mailto:?subject=${t}&body=${u}`;
    ss.classList.add('open'); ss.setAttribute('aria-hidden', 'false');
  }
  function closeShare() { const ss = $('#sharesheet'); ss.classList.remove('open'); ss.setAttribute('aria-hidden', 'true'); }
  $('#ss-cancel').onclick = closeShare;
  $('#sharesheet').addEventListener('click', e => { if (e.target.id === 'sharesheet') closeShare(); });
  $('#ss-copybtn').onclick = async () => {
    const v = $('#ss-url').value;
    try { await navigator.clipboard.writeText(v); } catch { $('#ss-url').select(); document.execCommand('copy'); }
    toast('Link copied');
  };
  document.querySelectorAll('[data-share-album]').forEach(b => b.onclick = () => share(albumUrl, 'REtipster Inner Circle: Smoky Mountain Mastermind 2026'));
  $('#lb-share').onclick = () => { const it = flat[cur]; share(itemUrl(it), `REtipster Inner Circle Smoky Mountain Mastermind 2026 (${it.section})`); };

  const heroItem = byId['d4-drone-dji_20261002185036_0113_d'];
  const heroFig = $('.hero-photo');
  if (heroItem && heroFig) heroFig.addEventListener('click', () => openLB(heroItem.index));

  // ---------- Deep link ----------
  const h = decodeURIComponent(location.hash.slice(1));
  if (h && byId[h]) openLB(byId[h].index);
})();
