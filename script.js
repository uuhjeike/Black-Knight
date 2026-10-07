// ---- Settings ----
const CONFIG = {
  name: "Black Knight",
  postsFile: "posts.txt",          // same repo, served by GitHub Pages
  avatar: "photo.jpg",
  repo: "uuhjeike/Black-Knight",   // used to turn GitHub file links into playable media
  branch: "main",
  pageSize: 15                     // posts shown per batch (posts.txt is large)
};

const feed = document.getElementById("feed");
const state = document.getElementById("state");

document.getElementById("name").textContent = CONFIG.name;
document.getElementById("avatar").src = CONFIG.avatar;

// A line containing only "-" separates posts
function parsePosts(text) {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n[ \t]*-[ \t]*(?:\n|$)/)
    .map(p => p.trim())
    .filter(Boolean);
}

const VIDEO = /\.(mp4|webm|mov|m4v)(\?.*)?$/i;
const IMAGE = /\.(jpe?g|png|gif|webp|avif)(\?.*)?$/i;
const URL_RE = /https?:\/\/[^\s<>"']+/g;

// github.com/<repo>/blob/<branch>/<path>  ->  relative path on the Pages site
function toMediaSrc(url) {
  const blob = "https://github.com/" + CONFIG.repo + "/blob/" + CONFIG.branch + "/";
  if (url.startsWith(blob)) return decodeURI(url.slice(blob.length));
  return url.replace("github.com/", "github.com/").replace("/blob/", "/raw/");
}

function renderBody(body) {
  const wrap = document.createElement("div");
  wrap.className = "post-body";

  // A post that is only a media link becomes a player or image
  const single = body.trim();
  if (/^https?:\/\/\S+$/.test(single)) {
    if (VIDEO.test(single)) {
      const v = document.createElement("video");
      v.controls = true;
      v.preload = "metadata";
      v.playsInline = true;
      v.src = toMediaSrc(single);
      wrap.className = "post-media";
      wrap.appendChild(v);
      return wrap;
    }
    if (IMAGE.test(single)) {
      const i = document.createElement("img");
      i.loading = "lazy";
      i.alt = "";
      i.src = toMediaSrc(single);
      wrap.className = "post-media";
      wrap.appendChild(i);
      return wrap;
    }
  }

  // Otherwise text, with links made clickable (built with DOM nodes, so text stays safe)
  let last = 0;
  for (const m of body.matchAll(URL_RE)) {
    if (m.index > last) wrap.appendChild(document.createTextNode(body.slice(last, m.index)));
    const a = document.createElement("a");
    a.href = m[0];
    a.textContent = m[0];
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    wrap.appendChild(a);
    last = m.index + m[0].length;
  }
  if (last < body.length) wrap.appendChild(document.createTextNode(body.slice(last)));
  return wrap;
}

function renderPost(body) {
  const post = document.createElement("article");
  post.className = "post";

  const head = document.createElement("div");
  head.className = "post-head";
  const img = document.createElement("img");
  img.src = CONFIG.avatar;
  img.alt = "";
  const strong = document.createElement("strong");
  strong.textContent = CONFIG.name;
  head.append(img, strong);

  post.append(head, renderBody(body));
  return post;
}

let posts = [];
let shown = 0;
const more = document.createElement("button");
more.className = "more";
more.textContent = "Load more";
more.addEventListener("click", showNext);

function showNext() {
  const end = Math.min(shown + CONFIG.pageSize, posts.length);
  const frag = document.createDocumentFragment();
  for (; shown < end; shown++) frag.appendChild(renderPost(posts[shown]));
  feed.insertBefore(frag, more);
  more.hidden = shown >= posts.length;
}

async function loadPosts() {
  try {
    const res = await fetch(CONFIG.postsFile, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    posts = parsePosts(await res.text());

    feed.innerHTML = "";
    if (!posts.length) {
      feed.innerHTML = '<p class="state">No posts yet. Add text to posts.txt and separate posts with a line containing only "-".</p>';
      return;
    }
    feed.appendChild(more);
    showNext();

    // Auto-load the next batch when the button scrolls into view
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(es => {
        if (es[0].isIntersecting && !more.hidden) showNext();
      }, { rootMargin: "600px" }).observe(more);
    }
  } catch (err) {
    state.textContent = "Could not load " + CONFIG.postsFile + ". If you opened the file directly, use GitHub Pages or a local server.";
  }
}

loadPosts();
