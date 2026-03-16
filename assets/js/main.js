/**
 * main.js — Homepage post grid
 */
(async function() {
  var grid = document.getElementById('posts-grid');
  if (!grid) return;
  var posts = await BlogPosts.load();
  if (!posts.length) {
    grid.innerHTML = '<div class="posts-loading">No posts yet. <a href="admin/editor.html">Write your first post →</a></div>';
    return;
  }
  grid.innerHTML = '';
  posts.forEach(function(post, i) {
    var isFeatured = post.featured && i === 0;
    var url     = BlogPosts.slugToUrl(post.slug);
    var editUrl = '/BeomBlogs/admin/editor.html?edit=' + post.slug;
    var tags    = (post.tags||[]).slice(0,3).map(function(t){
      return '<span class="post-tag">'+t+'</span>';
    }).join('');

    var wrap = document.createElement('div');
    wrap.className = 'post-card-wrap' + (isFeatured ? ' featured-wrap' : '');
    wrap.style.animationDelay = (i * 0.06) + 's';

    var card = document.createElement('a');
    card.href = url;
    card.className = 'post-card';

    var eyebrow = '<div class="post-eyebrow">'
      + (isFeatured ? '<span class="post-featured-badge">Featured</span>' : '<span class="post-num">'+String(i+1).padStart(2,'0')+'</span>')
      + tags + '</div>';

    var footer = '<div class="post-card-footer">'
      + '<span class="post-date">'+BlogPosts.formatDate(post.date)+'</span>'
      + '<span class="post-arrow">→</span>'
      + '</div>';

    if (isFeatured) {
      card.innerHTML =
        '<div>' + eyebrow +
          '<h2 class="post-card-title">'+post.title+'</h2>' +
          '<p class="post-card-excerpt">'+(post.excerpt||'')+'</p>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;">' +
          footer +
        '</div>';
    } else {
      card.innerHTML = eyebrow
        + '<h2 class="post-card-title">'+post.title+'</h2>'
        + '<p class="post-card-excerpt">'+(post.excerpt||'')+'</p>'
        + footer;
    }

    var editBtn = document.createElement('a');
    editBtn.href      = editUrl;
    editBtn.className = 'post-edit-btn';
    editBtn.title     = 'Edit this post';
    editBtn.textContent = '✎ Edit';
    editBtn.addEventListener('click', function(e){ e.stopPropagation(); });

    wrap.appendChild(card);
    wrap.appendChild(editBtn);
    grid.appendChild(wrap);
  });
})();
