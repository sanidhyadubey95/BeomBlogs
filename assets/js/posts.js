/**
 * posts.js — Loads the posts registry (posts/index.json)
 * and exposes a global `BlogPosts` object for other scripts.
 */

window.BlogPosts = {
  _data: null,

  async load() {
    if (this._data) return this._data;
    try {
      // Determine base path (works from both root and /posts/ subdir)
      const res = await fetch('/BeomBlogs/posts/index.json');;
      if (!res.ok) throw new Error('Failed to load posts index');
      this._data = await res.json();
      return this._data;
    } catch (e) {
      console.error('BlogPosts.load error:', e);
      this._data = [];
      return [];
    }
  },

  formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  },

  slugToUrl(slug, fromRoot = true) {
    return fromRoot ? `posts/post.html?post=${slug}` : `post.html?post=${slug}`;
  }
};
