/**
 * post-viewer.js — fixed for GitHub Pages /BeomBlogs/
 */

(async () => {
  const article = document.getElementById('post-article');
  const params  = new URLSearchParams(window.location.search);
  const slug    = params.get('post');
  const BASE    = '/BeomBlogs';

  if (!slug) {
    article.innerHTML = '<div class="post-body" style="padding:4rem 2rem;"><p>No post specified. <a href="' + BASE + '/index.html">Back to home</a></p></div>';
    return;
  }

  // 1. Load metadata
  let meta = null;
  try {
    const res  = await fetch(BASE + '/posts/index.json');
    const list = await res.json();
    meta = list.find(p => p.slug === slug);
  } catch (e) {
    console.error('index.json load failed:', e);
  }

  // 2. Load Markdown file
  let markdown = '';
  try {
    const res = await fetch(BASE + '/posts/' + slug + '.md');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    markdown = await res.text();
  } catch (e) {
    article.innerHTML =
      '<div class="post-header">' +
        '<div class="post-header-meta"><a href="' + BASE + '/index.html" class="post-back-link">Home</a></div>' +
        '<h1 class="post-title">Post not found</h1>' +
      '</div>' +
      '<div class="post-body">' +
        '<p>Could not load <code>' + slug + '.md</code>.</p>' +
        '<p>Make sure the file exists in your <code>posts/</code> folder and the slug in <code>index.json</code> matches the filename exactly.</p>' +
        '<p><a href="' + BASE + '/index.html">← Back to home</a></p>' +
      '</div>';
    return;
  }

  // 3. Strip YAML front-matter
  let body = markdown.replace(/^---[\s\S]*?---\n?/, '').trim();

  // 4. Pre-process [viz: filename.html] → placeholder
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
    html = '<p style="color:red;">marked.js not loaded. Check internet connection.</p><pre>' + body + '</pre>';
  }

  // 6. Replace viz placeholders with iframes
  Object.keys(vizMap).forEach(function(key) {
    var fname = vizMap[key];
    var iframe =
      '<div class="viz-embed">' +
        '<div class="viz-embed-label">Interactive Visualization</div>' +
        '<iframe src="' + BASE + '/visualizations/' + fname + '" style="height:440px;" frameborder="0" allowfullscreen loading="lazy" title="' + fname + '"></iframe>' +
        '<p class="viz-embed-caption">' + fname + '</p>' +
      '</div>';
    html = html.replace('<p>' + key + '</p>', iframe);
  });

  // 7. Build page HTML
  var tagsHtml = (meta && meta.tags)
    ? meta.tags.map(function(t){ return '<span class="post-tag">' + t + '</span>'; }).join('')
    : '';
  var dateHtml = meta ? '<span class="post-date">' + formatDate(meta.date) + '</span>' : '';
  var title    = meta ? meta.title : slug;

  article.innerHTML =
    '<div class="post-header">' +
      '<div class="post-header-meta">' +
        '<a href="' + BASE + '/index.html" class="post-back-link">Home</a>' +
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

  // 9. KaTeX math rendering
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
