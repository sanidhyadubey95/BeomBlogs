/**
 * main.js — Homepage post list (horizontal cards with optional cover image)
 */
(async function() {
  var grid = document.getElementById('posts-grid');
  if (!grid) return;

  var posts = await BlogPosts.load();
  if (!posts.length) {
    grid.innerHTML = '<div class="posts-loading">No posts yet. <a href="admin/editor.html">Write your first post \u2192</a></div>';
    return;
  }

  grid.innerHTML = '';

  posts.forEach(function(post, i) {
    var isFeatured = post.featured && i === 0;
    var url     = BlogPosts.slugToUrl(post.slug);
    var editUrl = '/BeomBlogs/admin/editor.html?edit=' + post.slug;
    var tags    = (post.tags || []).slice(0, 3).map(function(t) {
      return '<span class="post-tag">' + t + '</span>';
    }).join('');

    var wrap = document.createElement('div');
    wrap.className = 'post-card-wrap';
    wrap.style.animationDelay = (i * 0.06) + 's';

    var card = document.createElement('a');
    card.href = url;
    card.className = 'post-card' + (isFeatured ? ' post-card--featured' : '');

    var badge = isFeatured
      ? '<span class="post-featured-badge">Featured</span>'
      : '<span class="post-num">' + String(i + 1).padStart(2, '0') + '</span>';

    /* Text block — left side */
    var textHtml =
      '<div class="post-card-text">' +
        '<div class="post-eyebrow">' + badge + tags + '</div>' +
        '<h2 class="post-card-title">' + post.title + '</h2>' +
        '<p class="post-card-excerpt">' + (post.excerpt || '') + '</p>' +
        '<div class="post-card-footer">' +
          '<span class="post-date">' + BlogPosts.formatDate(post.date) + '</span>' +
          '<span class="post-arrow">\u2192</span>' +
        '</div>' +
      '</div>';

    /* Cover image — right side (only when post.cover is set) */
    var coverHtml = post.cover
      ? '<div class="post-card-cover" style="background-image:url(\'' + post.cover + '\')"></div>'
      : '';

    card.innerHTML = textHtml + coverHtml;

    /* Edit button */
    var editBtn = document.createElement('a');
    editBtn.href = editUrl;
    editBtn.className = 'post-edit-btn';
    editBtn.title = 'Edit this post';
    editBtn.textContent = '\u270e Edit';
    editBtn.addEventListener('click', function(e) { e.stopPropagation(); });

    wrap.appendChild(card);
    wrap.appendChild(editBtn);
    grid.appendChild(wrap);
  });
})();
