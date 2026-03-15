/**
 * main.js — Homepage post grid renderer with Edit buttons
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
    var url     = BlogPosts.slugToUrl(post.slug, true);
    var editUrl = '/BeomBlogs/admin/editor.html?edit=' + post.slug;
    var tags    = (post.tags || []).slice(0, 2).map(function(t){
      return '<span class="post-tag">' + t + '</span>';
    }).join('');

    // Wrapper div (grid item, holds card + edit button)
    var wrap = document.createElement('div');
    wrap.className = 'post-card-wrap' + (isFeatured ? ' featured-wrap' : '');
    wrap.style.animationDelay = (i * 0.06) + 's';

    // Card link
    var card = document.createElement('a');
    card.href = url;
    card.className = 'post-card' + (isFeatured ? ' featured' : '');

    var coverEl = post.cover
      ? '<div style="background:url(' + post.cover + ') center/cover;height:120px;border-radius:4px;margin-bottom:0.75rem;"></div>'
      : '';

    if (isFeatured) {
      card.innerHTML =
        (post.cover ? '<div style="background:url(' + post.cover + ') center/cover;height:180px;border-radius:4px;margin-bottom:1rem;grid-column:1/-1;"></div>' : '') +
        '<div class="post-card-main">' +
          '<span class="post-number">Featured</span>' +
          '<h2 class="post-card-title">' + post.title + '</h2>' +
          '<p class="post-card-excerpt">' + (post.excerpt || '') + '</p>' +
        '</div>' +
        '<div class="post-card-aside">' +
          '<div class="post-meta"><span class="post-date">' + BlogPosts.formatDate(post.date) + '</span>' + tags + '</div>' +
          '<p class="post-arrow" style="margin-top:auto;padding-top:2rem;">→</p>' +
        '</div>';
    } else {
      card.innerHTML =
        coverEl +
        '<span class="post-number">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<h2 class="post-card-title">' + post.title + '</h2>' +
        '<p class="post-card-excerpt">' + (post.excerpt || '') + '</p>' +
        '<div class="post-meta">' +
          '<span class="post-date">' + BlogPosts.formatDate(post.date) + '</span>' + tags +
          '<span class="post-arrow" style="margin-left:auto;">→</span>' +
        '</div>';
    }

    // Edit button — appears on hover, doesn't follow card link
    var editBtn = document.createElement('a');
    editBtn.href      = editUrl;
    editBtn.className = 'post-edit-btn';
    editBtn.title     = 'Edit this post in the editor';
    editBtn.textContent = '✎ Edit';
    editBtn.addEventListener('click', function(e){ e.stopPropagation(); });

    wrap.appendChild(card);
    wrap.appendChild(editBtn);
    grid.appendChild(wrap);
  });
})();
