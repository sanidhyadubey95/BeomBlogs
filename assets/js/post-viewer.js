/**
 * post-viewer.js
 * Loads a Markdown post and renders it with:
 *   - marked.js  (Markdown to HTML)
 *   - KaTeX      (LaTeX math)
 *   - highlight.js (code syntax)
 *   - [viz: filename.html] -> iframe embeds
 */

(async () => {
  const article = document.getElementById('post-article');
  const params  = new URLSearchParams(window.location.search);
  const slug    = params.get('post');

  if (!slug) {
    article.innerHTML = '<div class="post-body" style="padding:4rem 2rem;"><p>No post specified. <a href="../index.html">Back to home</a></p></div>';
    return;
  }

  // 1. Load metadata
  let meta = null;
  try {
    const res  = await fetch('/BeomBlogs/posts/index.json');
    const list = await res.json();
    meta = list.find(p => p.slug === slug);
  } catch (_) {}

  // 2. Load Markdown
  let markdown = '';
  try {
    const res = await fetch('/BeomBlogs/posts/' + slug + '.md');
    if (!res.ok) throw new Error('not found');
    markdown = await res.text();
  } catch (_) {
    article.innerHTML = '<div class="post-body" style="padding:4rem 2rem;"><h2>Post not found</h2><p><a href="../index.html">Back to home</a></p></div>';
    return;
  }

  // 3. Strip YAML front-matter
  let body = markdown.replace(/^---[\s\S]*?---\n?/, '').trim();

  // 4. Pre-process [viz: filename.html] placeholders
  const vizMap = {};
  let vizIdx = 0;
  body = body.replace(/\[viz:\s*([^\]]+)\]/g, function(_, fname) {
    const key = 'VIZ_PLACEHOLDER_' + vizIdx++;
    vizMap[key] = fname.trim();
    return '<p>' + key + '</p>';
  });

  // 5. Render Markdown
  let html = '';
  if (typeof marked !== 'undefined') {
    marked.setOptions({ breaks: false, gfm: true });
    html = marked.parse(body);
  } else {
    html = '<p style="color:red;">marked.js not loaded.</p><pre>' + body + '</pre>';
  }

  // 6. Swap viz placeholders with iframes
  Object.keys(vizMap).forEach(function(key) {
    var fname = vizMap[key];
    var iframe = '<div class="viz-embed">' +
      '<div class="viz-embed-label">Interactive Visualization</div>' +
      '<iframe src="../visualizations/' + fname + '" style="height:440px;" frameborder="0" allowfullscreen loading="lazy" title="' + fname + '"></iframe>' +
      '<p class="viz-embed-caption">' + fname + '</p>' +
      '</div>';
    html = html.replace('<p>' + key + '</p>', iframe);
  });

  // 7. Build article HTML
  var tagsHtml = (meta && meta.tags)
    ? meta.tags.map(function(t){ return '<span class="post-tag">' + t + '</span>'; }).join('')
    : '';
  var dateHtml = meta ? '<span class="post-date">' + formatDate(meta.date) + '</span>' : '';
  var title    = meta ? meta.title : slug;

  article.innerHTML =
    '<div class="post-header">' +
      '<div class="post-header-meta">' +
        '<a href="../index.html" class="post-back-link">Home</a>' +
        '<div class="post-header-tags">' + tagsHtml + '</div>' +
      '</div>' +
      '<h1 class="post-title">' + title + '</h1>' +
      dateHtml +
    '</div>' +
    '<div class="post-body" id="post-body">' + html + '</div>';

  document.title = title + ' — My Blog';

  // 8. Syntax highlighting
  if (typeof hljs !== 'undefined') {
    document.querySelectorAll('pre code').forEach(function(block) {
      hljs.highlightElement(block);
    });
  }

  // 9. KaTeX math
  if (typeof renderMathInElement !== 'undefined') {
    renderMathInElement(document.getElementById('post-body'), {
      delimiters: [
        { left: '$$', right: '$$', display: true  },
        { left: '$',  right: '$',  display: false },
        { left: '\\[', right: '\\]', display: true  },
        { left: '\\(', right: '\\)', display: false }
      ],
      throwOnError: false
    });
  }

  function formatDate(dateStr) {
    var d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }
})();
