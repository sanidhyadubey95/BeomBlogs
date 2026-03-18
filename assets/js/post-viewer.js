/**
 * post-viewer.js — glass tile, edit button, dark mode toggle (icon only)
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

  // Inject dark toggle immediately so it shows during load
  injectDarkToggle();

  // 1. Load metadata
  let meta = null;
  try {
    const res  = await fetch(BASE + '/posts/index.json');
    const list = await res.json();
    meta = list.find(p => p.slug === slug);
  } catch (e) { console.error('index.json:', e); }

  // 2. Load Markdown
  let markdown = '';
  try {
    const res = await fetch(BASE + '/posts/' + slug + '.md');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    markdown = await res.text();
  } catch (e) {
    article.innerHTML =
      '<div class="post-glass"><div class="post-header">' +
        '<div class="post-header-meta"><a href="' + BASE + '/index.html" class="post-back-link">Home</a></div>' +
        '<h1 class="post-title">Post not found</h1>' +
      '</div><div class="post-body">' +
        '<p>Could not load <code>' + slug + '.md</code>.</p>' +
        '<p><a href="' + BASE + '/index.html">\u2190 Back to home</a></p>' +
      '</div></div>';
    return;
  }

  // 3. Strip front-matter
  let body = markdown.replace(/^---[\s\S]*?---\n?/, '').trim();

  // 4. Viz placeholders
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

  // 6. Replace viz placeholders
  Object.keys(vizMap).forEach(function(key) {
    var fname = vizMap[key];
    html = html.replace('<p>' + key + '</p>',
      '<div class="viz-embed">' +
        '<div class="viz-embed-label">Interactive Visualization</div>' +
        '<iframe src="' + BASE + '/visualizations/' + fname + '" style="height:440px;" frameborder="0" allowfullscreen loading="lazy" title="' + fname + '"></iframe>' +
        '<p class="viz-embed-caption">' + fname + '</p>' +
      '</div>');
  });

  // 7. Build page
  var tagsHtml = (meta && meta.tags)
    ? meta.tags.map(function(t){ return '<span class="post-tag">' + t + '</span>'; }).join('') : '';
  var dateHtml = meta ? '<span class="post-date">' + formatDate(meta.date) + '</span>' : '';
  var title    = meta ? meta.title : slug;
  var editUrl  = BASE + '/admin/editor.html?edit=' + slug;

  article.innerHTML =
    '<div class="post-glass">' +
      '<div class="post-header">' +
        '<div class="post-header-meta">' +
          '<a href="' + BASE + '/index.html" class="post-back-link">Home</a>' +
          '<div class="post-header-right">' +
            '<div class="post-header-tags">' + tagsHtml + '</div>' +
            '<a href="' + editUrl + '" class="post-edit-btn-inline">\u270e Edit post</a>' +
          '</div>' +
        '</div>' +
        '<h1 class="post-title">' + title + '</h1>' +
        dateHtml +
      '</div>' +
      '<div class="post-body" id="post-body">' + html + '</div>' +
    '</div>';

  document.title = title + ' \u2014 BeomBlogs';

  // 8. Syntax highlighting
  if (typeof hljs !== 'undefined') {
    document.querySelectorAll('pre code').forEach(function(block) {
      hljs.highlightElement(block);
    });
  }

  // 9. KaTeX
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
    return d.toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
  }

  function injectDarkToggle() {
    var saved = localStorage.getItem('beom-reader-dark');
    if (saved === 'true') document.body.classList.add('dark-reader');

    var btn = document.createElement('button');
    btn.className = 'dark-mode-toggle';
    btn.setAttribute('aria-label', 'Toggle reading mode');

    function updateIcon() {
      btn.textContent = document.body.classList.contains('dark-reader') ? '\u2600\uFE0F' : '\uD83C\uDF19';
    }
    updateIcon();

    btn.addEventListener('click', function() {
      var isDark = document.body.classList.toggle('dark-reader');
      localStorage.setItem('beom-reader-dark', isDark);
      updateIcon();
    });

    document.body.appendChild(btn);
  }
})();
