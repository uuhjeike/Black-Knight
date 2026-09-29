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
let allPosts = [];
let renderedCount = 0;

// One shared observer for the whole page, not one per batch — a
// feed with hundreds of batches would otherwise spin up hundreds
// of separate IntersectionObserver instances, which adds needless
// overhead the more posts have loaded.
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0 });

async function init() {
  await loadPosts();
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
    try {
      article.innerHTML = renderPost(block);
    } catch (err) {
      // One malformed post should never take the rest of the feed
      // down with it — show a small notice for just this post and
      // keep going.
      console.error('Skipped a post that failed to render:', err);
      article.innerHTML = '<p class="status">This post couldn\u2019t be displayed.</p>';
    }
    frag.appendChild(article);
  });
  wireGalleries(frag);
  feed.appendChild(frag);
  // Always advance by the full batch size, even if a post in it
  // failed above. If this didn't advance, a single bad post would
  // make the loader retry the exact same batch forever the next
  // time it scrolls into view — which looks like "only a couple
  // of posts load and nothing after that ever shows up."
  renderedCount += next.length;

  // Fade each new post in once any part of it scrolls into view.
  // threshold: 0 fires the moment even one pixel is visible — a
  // higher threshold (e.g. 0.05) would require 5% of the post's
  // full height to be on-screen at once, which a very long post
  // (a full story, hundreds of lines) can be too tall to ever
  // reach, leaving it stuck invisible at opacity: 0 forever.
  const newPosts = feed.querySelectorAll('.post:not(.observed)');
  newPosts.forEach(post => {
    post.classList.add('observed');
    revealObserver.observe(post);
  });
}

// Make each gallery's ‹ › buttons step the carousel one photo/
// video at a time (mouse/trackpad users). Touch users just swipe,
// since the CSS hides the buttons on touch devices.
function wireGalleries(root) {
  root.querySelectorAll('.gallery-wrap').forEach(wrap => {
    const track = wrap.querySelector('.gallery');
    const prev = wrap.querySelector('.gallery-prev');
    const next = wrap.querySelector('.gallery-next');
    if (!track || !prev || !next) return;

    const step = (dir) => {
      const width = track.clientWidth || track.getBoundingClientRect().width;
      track.scrollBy({ left: dir * width, behavior: 'smooth' });
    };
    prev.addEventListener('click', () => step(-1));
    next.addEventListener('click', () => step(1));
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

// A github.com/.../blob/... link is GitHub's HTML page for
// *viewing* a file, not the file itself — an <img>/<video>/<audio>
// tag pointed at it just gets a webpage back and fails to render.
// Rewrite it to the matching raw.githubusercontent.com URL, which
// serves the actual file bytes. Also strips a trailing "?raw=true"
// that GitHub's own "download raw" link sometimes adds.
function normalizeGithubUrl(url) {
  const m = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+?)(?:\?raw=true)?$/i);
  if (m) {
    const [, user, repo, branch, path] = m;
    return `https://raw.githubusercontent.com/${user}/${repo}/${branch}/${path}`;
  }
  return url;
}

// Turn one URL into the right kind of HTML: a photo, an audio
// player, a video player, a YouTube embed, or a plain link.
function resolveUrlMedia(rawUrl) {
  const url = normalizeGithubUrl(rawUrl);
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);
  if (yt) {
    return {
      type: 'embed',
      html: `<div class="embed"><iframe src="https://www.youtube-nocookie.com/embed/${yt[1]}" loading="lazy" allowfullscreen></iframe></div>`
    };
  }

  if (/\.(jpe?g|png|gif|webp)$/i.test(url)) {
    return { type: 'image', html: `<img src="${url}" alt="" loading="lazy" decoding="async">` };
  }

  if (/\.(mp3|wav|ogg|m4a)$/i.test(url)) {
    return { type: 'audio', html: `<audio controls preload="none" src="${url}"></audio>` };
  }

  if (/\.(mp4|webm|mov)$/i.test(url)) {
    return { type: 'video', html: `<video controls preload="metadata" playsinline src="${url}"></video>` };
  }

  return { type: 'link', html: `<p><a href="${url}" target="_blank" rel="noopener">${escapeHtml(url)}</a></p>` };
}

// Turn one whole post block into HTML. Walks the post line by
// line and keeps a running buffer of photo/video URLs — any mix
// of images and videos, whether they're several on one line or
// spread across several separate lines — and groups everything
// in that buffer into a single gallery grid as soon as it hits a
// line that isn't pure media (text, a link, audio, an embed) or
// the end of the post. That means text can sit before, after, or
// between galleries, and a post can have more than one gallery if
// photos/videos are separated by text.
function renderPost(block) {
  const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
  const isUrl = t => /^https?:\/\/\S+$/i.test(t);
  let html = '';
  let mediaBuffer = [];

  const flushMedia = () => {
    if (mediaBuffer.length === 0) return;
    if (mediaBuffer.length === 1) {
      html += mediaBuffer[0].html;
    } else {
      html += `<div class="gallery-wrap">` +
        `<button type="button" class="gallery-btn gallery-prev" aria-label="Previous photo">‹</button>` +
        `<div class="gallery">${mediaBuffer.map(m => m.html).join('')}</div>` +
        `<button type="button" class="gallery-btn gallery-next" aria-label="Next photo">›</button>` +
      `</div>`;
    }
    mediaBuffer = [];
  };

  lines.forEach(line => {
    const tokens = line.split(/\s+/).filter(Boolean);

    if (tokens.length > 0 && tokens.every(isUrl)) {
      const resolved = tokens.map(resolveUrlMedia);
      const allMedia = resolved.every(r => r.type === 'image' || r.type === 'video');

      if (allMedia) {
        mediaBuffer.push(...resolved);
        return;
      }

      // A link/audio/embed on this line — close out any gallery
      // in progress first, then render this line's items as-is.
      flushMedia();
      html += resolved.map(r => r.html).join('');
      return;
    }

    // Plain text line — close out any gallery in progress, then
    // add the text as its own paragraph.
    flushMedia();
    html += `<p>${escapeHtml(line)}</p>`;
  });

  flushMedia();
  return html;
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

init();
