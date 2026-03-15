/**
 * archive.js — Archive page grouped by year
 */
(async function() {
  var list = document.getElementById('archive-list');
  if (!list) return;
  var posts = await BlogPosts.load();
  if (!posts.length) {
    list.innerHTML = '<div class="posts-loading">No posts yet.</div>';
    return;
  }
  list.innerHTML = '';
  var byYear = {};
  posts.forEach(function(p) {
    var y = p.date.split('-')[0];
    if (!byYear[y]) byYear[y] = [];
    byYear[y].push(p);
  });
  Object.keys(byYear).sort(function(a,b){ return b-a; }).forEach(function(year) {
    var grp = document.createElement('div');
    grp.className = 'archive-year-group';
    var yh = document.createElement('div');
    yh.className = 'archive-year';
    yh.textContent = year;
    grp.appendChild(yh);
    byYear[year].forEach(function(post) {
      var tags = (post.tags||[]).slice(0,3).map(function(t){
        return '<span class="post-tag">'+t+'</span>';
      }).join('');
      var item = document.createElement('a');
      item.href      = BlogPosts.slugToUrl(post.slug);
      item.className = 'archive-item';
      item.innerHTML =
        '<span class="archive-item-date">'+BlogPosts.formatDate(post.date)+'</span>'+
        '<span class="archive-item-title">'+post.title+'</span>'+
        '<span class="archive-item-tags">'+tags+'</span>';
      grp.appendChild(item);
    });
    list.appendChild(grp);
  });
})();
