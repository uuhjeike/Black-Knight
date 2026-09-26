/* ===========================================================
   BLACK KNIGHT — profile logic
   - Reads posts.txt, split on lines that are just "-"
   - Renders posts in small batches so a huge file with lots of
     photos/videos doesn't stall the page on first load
   - Lazy-loads media, only plays video/audio once visible
   - Lightweight CSS-driven 3D tilt + parallax (no 3D engine,
     kept deliberately cheap so it stays fast on a big feed)
=========================================================== */

const BATCH_SIZE = 6;
const DRAFTS_KEY = 'blackknight_drafts';
let allPosts = [];
let renderedCount = 0;

async function init() {
  await loadPosts();
  renderStoredDrafts();
  setupComposer();
  setupTilt();
  setupParallax();
}

async function loadPosts() {
  const feed = document.getElementById('feed');
  try {
    const res = await fetch('posts.txt', { cache: 'no-store' });
    if (!res.ok) throw new Error('missing file');
    const text = await res.text();

    allPosts = text
      .split(/^\s*-\s*$/m)
      .map(block => block.trim())
      .filter(Boolean);

    document.getElementById('postCount').textContent = allPosts.length;

    if (allPosts.length === 0) {
      feed.innerHTML = '<p class="status">No posts yet. Add one to posts.txt using two lines with just a dash: -</p>';
      return;
    }

    feed.innerHTML = '';
    renderNextBatch();
    observeSentinel();
  } catch (err) {
    feed.innerHTML = `<p class="status">Couldn't load posts.txt. If you opened this file by double-clicking it, browsers block that — run a local server (e.g. <code>python3 -m http.server</code>) or host the folder, then reload.</p>`;
  }
}

function renderNextBatch() {
  const feed = document.getElementById('feed');
  const next = allPosts.slice(renderedCount, renderedCount + BATCH_SIZE);
  if (next.length === 0) return;

  const frag = document.createDocumentFragment();
  next.forEach(block => {
    const article = document.createElement('article');
    article.className = 'post';
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    article.innerHTML = lines.map(renderLine).join('');
    frag.appendChild(article);
  });
  feed.appendChild(frag);
  renderedCount += next.length;

  // Fade each new post in once it scrolls into view
  const newPosts = feed.querySelectorAll('.post:not(.observed)');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.05 });

  newPosts.forEach(post => {
    post.classList.add('observed');
    revealObserver.observe(post);
  });
}

// Infinite scroll: load the next batch only once the sentinel
// at the bottom of the feed comes near the viewport.
function observeSentinel() {
  const sentinel = document.getElementById('sentinel');
  const loader = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && renderedCount < allPosts.length) {
        renderNextBatch();
      }
    });
  }, { rootMargin: '600px 0px' });
  loader.observe(sentinel);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Turn one line of posts.txt into the right kind of HTML: a
// photo, an audio player, a video player, a YouTube embed, a
// plain link, or plain text.
function renderLine(line) {
  const urlMatch = line.match(/^(https?:\/\/\S+)$/i);

  if (urlMatch) {
    const url = urlMatch[1];

    const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);
    if (yt) {
      return `<div class="embed"><iframe src="https://www.youtube-nocookie.com/embed/${yt[1]}" loading="lazy" allowfullscreen></iframe></div>`;
    }

    if (/\.(jpe?g|png|gif|webp)$/i.test(url)) {
      return `<img src="${url}" alt="" loading="lazy" decoding="async">`;
    }

    if (/\.(mp3|wav|ogg|m4a)$/i.test(url)) {
      return `<audio controls preload="none" src="${url}"></audio>`;
    }

    if (/\.(mp4|webm|mov)$/i.test(url)) {
      return `<video controls preload="metadata" playsinline src="${url}"></video>`;
    }

    return `<p><a href="${url}" target="_blank" rel="noopener">${escapeHtml(url)}</a></p>`;
  }

  return `<p>${escapeHtml(line)}</p>`;
}

// ---- 3D tilt on the profile photo (pointer-driven, GPU-cheap) ----
function setupTilt() {
  const frame = document.getElementById('photoFrame');
  const hero = document.getElementById('hero');
  if (!frame || !hero || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  hero.addEventListener('pointermove', (e) => {
    const rect = hero.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    frame.style.setProperty('--tilt-y', `${x * 14}deg`);
    frame.style.setProperty('--tilt-x', `${y * -14}deg`);
  });
  hero.addEventListener('pointerleave', () => {
    frame.style.setProperty('--tilt-x', `0deg`);
    frame.style.setProperty('--tilt-y', `0deg`);
  });
}

// ---- Subtle parallax on the hero background while scrolling ----
function setupParallax() {
  const bg = document.getElementById('heroBg');
  const hero = document.getElementById('hero');
  if (!bg || !hero || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const offset = Math.min(window.scrollY * 0.25, 120);
      bg.style.setProperty('--parallax', `${offset}px`);
      ticking = false;
    });
  }, { passive: true });
}

// ---- Composer: post from the browser, saved locally, copied for posts.txt ----

function getDrafts() {
  try {
    return JSON.parse(localStorage.getItem(DRAFTS_KEY)) || [];
  } catch {
    return [];
  }
}

function saveDrafts(drafts) {
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
}

function renderStoredDrafts() {
  const drafts = getDrafts();
  drafts.slice().reverse().forEach(text => prependDraftPost(text, false));
  if (drafts.length > 0) {
    document.getElementById('postCount').textContent = allPosts.length + drafts.length;
  }
}

function prependDraftPost(text, isNew) {
  const feed = document.getElementById('feed');
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const article = document.createElement('article');
  article.className = 'post draft visible';
  article.innerHTML = `
    <span class="draft-tag">Draft — not in posts.txt yet</span>
    <button class="draft-dismiss" type="button">Remove</button>
    ${lines.map(renderLine).join('')}
  `;

  article.querySelector('.draft-dismiss').addEventListener('click', () => {
    const drafts = getDrafts().filter(t => t !== text);
    saveDrafts(drafts);
    article.remove();
    document.getElementById('postCount').textContent = allPosts.length + getDrafts().length;
  });

  const firstChild = feed.querySelector('.status') ? null : feed.firstChild;
  feed.insertBefore(article, firstChild);

  if (isNew) {
    document.getElementById('postCount').textContent = allPosts.length + getDrafts().length;
  }
}

function setupComposer() {
  const input = document.getElementById('composerInput');
  const button = document.getElementById('composerButton');
  if (!input || !button) return;

  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 220) + 'px';
  });

  button.addEventListener('click', async () => {
    const text = input.value.trim();
    if (!text) return;

    button.disabled = true;

    const drafts = getDrafts();
    drafts.unshift(text);
    saveDrafts(drafts);
    prependDraftPost(text, true);

    const formatted = `${text}\n-\n`;
    const copied = await copyToClipboard(formatted);

    showToast(copied
      ? 'Posted. Copied — paste this at the very top of posts.txt to make it permanent.'
      : 'Posted here. Copy failed — select the text yourself to add it to posts.txt.');

    input.value = '';
    input.style.height = 'auto';
    button.disabled = false;
  });
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const temp = document.createElement('textarea');
      temp.value = text;
      temp.style.position = 'fixed';
      temp.style.opacity = '0';
      document.body.appendChild(temp);
      temp.select();
      document.execCommand('copy');
      document.body.removeChild(temp);
      return true;
    } catch {
      return false;
    }
  }
}

let toastTimer;
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 4200);
}

init();
