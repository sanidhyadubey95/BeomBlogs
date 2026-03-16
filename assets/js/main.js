/**
 * main.js — Homepage post list (horizontal cards with optional cover image)
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
    var url     = BlogPosts.slugToUrl(post.slug);
    var editUrl = '/BeomBlogs/admin/editor.html?edit=' + post.slug;
    var tags    = (post.tags||[]).slice(0,3).map(function(t){
      return '<span class="post-tag">'+t+'</span>';
    }).join('');
    var isFeatured = post.featured && i === 0;

    var wrap = document.createElement('div');
    wrap.className = 'post-card-wrap';
    wrap.style.animationDelay = (i * 0.06) + 's';

    var card = document.createElement('a');
    card.href = url;
    card.className = 'post-card' + (isFeatured ? ' post-card--featured' : '');

    // Left: text content
    var badge = isFeatured
      ? '<span class="post-featured-badge">Featured</span>'
      : '<span class="post-num">'+String(i+1).padStart(2,'0')+'</span>';

    var textHtml =
      '<div class="post-card-text">'+
        '<div class="post-eyebrow">'+badge+tags+'</div>'+
        '<h2 class="post-card-title">'+post.title+'</h2>'+
        '<p class="post-card-excerpt">'+(post.excerpt||'')+'</p>'+
        '<div class="post-card-footer">'+
          '<span class="post-date">'+BlogPosts.formatDate(post.date)+'</span>'+
          '<span class="post-arrow">→</span>'+
        '</div>'+
      '</div>';

    // Right: cover image (optional)
    var coverHtml = '';
    if (post.cover) {
      coverHtml = '<div class="post-card-cover" style="background-image:url(''+post.cover+'')"></div>';
    }

    card.innerHTML = textHtml + coverHtml;

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
