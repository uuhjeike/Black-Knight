(() => {
  'use strict';

  /* ------------------------------------------------------------------
     CONFIG — normal GitHub links work here (blob links auto-convert to raw)
  ------------------------------------------------------------------ */
  const CONFIG = {
    name: 'Black Knight',
    profilePhoto: 'https://github.com/uuhjeike/Black-Knight/blob/main/profile%20photo.jpg',
    postsUrl: 'https://github.com/uuhjeike/Black-Knight/blob/main/posts.txt',
    localPostsFallback: 'posts.txt'
  };

  const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'svg', 'jfif'];
  const VIDEO_EXT = ['mp4', 'webm', 'mov', 'm4v', 'ogv'];
  const AUDIO_EXT = ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac', 'opus'];
  const FILE_EXT  = ['pdf', 'zip', 'rar', '7z', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'apk', 'json'];

  const $ = (id) => document.getElementById(id);

  /* ------------------------------------------------------------------
     URL helpers
  ------------------------------------------------------------------ */

  // github.com/<user>/<repo>/blob/<branch>/<path>  ->  raw.githubusercontent.com/...
  function toRaw(input) {
    try {
      const u = new URL(input);
      if (u.hostname === 'github.com' || u.hostname === 'www.github.com') {
        const m = u.pathname.match(/^\/([^/]+)\/([^/]+)\/(?:blob|raw)\/(.+)$/);
        if (m) {
          return {
            url: `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}`,
            converted: true
          };
        }
      }
    } catch (e) { /* not a valid URL, fall through */ }
    return { url: input, converted: false };
  }

  function withBust(url) {
    return url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();
  }

  function safeDecode(s) {
    try { return decodeURIComponent(s); } catch (e) { return s; }
  }

  function extOf(pathname) {
    const clean = safeDecode(pathname).toLowerCase();
    const m = clean.match(/\.([a-z0-9]+)$/);
    return m ? m[1] : '';
  }

  function fileNameOf(pathname) {
    const parts = safeDecode(pathname).split('/').filter(Boolean);
    return parts.length ? parts[parts.length - 1] : '';
  }

  function parseStartTime(v) {
    if (!v) return 0;
    if (/^\d+$/.test(v)) return parseInt(v, 10);
    const m = v.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
    if (!m) return 0;
    return (parseInt(m[1] || 0, 10) * 3600) + (parseInt(m[2] || 0, 10) * 60) + parseInt(m[3] || 0, 10);
  }

  function parseYouTube(u) {
    const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '');
    let id = '';
    let short = false;

    if (host === 'youtu.be') {
      id = u.pathname.slice(1).split('/')[0];
    } else if (host === 'youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
      const p = u.pathname;
      if (p === '/watch') id = u.searchParams.get('v') || '';
      else {
        const m = p.match(/^\/(shorts|embed|live|v)\/([^/?#]+)/);
        if (m) { id = m[2]; short = m[1] === 'shorts'; }
      }
    } else {
      return null;
    }
    if (!/^[\w-]{6,}$/.test(id)) return null;
    return { id, short, start: parseStartTime(u.searchParams.get('t') || u.searchParams.get('start')) };
  }

  function classify(original) {
    const conv = toRaw(original);
    let u;
    try { u = new URL(conv.url); } catch (e) {
      return { type: 'link', url: original, original, converted: false, host: original, name: original };
    }

    const base = { url: conv.url, original, converted: conv.converted, host: u.hostname.replace(/^www\./, '') };

    const yt = parseYouTube(u);
    if (yt) return Object.assign(base, yt, { type: 'youtube' });

    const ext = extOf(u.pathname);
    const name = fileNameOf(u.pathname);
    base.name = name;
    base.ext = ext;

    if (IMAGE_EXT.includes(ext)) return Object.assign(base, { type: 'image' });
    if (VIDEO_EXT.includes(ext)) return Object.assign(base, { type: 'video' });
    if (AUDIO_EXT.includes(ext)) return Object.assign(base, { type: 'audio' });
    if (FILE_EXT.includes(ext))  return Object.assign(base, { type: 'file' });
    return Object.assign(base, { type: 'link' });
  }

  /* ------------------------------------------------------------------
     posts.txt parsing — posts are separated by a line containing only "-"
     Inside a post: text lines and URL lines in any order.
  ------------------------------------------------------------------ */
  function parsePosts(raw) {
    const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/);
    const posts = [];
    let cur = [];
    for (const line of lines) {
      if (line.trim() === '-') {
        if (cur.length) posts.push(cur);
        cur = [];
      } else {
        cur.push(line);
      }
    }
    if (cur.length) posts.push(cur);

    return posts
      .map((ls) => ls.map((l) => l.trim()).filter(Boolean))
      .filter((p) => p.length);
  }

  const URL_ONLY = /^https?:\/\/\S+$/i;

  /* ------------------------------------------------------------------
     DOM builders
  ------------------------------------------------------------------ */
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function anchor(href, label, cls) {
    const a = el('a', cls, label);
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    return a;
  }

  // Text paragraph with inline URLs turned into links
  function textBlock(line) {
    const p = el('p', 'text');
    const re = /(https?:\/\/[^\s<]+)/g;
    let last = 0;
    let m;
    while ((m = re.exec(line)) !== null) {
      let url = m[1];
      let trail = '';
      const t = url.match(/[.,;:!?)\]'"]+$/);
      if (t) { trail = t[0]; url = url.slice(0, -trail.length); }
      if (m.index > last) p.appendChild(document.createTextNode(line.slice(last, m.index)));
      p.appendChild(anchor(toRaw(url).converted ? url : url, url));
      if (trail) p.appendChild(document.createTextNode(trail));
      last = m.index + m[1].length;
    }
    if (last < line.length) p.appendChild(document.createTextNode(line.slice(last)));
    return p;
  }

  function sourceLine(item) {
    if (!item.converted) return null;
    const s = el('p', 'source');
    s.appendChild(anchor(item.original, 'Source'));
    return s;
  }

  function chip(href, kind, title, sub) {
    const a = el('a', 'chip');
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.appendChild(el('span', 'chip-kind', kind));
    const body = el('span', 'chip-body');
    body.appendChild(el('span', 'chip-title', title));
    if (sub) body.appendChild(el('span', 'chip-sub', sub));
    a.appendChild(body);
    return a;
  }

  function mediaBlock(item, gallery) {
    const wrap = el('div', 'media');

    switch (item.type) {
      case 'image': {
        const idx = gallery.length;
        gallery.push(item.url);
        const img = el('img', 'post-img');
        img.alt = 'Post image';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.src = item.url;
        img.addEventListener('click', () => openLightbox(gallery, idx));
        img.addEventListener('error', () => {
          wrap.textContent = '';
          wrap.appendChild(chip(item.original, 'IMG', 'Image could not be loaded', item.host));
        });
        wrap.appendChild(img);
        break;
      }
      case 'youtube': {
        const box = el('div', 'yt' + (item.short ? ' short' : ''));
        const f = document.createElement('iframe');
        let src = `https://www.youtube-nocookie.com/embed/${item.id}?rel=0&playsinline=1`;
        if (item.start) src += `&start=${item.start}`;
        f.src = src;
        f.title = 'YouTube video';
        f.loading = 'lazy';
        f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';
        f.allowFullscreen = true;
        f.referrerPolicy = 'strict-origin-when-cross-origin';
        box.appendChild(f);
        wrap.appendChild(box);
        break;
      }
      case 'video': {
        const v = document.createElement('video');
        v.controls = true;
        v.preload = 'metadata';
        v.playsInline = true;
        v.src = item.url;
        wrap.appendChild(v);
        break;
      }
      case 'audio': {
        const a = document.createElement('audio');
        a.controls = true;
        a.preload = 'metadata';
        a.src = item.url;
        wrap.appendChild(a);
        break;
      }
      case 'file':
        wrap.appendChild(chip(item.url, (item.ext || 'file').toUpperCase(), item.name || 'Download file', item.host));
        break;
      default:
        wrap.appendChild(chip(item.original, 'LINK', item.host, item.original));
    }

    const src = sourceLine(item);
    if (src) wrap.appendChild(src);
    return wrap;
  }

  function buildPost(lines, avatarUrl) {
    const post = el('article', 'post');

    const head = el('div', 'post-head');
    const av = el('img', 'post-avatar');
    av.alt = '';
    av.src = avatarUrl;
    av.addEventListener('error', () => av.remove());
    head.appendChild(av);
    head.appendChild(el('div', 'post-author', CONFIG.name));
    const mark = el('span', 'post-mark', '\u265E');
    mark.setAttribute('aria-hidden', 'true');
    head.appendChild(mark);
    post.appendChild(head);

    const gallery = [];
    for (const line of lines) {
      if (URL_ONLY.test(line)) post.appendChild(mediaBlock(classify(line), gallery));
      else post.appendChild(textBlock(line));
    }
    return post;
  }

  /* ------------------------------------------------------------------
     Lightbox
  ------------------------------------------------------------------ */
  const lb = { el: null, img: null, list: [], i: 0, lastFocus: null };

  function showLb() {
    lb.img.src = lb.list[lb.i];
    $('lbCount').textContent = `${lb.i + 1} / ${lb.list.length}`;
  }

  function openLightbox(list, index) {
    lb.list = list.slice();
    lb.i = index;
    lb.lastFocus = document.activeElement;
    lb.el.classList.toggle('single', list.length < 2);
    lb.el.hidden = false;
    document.body.style.overflow = 'hidden';
    showLb();
    $('lbClose').focus();
  }

  function closeLightbox() {
    lb.el.hidden = true;
    lb.img.removeAttribute('src');
    document.body.style.overflow = '';
    if (lb.lastFocus && lb.lastFocus.focus) lb.lastFocus.focus();
  }

  function stepLb(d) {
    if (lb.list.length < 2) return;
    lb.i = (lb.i + d + lb.list.length) % lb.list.length;
    showLb();
  }

  function initLightbox() {
    lb.el = $('lightbox');
    lb.img = $('lbImg');
    $('lbClose').addEventListener('click', closeLightbox);
    $('lbPrev').addEventListener('click', () => stepLb(-1));
    $('lbNext').addEventListener('click', () => stepLb(1));
    lb.el.addEventListener('click', (e) => { if (e.target === lb.el) closeLightbox(); });

    document.addEventListener('keydown', (e) => {
      if (lb.el.hidden) return;
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') stepLb(-1);
      else if (e.key === 'ArrowRight') stepLb(1);
    });

    let x0 = null;
    lb.el.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    lb.el.addEventListener('touchend', (e) => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 50) stepLb(dx < 0 ? 1 : -1);
      x0 = null;
    }, { passive: true });
  }

  /* ------------------------------------------------------------------
     Loading
  ------------------------------------------------------------------ */
  async function fetchPostsText() {
    const sources = [
      withBust(toRaw(CONFIG.postsUrl).url),     // always the freshest copy from GitHub
      withBust(CONFIG.localPostsFallback)       // same-folder posts.txt as a fallback
    ];
    for (const s of sources) {
      try {
        const r = await fetch(s, { cache: 'no-store' });
        if (r.ok) return await r.text();
      } catch (e) { /* try next source */ }
    }
    throw new Error('posts.txt could not be loaded');
  }

  function setupProfile() {
    const photo = toRaw(CONFIG.profilePhoto).url;
    const img = $('avatarImg');
    img.addEventListener('error', () => $('avatar').classList.add('no-photo'));
    img.src = photo;
    document.documentElement.style.setProperty('--photo', `url("${photo}")`);
    return photo;
  }

  async function init() {
    initLightbox();
    const photo = setupProfile();
    const feed = $('feed');
    const status = $('status');
    const count = $('count');

    try {
      const text = await fetchPostsText();
      const posts = parsePosts(text);

      if (!posts.length) {
        status.textContent = 'No posts yet. Add posts to posts.txt and they will show up here.';
        return;
      }

      const frag = document.createDocumentFragment();
      posts.forEach((p) => frag.appendChild(buildPost(p, photo)));
      feed.appendChild(frag);
      count.textContent = `${posts.length} ${posts.length === 1 ? 'post' : 'posts'}`;
      status.textContent = '';
    } catch (e) {
      status.textContent = 'Posts could not be loaded. Check that posts.txt exists in the repository and that the page is served from GitHub Pages, not opened as a local file.';
    }
  }

  init();
})();
