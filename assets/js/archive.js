/**
 * archive.js — Renders the full archive list
 */

(async () => {
  const list = document.getElementById('archive-list');
  if (!list) return;

  const posts = await BlogPosts.load();

  if (!posts.length) {
    list.innerHTML = '<div class="posts-loading">No posts yet. <a href="admin/editor.html">Write your first post →</a></div>';
    return;
  }

  list.innerHTML = '';

  // Group by year
  const byYear = {};
  posts.forEach(post => {
    const year = post.date.split('-')[0];
    if (!byYear[year]) byYear[year] = [];
    byYear[year].push(post);
  });

  Object.keys(byYear).sort((a, b) => b - a).forEach(year => {
    const yearHeader = document.createElement('div');
    yearHeader.style.cssText = 'font-family:var(--font-mono);font-size:0.7rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--ink-light);padding:1.5rem 0 0.5rem;';
    yearHeader.textContent = year;
    list.appendChild(yearHeader);

    byYear[year].forEach((post, i) => {
      const tags = (post.tags || []).slice(0, 3).map(t =>
        `<span class="post-tag">${t}</span>`
      ).join('');

      const item = document.createElement('a');
      item.href = BlogPosts.slugToUrl(post.slug, true);
      item.className = 'archive-item';
      item.style.animationDelay = `${i * 0.04}s`;
      item.innerHTML = `
        <span class="archive-item-date">${BlogPosts.formatDate(post.date)}</span>
        <span class="archive-item-title">${post.title}</span>
        <span class="archive-item-tags">${tags}</span>
      `;
      list.appendChild(item);
    });
  });
})();
