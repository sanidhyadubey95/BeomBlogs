/**
 * main.js — Homepage post grid renderer
 */

(async () => {
  const grid = document.getElementById('posts-grid');
  if (!grid) return;

  const posts = await BlogPosts.load();

  if (!posts.length) {
    grid.innerHTML = '<div class="posts-loading">No posts yet. <a href="admin/editor.html">Write your first post →</a></div>';
    return;
  }

  grid.innerHTML = '';

  posts.forEach((post, i) => {
    const isFeatured = post.featured && i === 0;
    const url = BlogPosts.slugToUrl(post.slug, true);
    const tags = (post.tags || []).slice(0, 2).map(t =>
      `<span class="post-tag">${t}</span>`
    ).join('');

    const card = document.createElement('a');
    card.href = url;
    card.className = 'post-card' + (isFeatured ? ' featured' : '');
    card.style.animationDelay = `${i * 0.06}s`;

    if (isFeatured) {
      card.innerHTML = `
        <div class="post-card-main">
          <span class="post-number">Featured</span>
          <h2 class="post-card-title">${post.title}</h2>
          <p class="post-card-excerpt">${post.excerpt || ''}</p>
        </div>
        <div class="post-card-aside">
          <div class="post-meta">
            <span class="post-date">${BlogPosts.formatDate(post.date)}</span>
            ${tags}
          </div>
          <p class="post-arrow" style="margin-top:auto;padding-top:2rem;">→</p>
        </div>
      `;
    } else {
      const num = String(i + 1).padStart(2, '0');
      card.innerHTML = `
        <span class="post-number">${num}</span>
        <h2 class="post-card-title">${post.title}</h2>
        <p class="post-card-excerpt">${post.excerpt || ''}</p>
        <div class="post-meta">
          <span class="post-date">${BlogPosts.formatDate(post.date)}</span>
          ${tags}
          <span class="post-arrow" style="margin-left:auto;">→</span>
        </div>
      `;
    }

    grid.appendChild(card);
  });
})();
