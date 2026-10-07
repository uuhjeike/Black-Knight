/* ==========================================================
   GREY KNIGHTS — profile feed
   Reads ./posts.txt, one post per block, blocks separated by a
   line containing only "-". Static, vanilla, GitHub Pages safe.
   ========================================================== */
(function () {
  'use strict';

  /* ---------------- Config ---------------- */
  var POSTS_FILE = './posts.txt';
  var PROFILE_PHOTO = 'https://github.com/uuhjeike/Grey-Knights/blob/main/file_000000005e288230942243b599bb8cd4.png';
  var BATCH_SIZE = 10;
  var TEXT_PREVIEW_LIMIT = 20000;

  var IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'avif', 'bmp'];
  var VIDEO_EXT = ['mp4', 'webm', 'ogv', 'm4v', 'mov'];
  var AUDIO_EXT = ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac', 'opus'];
  var FILE_EXT = ['pdf', 'txt', 'zip', 'rar', '7z', 'tar', 'gz', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
    'csv', 'json', 'md', 'rtf', 'odt', 'ods', 'odp', 'epub', 'log', 'apk'];
  var TEXT_PREVIEW_EXT = ['txt', 'md', 'csv', 'json', 'log'];
  var FILE_TYPE_LABEL = {
    pdf: 'PDF document', txt: 'Text file', zip: 'ZIP archive', rar: 'RAR archive', '7z': '7z archive',
    tar: 'TAR archive', gz: 'GZ archive', doc: 'Word document', docx: 'Word document',
    xls: 'Excel spreadsheet', xlsx: 'Excel spreadsheet', ppt: 'PowerPoint presentation',
    pptx: 'PowerPoint presentation', csv: 'CSV data', json: 'JSON data', md: 'Markdown file',
    rtf: 'Rich text', epub: 'E-book', log: 'Log file', apk: 'Android package'
  };

  var SEPARATOR = /^[ \t]*-[ \t]*$/;

  /* ==========================================================
     PURE LOGIC (parsing). No DOM access in this section.
     ========================================================== */

  function stripComments(text) {
    return String(text)
      .replace(/^\uFEFF/, '')
      .replace(/\r\n?/g, '\n')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^[ \t]*\/\/.*$/gm, '');
  }

  /** Split posts.txt into posts. Separator = a line containing only "-". */
  function parsePosts(text) {
    var lines = stripComments(text).split('\n');
    var posts = [];
    var buffer = [];
    var blockNo = 0;

    function flush() {
      blockNo += 1;
      var post = parsePost(buffer, blockNo);
      if (post) posts.push(post);
      buffer = [];
    }
    for (var i = 0; i < lines.length; i++) {
      if (SEPARATOR.test(lines[i])) flush();
      else buffer.push(lines[i]);
    }
    flush();
    return posts;
  }

  /** Turn the lines of one post into ordered blocks: text and media. */
  function parsePost(lines, number) {
    var blocks = [];
    var date = null;
    var para = [];

    function flushText() {
      var t = para.join('\n').replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
      if (t) blocks.push({ type: 'text', text: t });
      para = [];
    }

    lines.forEach(function (raw) {
      var parsed = parseLine(raw);
      if (parsed.type === 'blank') {
        para.push('');
      } else if (parsed.type === 'date' && !date) {
        date = parsed.date;
      } else if (parsed.type === 'media') {
        flushText();
        parsed.urls.forEach(function (u) { blocks.push({ type: 'media', item: parseMedia(u) }); });
      } else {
        para.push(raw.trim());
      }
    });
    flushText();

    if (!blocks.length) return null;
    return { number: number, id: 'post-' + number, date: date, blocks: blocks };
  }

  /** Classify one line: blank | date | media (only URLs) | text. */
  function parseLine(line) {
    var s = String(line).trim();
    if (!s) return { type: 'blank' };
    var date = parseDateLine(s);
    if (date) return { type: 'date', date: date };
    var tokens = s.split(/\s+/);
    if (tokens.every(isUrl)) return { type: 'media', urls: tokens };
    return { type: 'text' };
  }

  function parseDateLine(s) {
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T]+(\d{1,2}):(\d{2}))?$/.exec(s);
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    var h = m[4] === undefined ? null : +m[4];
    var mi = m[5] === undefined ? null : +m[5];
    var dt = new Date(y, mo - 1, d, h || 0, mi || 0);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
    if (h !== null && (h > 23 || mi > 59)) return null;
    return { y: y, m: mo, d: d, h: h, mi: mi };
  }

  function formatDate(date) {
    var dt = new Date(date.y, date.m - 1, date.d, date.h || 0, date.mi || 0);
    var pad = function (n) { return String(n).padStart(2, '0'); };
    var text = dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    var iso = date.y + '-' + pad(date.m) + '-' + pad(date.d);
    if (date.h !== null) {
      text += ', ' + pad(date.h) + ':' + pad(date.mi);
      iso += 'T' + pad(date.h) + ':' + pad(date.mi);
    }
    return { text: text, iso: iso };
  }

  /** Returns a URL object for http(s) addresses, otherwise null. */
  function toUrl(input) {
    var s = String(input).trim();
    if (/^www\./i.test(s)) s = 'https://' + s;
    if (!/^https?:\/\//i.test(s)) return null;
    try {
      var u = new URL(s);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
      if (!u.hostname || (u.hostname.indexOf('.') === -1 && u.hostname !== 'localhost')) return null;
      return u;
    } catch (e) { return null; }
  }

  function isUrl(s) { return !/\s/.test(s) && toUrl(s) !== null; }

  /** youtube.com/watch?v= | youtu.be/ | youtube.com/shorts/ -> {id, type, start} */
  function parseYouTubeUrl(input) {
    var u = toUrl(input);
    if (!u) return null;
    var host = u.hostname.toLowerCase().replace(/^(www\.|m\.|music\.)/, '');
    var parts = u.pathname.split('/').filter(Boolean);
    var id = null, type = 'video';
    if (host === 'youtu.be') {
      id = parts[0];
    } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (parts[0] === 'watch') id = u.searchParams.get('v');
      else if (parts[0] === 'shorts') { id = parts[1]; type = 'short'; }
      else if (parts[0] === 'embed' || parts[0] === 'live' || parts[0] === 'v') id = parts[1];
    } else {
      return null;
    }
    if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
    return { id: id, type: type, start: parseYouTubeStart(u) };
  }

  function parseYouTubeStart(u) {
    var t = u.searchParams.get('t') || u.searchParams.get('start');
    if (!t) return 0;
    if (/^\d+$/.test(t)) return +t;
    var m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(t);
    if (!m) return 0;
    return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
  }

  /** github.com/OWNER/REPO/blob/BRANCH/PATH -> raw.githubusercontent.com/OWNER/REPO/BRANCH/PATH */
  function githubBlobToRaw(input) {
    var u = toUrl(input);
    if (!u) return null;
    var host = u.hostname.toLowerCase();
    if (host !== 'github.com' && host !== 'www.github.com') return null;
    var p = u.pathname.split('/').filter(Boolean);
    if (p.length < 5 || (p[2] !== 'blob' && p[2] !== 'raw')) return null;
    return 'https://raw.githubusercontent.com/' + p[0] + '/' + p[1] + '/' + p[3] + '/' + p.slice(4).join('/');
  }

  function getExtension(pathname) {
    var last = pathname.split('/').pop() || '';
    var m = /\.([A-Za-z0-9]+)$/.exec(last);
    return m ? m[1].toLowerCase() : '';
  }

  function getFileName(pathname) {
    var last = pathname.split('/').filter(Boolean).pop() || 'file';
    try { return decodeURIComponent(last); } catch (e) { return last; }
  }

  function detectMediaType(ext) {
    if (IMAGE_EXT.indexOf(ext) !== -1) return 'image';
    if (VIDEO_EXT.indexOf(ext) !== -1) return 'video';
    if (AUDIO_EXT.indexOf(ext) !== -1) return 'audio';
    if (FILE_EXT.indexOf(ext) !== -1) return 'file';
    return 'link';
  }

  /** Classify any URL. Always returns an item; never throws. */
  function parseMedia(raw) {
    var url = toUrl(String(raw).replace(/\s+/g, ' ').trim());
    if (!url) return { kind: 'invalid', source: '', name: String(raw).trim() };

    var source = url.href;
    var yt = parseYouTubeUrl(source);
    if (yt) return { kind: 'youtube', id: yt.id, ytType: yt.type, start: yt.start, source: source, name: 'YouTube video' };

    var host = url.hostname.toLowerCase().replace(/^www\./, '');
    var src = source;
    var isGithub = host === 'github.com';
    if (isGithub) {
      var rawUrl = githubBlobToRaw(source);
      if (!rawUrl) return { kind: 'link', source: source, host: host, github: true, name: host };
      src = rawUrl;
    }

    var finalUrl = new URL(src);
    var ext = getExtension(finalUrl.pathname);
    var kind = detectMediaType(ext);
    if (kind === 'link' && isGithub) {
      return { kind: 'link', source: source, host: host, github: true, name: getFileName(finalUrl.pathname) };
    }
    return { kind: kind, src: src, source: source, ext: ext, host: host, github: isGithub, name: getFileName(finalUrl.pathname) };
  }

  function formatBytes(n) {
    if (!isFinite(n) || n <= 0) return '';
    var units = ['B', 'KB', 'MB', 'GB'];
    var i = 0;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return (i === 0 ? n : n.toFixed(n < 10 ? 1 : 0)) + ' ' + units[i];
  }

  function formatTime(sec) {
    if (!isFinite(sec) || sec < 0) return '0:00';
    var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return m + ':' + String(s).padStart(2, '0');
  }

  /* Allow Node-based testing of the pure logic. */
  if (typeof document === 'undefined' || !document.getElementById('feed')) {
    if (typeof module !== 'undefined' && module.exports) {
      module.exports = {
        parsePosts: parsePosts, parseLine: parseLine, parseMedia: parseMedia, parseYouTubeUrl: parseYouTubeUrl,
        githubBlobToRaw: githubBlobToRaw, isUrl: isUrl, formatDate: formatDate
      };
    }
    return;
  }

  /* ==========================================================
     DOM / RENDERING
     ========================================================== */

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var $ = function (sel) { return document.querySelector(sel); };

  var feedEl = $('#feed');
  var toastEl = $('#toast');
  var pageEl = $('#page');

  var galleries = new Map();
  var galleryCounter = 0;

  /* ---------- tiny helpers ---------- */
  function el(tag, props) {
    var node = document.createElement(tag);
    var p = props || {};
    Object.keys(p).forEach(function (k) {
      var v = p[k];
      if (v === undefined || v === null || v === false) return;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'dataset') Object.keys(v).forEach(function (d) { node.dataset[d] = v[d]; });
      else node.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c === undefined || c === null || c === false) continue;
      if (Array.isArray(c)) c.forEach(function (x) { if (x) node.append(x); });
      else node.append(c);
    }
    return node;
  }

  function icon(id, cls) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'icon' + (cls ? ' ' + cls : ''));
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    var use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', '#' + id);
    svg.appendChild(use);
    return svg;
  }

  function externalLink(href, label, cls, extra) {
    var props = { href: href, target: '_blank', rel: 'noopener noreferrer', class: cls };
    if (extra) Object.keys(extra).forEach(function (k) { props[k] = extra[k]; });
    return el('a', props, label);
  }

  var toastTimer;
  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2400);
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    try {
      var ta = el('textarea', { readonly: true, style: 'position:fixed;opacity:0;top:0;left:0' });
      ta.value = text;
      document.body.append(ta);
      ta.select();
      var ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (e) { return false; }
  }

  /* Lazy helpers: run a callback when a node nears the viewport. */
  var visibleCallbacks = new WeakMap();
  var visibleObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          visibleObserver.unobserve(entry.target);
          var fn = visibleCallbacks.get(entry.target);
          if (fn) fn();
        });
      }, { rootMargin: '300px' })
    : null;
  function onVisible(node, fn) {
    if (!visibleObserver) { fn(); return; }
    visibleCallbacks.set(node, fn);
    visibleObserver.observe(node);
  }

  /* ---------- Source + fallback ---------- */
  function createSourceLink(item, label) {
    if (!item.source) return null;
    return externalLink(item.source, label || 'Source', 'source-link');
  }

  function sourceRow(item, label) {
    var link = createSourceLink(item, label);
    return link ? el('div', { class: 'sources' }, link) : null;
  }

  /** Small non-breaking fallback shown whenever media fails. */
  function handleMediaError(item, extraClass) {
    var box = el('div', { class: 'unavail' + (extraClass ? ' ' + extraClass : ''), role: 'note' },
      el('span', { class: 'unavail-title', text: 'Media unavailable' }));
    if (item && item.kind === 'invalid') {
      box.append(el('span', { class: 'unavail-detail', text: item.name.slice(0, 80) }));
    }
    if (item && item.source) {
      var label = item.github ? 'Open on GitHub' : item.kind === 'youtube' ? 'Open on YouTube' : 'Open source';
      box.append(externalLink(item.source, label, 'source-link'));
    }
    return box;
  }

  /* ---------- Text ---------- */
  function renderText(text) {
    var wrap = el('div', { class: 'post-text' });
    text.split(/\n{2,}/).forEach(function (para) {
      var p = el('p');
      var re = /https?:\/\/[^\s<>"']+|www\.[^\s<>"']+/gi;
      var last = 0, m;
      while ((m = re.exec(para)) !== null) {
        var url = m[0].replace(/[.,;:!?)\]]+$/, '');
        if (m.index > last) p.append(para.slice(last, m.index));
        var parsed = toUrl(url);
        if (parsed) p.append(externalLink(parsed.href, url, 'text-link'));
        else p.append(url);
        last = m.index + url.length;
        re.lastIndex = last;
      }
      if (last < para.length) p.append(para.slice(last));
      wrap.append(p);
    });
    return wrap;
  }

  /* ---------- Images ---------- */
  function renderImage(item, index, total, galleryId) {
    var img = el('img', {
      src: item.src, loading: 'lazy', decoding: 'async',
      alt: total > 1 ? 'Grey Knights transmission, image ' + (index + 1) + ' of ' + total : 'Grey Knights transmission image'
    });
    var tile = el('button', {
      type: 'button', class: 'tile',
      dataset: { action: 'open-image', gallery: galleryId, index: String(index) },
      'aria-label': 'Open image ' + (index + 1) + ' of ' + total + ' full screen'
    }, img);
    return { tile: tile, img: img };
  }

  function createImageGallery(items) {
    var id = 'g' + (++galleryCounter);
    var entries = items.map(function (it) { return { src: it.src, source: it.source, failed: false, item: it }; });
    galleries.set(id, entries);

    var n = items.length;
    var layout = n === 1 ? 'one' : n === 2 ? 'two' : n === 3 ? 'three' : 'many';
    var grid = el('div', { class: 'gallery gallery-' + layout });

    entries.forEach(function (entry, i) {
      var parts = renderImage(entry.item, i, n, id);
      parts.img.addEventListener('error', function () {
        entry.failed = true;
        parts.tile.replaceWith(handleMediaError(entry.item, 'tile-unavail'));
      }, { once: true });
      grid.append(parts.tile);
    });

    var sources = el('div', { class: 'sources' });
    if (n === 1) {
      sources.append(createSourceLink(items[0]));
    } else {
      sources.append(el('span', { class: 'sources-label', text: 'Sources' }));
      items.forEach(function (it, i) {
        sources.append(externalLink(it.source, String(i + 1), 'source-link', { 'aria-label': 'Source of image ' + (i + 1) }));
      });
    }
    return el('figure', { class: 'media media-gallery' }, grid, sources);
  }

  /* ---------- Direct video ---------- */
  function renderVideo(item) {
    var video = el('video', { controls: true, preload: 'none', playsinline: true, 'aria-label': 'Video: ' + item.name });
    video.src = item.src;
    var figure = el('figure', { class: 'media media-video' }, video, sourceRow(item));
    video.addEventListener('error', function () { figure.replaceWith(handleMediaError(item)); }, { once: true });
    onVisible(video, function () { video.preload = 'metadata'; });
    return figure;
  }

  /* ---------- YouTube ---------- */
  function renderYouTube(item) {
    var isShort = item.ytType === 'short';
    var thumb = el('img', {
      src: 'https://i.ytimg.com/vi/' + item.id + '/hqdefault.jpg', alt: '', loading: 'lazy', decoding: 'async'
    });
    thumb.addEventListener('error', function () { thumb.remove(); }, { once: true });
    var facade = el('button', {
      type: 'button', class: 'yt-facade',
      dataset: { action: 'play-youtube', id: item.id, start: String(item.start || 0) },
      'aria-label': isShort ? 'Play YouTube Short' : 'Play YouTube video'
    }, thumb, el('span', { class: 'yt-play' }, icon('ic-play')));
    var player = el('div', { class: 'yt ' + (isShort ? 'yt-short' : 'yt-video') }, facade);
    return el('figure', { class: 'media media-youtube' }, player, sourceRow(item, 'Open on YouTube'));
  }

  /* ---------- Audio ---------- */
  function renderAudio(item) {
    var audio = el('audio', { preload: 'none' });
    audio.src = item.src;

    var useEl = null;
    var playIcon = icon('ic-play');
    useEl = playIcon.querySelector('use');
    var btn = el('button', { type: 'button', class: 'ap-btn', 'aria-label': 'Play audio' }, playIcon);
    var seek = el('input', { type: 'range', class: 'ap-seek', min: '0', max: '1000', value: '0', step: '1', 'aria-label': 'Seek audio', disabled: true });
    var time = el('span', { class: 'ap-time', text: '0:00 / 0:00' });
    var title = el('span', { class: 'ap-title', text: item.name });

    var box = el('div', { class: 'audio' }, btn,
      el('div', { class: 'ap-main' }, title, seek, time));
    var figure = el('figure', { class: 'media media-audio' }, box, sourceRow(item), audio);

    function refresh() {
      var d = audio.duration, c = audio.currentTime;
      time.textContent = formatTime(c) + ' / ' + formatTime(d);
      if (isFinite(d) && d > 0) seek.value = String(Math.round(c / d * 1000));
    }
    function setPlaying(playing) {
      useEl.setAttribute('href', playing ? '#ic-pause' : '#ic-play');
      btn.setAttribute('aria-label', playing ? 'Pause audio' : 'Play audio');
    }
    btn.addEventListener('click', function () {
      if (audio.paused) {
        var result = audio.play();
        if (result && result.catch) result.catch(function () { figure.replaceWith(handleMediaError(item)); });
      } else {
        audio.pause();
      }
    });
    seek.addEventListener('input', function () {
      var d = audio.duration;
      if (isFinite(d) && d > 0) audio.currentTime = (+seek.value / 1000) * d;
    });
    audio.addEventListener('loadedmetadata', function () { seek.disabled = false; refresh(); });
    audio.addEventListener('durationchange', refresh);
    audio.addEventListener('timeupdate', refresh);
    audio.addEventListener('play', function () { setPlaying(true); });
    audio.addEventListener('pause', function () { setPlaying(false); });
    audio.addEventListener('ended', function () { setPlaying(false); audio.currentTime = 0; refresh(); });
    audio.addEventListener('error', function () { figure.replaceWith(handleMediaError(item)); }, { once: true });
    return figure;
  }

  /* ---------- Files ---------- */
  function renderFile(item) {
    var label = FILE_TYPE_LABEL[item.ext] || (item.ext ? item.ext.toUpperCase() + ' file' : 'File');
    var sizeEl = el('span', { class: 'file-size' });
    var open = externalLink(item.src, 'Open / Download', 'btn btn-small', { download: item.name });
    var actions = el('div', { class: 'file-actions' }, open);
    if (TEXT_PREVIEW_EXT.indexOf(item.ext) !== -1) {
      actions.append(el('button', {
        type: 'button', class: 'btn btn-small', dataset: { action: 'preview-file' }, 'aria-expanded': 'false'
      }, 'Preview'));
    }
    var card = el('div', { class: 'file-card', dataset: { src: item.src } },
      el('span', { class: 'file-badge', 'aria-hidden': 'true' }, (item.ext || 'file').slice(0, 5)),
      el('div', { class: 'file-info' },
        el('span', { class: 'file-name', text: item.name }),
        el('span', { class: 'file-meta' }, label, sizeEl)),
      actions);

    var sameOrigin = false;
    try { sameOrigin = new URL(item.src).origin === location.origin; } catch (e) { /* ignore */ }
    if (sameOrigin || item.github) {
      onVisible(card, function () {
        fetch(item.src, { method: 'HEAD' }).then(function (res) {
          var len = res.ok ? +res.headers.get('content-length') : 0;
          if (len > 0) sizeEl.textContent = formatBytes(len);
        }).catch(function () { /* size simply stays hidden */ });
      });
    }
    return el('figure', { class: 'media media-file' }, card, sourceRow(item));
  }

  function toggleFilePreview(button) {
    var card = button.closest('.file-card');
    var figure = card.parentElement;
    var existing = figure.querySelector('.file-preview');
    if (existing) {
      existing.remove();
      button.setAttribute('aria-expanded', 'false');
      button.textContent = 'Preview';
      return;
    }
    var pre = el('pre', { class: 'file-preview', text: 'Loading…' });
    card.after(pre);
    button.setAttribute('aria-expanded', 'true');
    button.textContent = 'Hide preview';
    fetch(card.dataset.src).then(function (res) {
      if (!res.ok) throw new Error('bad status');
      return res.text();
    }).then(function (text) {
      pre.textContent = text.length > TEXT_PREVIEW_LIMIT ? text.slice(0, TEXT_PREVIEW_LIMIT) + '\n…' : text;
    }).catch(function () {
      pre.textContent = 'Preview unavailable. Use Open / Download.';
    });
  }

  /* ---------- Normal links ---------- */
  function renderLink(item) {
    var label = item.github ? 'Open on GitHub' : 'Open link';
    return el('div', { class: 'media link-card' },
      el('span', { class: 'link-ico' }, icon('ic-link')),
      el('div', { class: 'file-info' },
        el('span', { class: 'file-name', text: item.github ? 'GitHub' : item.host }),
        el('span', { class: 'file-meta', text: item.source.length > 60 ? item.source.slice(0, 57) + '…' : item.source })),
      el('div', { class: 'file-actions' }, externalLink(item.source, label, 'btn btn-small')));
  }

  /* ---------- Media dispatcher ---------- */
  function renderMedia(item) {
    try {
      switch (item.kind) {
        case 'video': return renderVideo(item);
        case 'audio': return renderAudio(item);
        case 'youtube': return renderYouTube(item);
        case 'file': return renderFile(item);
        case 'link': return renderLink(item);
        default: return handleMediaError(item);
      }
    } catch (e) {
      return handleMediaError(item);
    }
  }

  /* ---------- Post ---------- */
  function renderPost(post) {
    var body = el('div', { class: 'post-body' });
    var pendingImages = [];

    function flushImages() {
      if (!pendingImages.length) return;
      body.append(createImageGallery(pendingImages));
      pendingImages = [];
    }

    post.blocks.forEach(function (block) {
      if (block.type === 'text') { flushImages(); body.append(renderText(block.text)); return; }
      if (block.item.kind === 'image') { pendingImages.push(block.item); return; }
      flushImages();
      body.append(renderMedia(block.item));
    });
    flushImages();

    var head = el('header', { class: 'post-head' },
      el('span', { class: 'brand' }, icon('gk-sigil'), el('span', { class: 'brand-name', text: 'Grey Knights' })),
      el('span', { class: 'purity', 'aria-hidden': 'true' }, el('i')));

    var stamp = null;
    if (post.date) {
      var f = formatDate(post.date);
      stamp = el('time', { class: 'stamp', datetime: f.iso, text: f.text });
    }

    var foot = el('footer', { class: 'post-foot' },
      el('button', { type: 'button', class: 'foot-btn', dataset: { action: 'copy-link', post: post.id } },
        icon('ic-link'), 'Copy link'));

    return el('article', { class: 'post', id: post.id }, head, stamp, body, foot);
  }

  /* ---------- Feed (rendered in batches) ---------- */
  var allPosts = [];
  var renderedCount = 0;
  var sentinel = null;
  var sentinelObserver = null;

  function setStats(posts) {
    var mediaCount = 0;
    posts.forEach(function (p) {
      p.blocks.forEach(function (b) { if (b.type === 'media' && b.item.kind !== 'invalid') mediaCount++; });
    });
    $('#statRecords').textContent = String(posts.length);
    $('#stats').hidden = false;
    $('#statMedia').textContent = String(mediaCount);
    $('#mediaPlate').hidden = mediaCount === 0;
  }

  function renderBatch() {
    var frag = document.createDocumentFragment();
    var end = Math.min(renderedCount + BATCH_SIZE, allPosts.length);
    for (; renderedCount < end; renderedCount++) {
      try { frag.append(renderPost(allPosts[renderedCount])); } catch (e) { /* skip a broken post, keep going */ }
    }
    feedEl.insertBefore(frag, sentinel);
    if (renderedCount >= allPosts.length) {
      if (sentinelObserver) sentinelObserver.disconnect();
      sentinel.remove();
    }
  }

  function renderFeed(posts) {
    feedEl.textContent = '';
    allPosts = posts;
    renderedCount = 0;
    sentinel = el('div', { class: 'sentinel', 'aria-hidden': 'true' });
    feedEl.append(sentinel);

    if ('IntersectionObserver' in window) {
      sentinelObserver = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        renderBatch();
        if (renderedCount < allPosts.length) { sentinelObserver.unobserve(sentinel); sentinelObserver.observe(sentinel); }
      }, { rootMargin: '900px' });
      sentinelObserver.observe(sentinel);
    } else {
      while (renderedCount < allPosts.length) renderBatch();
    }
  }

  function scrollToHashPost() {
    var m = /^#(post-\d+)$/.exec(location.hash);
    if (!m) return;
    var guard = 0;
    while (!document.getElementById(m[1]) && renderedCount < allPosts.length && guard++ < 500) renderBatch();
    var target = document.getElementById(m[1]);
    if (target) target.scrollIntoView({ block: 'start' });
  }

  /* ---------- States ---------- */
  function showState(kind) {
    feedEl.textContent = '';
    var state;
    if (kind === 'empty') {
      state = el('div', { class: 'state' },
        icon('gk-sigil', 'state-sigil'),
        el('p', { class: 'state-title', text: 'Grey Knights' }),
        el('p', { class: 'state-strong', text: 'No records found' }),
        el('p', { class: 'state-text', text: 'Awaiting new transmission.' }));
    } else {
      state = el('div', { class: 'state state-error', role: 'alert' },
        icon('gk-sigil', 'state-sigil'),
        el('p', { class: 'state-title', text: 'Grey Knights Archive' }),
        el('p', { class: 'state-strong', text: 'Unable to load transmission records.' }),
        el('p', { class: 'state-text', text: 'Try refreshing the page.' }),
        el('button', { type: 'button', class: 'btn', dataset: { action: 'retry' } }, 'Try again'));
    }
    feedEl.append(state);
    $('#stats').hidden = kind !== 'empty';
    if (kind === 'empty') { $('#statRecords').textContent = '0'; $('#mediaPlate').hidden = true; }
  }

  /* ---------- Loading ---------- */
  function loadPosts() {
    feedEl.setAttribute('aria-busy', 'true');
    // Timestamp query string + no-store keeps GitHub Pages from serving a stale posts.txt.
    var url = POSTS_FILE + '?t=' + Date.now();
    return fetch(url, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (text) {
        var posts = parsePosts(text);
        if (!posts.length) { showState('empty'); return; }
        setStats(posts);
        renderFeed(posts);
        scrollToHashPost();
      })
      .catch(function () { showState('error'); })
      .then(function () { feedEl.setAttribute('aria-busy', 'false'); });
  }

  /* ---------- Lightbox ---------- */
  var lb = {
    root: $('#lightbox'), img: $('#lbImg'), msg: $('#lbMsg'), counter: $('#lbCounter'),
    source: $('#lbSource'), prev: $('#lbPrev'), next: $('#lbNext'), close: $('#lbClose'),
    items: [], index: 0, opener: null, touchX: null
  };

  function showLightbox(galleryId, startIndex, opener) {
    var list = galleries.get(galleryId);
    if (!list) return;
    var clicked = list[startIndex];
    lb.items = list.filter(function (e) { return !e.failed; });
    lb.index = Math.max(0, lb.items.indexOf(clicked));
    lb.opener = opener;
    lb.root.hidden = false;
    document.documentElement.classList.add('lb-open');
    try { pageEl.inert = true; } catch (e) { /* inert unsupported */ }
    updateLightbox();
    lb.close.focus();
  }

  function updateLightbox() {
    var n = lb.items.length;
    var it = lb.items[lb.index];
    lb.msg.hidden = true;
    lb.img.hidden = false;
    lb.img.alt = 'Image ' + (lb.index + 1) + ' of ' + n;
    lb.img.src = it.src;
    lb.counter.textContent = (lb.index + 1) + ' / ' + n;
    lb.source.href = it.source;
    lb.prev.hidden = lb.next.hidden = n < 2;
  }

  function stepLightbox(delta) {
    var n = lb.items.length;
    if (n < 2) return;
    lb.index = (lb.index + delta + n) % n;
    updateLightbox();
  }

  function closeLightbox() {
    lb.root.hidden = true;
    lb.img.removeAttribute('src');
    document.documentElement.classList.remove('lb-open');
    try { pageEl.inert = false; } catch (e) { /* ignore */ }
    if (lb.opener && document.contains(lb.opener)) lb.opener.focus();
    lb.opener = null;
  }

  lb.img.addEventListener('error', function () {
    lb.img.hidden = true;
    lb.msg.hidden = false;
  });
  lb.close.addEventListener('click', closeLightbox);
  lb.prev.addEventListener('click', function () { stepLightbox(-1); });
  lb.next.addEventListener('click', function () { stepLightbox(1); });
  lb.root.addEventListener('click', function (e) {
    if (e.target === lb.root || e.target.classList.contains('lb-stage')) closeLightbox();
  });
  lb.root.addEventListener('touchstart', function (e) { lb.touchX = e.touches[0].clientX; }, { passive: true });
  lb.root.addEventListener('touchend', function (e) {
    if (lb.touchX === null) return;
    var dx = e.changedTouches[0].clientX - lb.touchX;
    lb.touchX = null;
    if (Math.abs(dx) > 50) stepLightbox(dx < 0 ? 1 : -1);
  }, { passive: true });
  document.addEventListener('keydown', function (e) {
    if (lb.root.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); closeLightbox(); }
    else if (e.key === 'ArrowLeft') stepLightbox(-1);
    else if (e.key === 'ArrowRight') stepLightbox(1);
    else if (e.key === 'Tab') {
      var focusable = [lb.close, lb.source, lb.prev, lb.next].filter(function (n) { return !n.hidden; });
      var first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------- Event delegation for the feed ---------- */
  feedEl.addEventListener('click', function (e) {
    var target = e.target.closest('[data-action]');
    if (!target) return;
    var action = target.dataset.action;

    if (action === 'open-image') {
      showLightbox(target.dataset.gallery, +target.dataset.index, target);
    } else if (action === 'play-youtube') {
      var holder = target.closest('.yt');
      var start = +target.dataset.start;
      var src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(target.dataset.id) +
        '?autoplay=1&rel=0&playsinline=1' + (start ? '&start=' + start : '');
      var frame = el('iframe', {
        class: 'yt-frame', src: src, title: 'YouTube video player', loading: 'lazy',
        allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
        referrerpolicy: 'strict-origin-when-cross-origin', allowfullscreen: true
      });
      holder.replaceChildren(frame);
      frame.focus();
    } else if (action === 'preview-file') {
      toggleFilePreview(target);
    } else if (action === 'copy-link') {
      var link = location.href.split('#')[0] + '#' + target.dataset.post;
      copyText(link).then(function (ok) { toast(ok ? 'Link copied' : 'Could not copy the link'); });
    } else if (action === 'retry') {
      feedEl.textContent = '';
      feedEl.append(el('div', { class: 'state', role: 'status' }, el('p', { class: 'state-title', text: 'Retrieving transmissions' })));
      loadPosts();
    }
  });

  /* Only one audio/video plays at a time. */
  feedEl.addEventListener('play', function (e) {
    var current = e.target;
    if (!(current instanceof HTMLMediaElement)) return;
    feedEl.querySelectorAll('audio, video').forEach(function (m) {
      if (m !== current && !m.paused) m.pause();
    });
  }, true);

  /* ---------- Profile header ---------- */
  function initProfile() {
    var avatar = $('#avatar');
    var fallback = $('#avatarFallback');
    avatar.addEventListener('error', function () { avatar.hidden = true; fallback.hidden = false; }, { once: true });
    avatar.src = githubBlobToRaw(PROFILE_PHOTO) || PROFILE_PHOTO;

    $('#shareBtn').addEventListener('click', function () {
      var url = location.href.split('#')[0];
      if (navigator.share) {
        navigator.share({ title: 'Grey Knights', url: url }).catch(function () { /* cancelled */ });
        return;
      }
      copyText(url).then(function (ok) { toast(ok ? 'Profile link copied' : 'Could not copy the link'); });
    });
  }

  initProfile();
  loadPosts();
})();
