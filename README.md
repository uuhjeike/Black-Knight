# Black Knight

Static profile site for GitHub Pages. No build step, no dependencies.

## Files

- `index.html`, `style.css`, `script.js` — the site
- `profile photo.jpg` — your profile photo (already in the repo)
- `posts.txt` — your posts (already in the repo)

Upload `index.html`, `style.css` and `script.js` to the root of `uuhjeike/Black-Knight`, then turn on GitHub Pages (Settings → Pages → Deploy from branch → `main` / root).

## Writing posts

Posts are separated by a line that contains only `-`.

```
-
First post text
https://github.com/uuhjeike/Black-Knight/blob/main/photo1.jpg
-
Second post
https://www.youtube.com/watch?v=VIDEO_ID
-
```

- Text lines and link lines can be mixed in any order.
- A line that is only a link becomes media. The type is detected automatically:
  images, YouTube (watch, youtu.be, Shorts, embed, live), mp4/webm, audio, files (pdf, zip, docx…), and normal links.
- Normal GitHub `blob` links are converted to raw links automatically; a small "Source" link keeps the original.
- Links inside a text line become clickable links.
- Posts show in the same order as the file (top of the file = top of the feed).
- Photos and videos show at their original size (never stretched) and in full colour.
  Only the page chrome and profile photo are black and white; hover or tap the profile photo for colour.

## Changing links

Edit the `CONFIG` block at the top of `script.js`.
