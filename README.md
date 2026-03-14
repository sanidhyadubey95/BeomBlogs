# My Blog — Static GitHub Pages Blog

A clean, modern blog built with plain HTML, CSS, and JavaScript. No build tools, no dependencies to install. Just files.

## Features

- Write posts in **Markdown** with a browser-based drag-and-drop editor
- **Math equations** rendered with KaTeX (LaTeX syntax)
- **Syntax-highlighted code blocks** via highlight.js
- **Embedded interactive visualizations** — drop any HTML/JS file into `visualizations/` and reference it in a post
- Clean editorial design with a serif/mono aesthetic
- Fully static — works on GitHub Pages out of the box

## Getting Started on GitHub Pages

1. **Fork or upload** this repository to your GitHub account
2. Go to **Settings → Pages** in your repo
3. Under "Source", select **Deploy from a branch** → `main` → `/ (root)`
4. Click Save — your blog will be live at `https://yourusername.github.io/repo-name`

## Writing a Post

### Option A: Use the in-browser editor
Open `admin/editor.html` in your browser (or visit `yourdomain/admin/editor.html`).
- Drag blocks from the left panel to build your post
- Fill in the title, date, tags, and excerpt in the right panel
- Click **Generate Files** to get the Markdown content and JSON entry
- Follow the checklist in the modal to save your files

### Option B: Write Markdown directly
1. Create a new `.md` file in `posts/`, e.g. `posts/my-new-post.md`
2. Add front-matter at the top:
   ```
   ---
   title: My New Post
   date: 2025-03-14
   tags: [tag1, tag2]
   ---
   ```
3. Add an entry to `posts/index.json`:
   ```json
   {
     "slug": "my-new-post",
     "title": "My New Post",
     "date": "2025-03-14",
     "tags": ["tag1", "tag2"],
     "excerpt": "A short description.",
     "featured": false
   }
   ```
4. Commit and push

## Adding a Visualization

1. Create a self-contained HTML file (with all JS inline or from CDN)
2. Place it in the `visualizations/` folder
3. In your Markdown post, add:
   ```
   [viz: my-visualization.html]
   ```
   It will render as an interactive iframe.

## Customizing

- **Site name / tagline**: Edit `index.html` hero section
- **About page**: Edit `about.html`
- **Colors & fonts**: Edit `assets/css/main.css` (CSS variables at the top)
- **Navigation links**: Edit the `<nav>` in each HTML file

## File Structure

```
myblog/
├── index.html              ← Homepage
├── archive.html            ← All posts list
├── about.html              ← About page
├── .nojekyll               ← Tells GitHub Pages: no Jekyll
├── posts/
│   ├── index.json          ← Registry of all posts
│   ├── post.html           ← Post viewer (shared by all posts)
│   ├── welcome-to-my-blog.md
│   ├── exploring-the-mandelbrot-set.md
│   └── markdown-and-math.md
├── visualizations/
│   ├── mandelbrot.html     ← Interactive fractal explorer
│   └── sample-chart.html  ← Chart.js bar chart example
├── admin/
│   ├── editor.html         ← Drag-and-drop post editor
│   └── editor.js           ← Editor logic
└── assets/
    ├── css/
    │   ├── main.css        ← Global styles
    │   ├── post.css        ← Post page styles
    │   └── editor.css      ← Editor styles
    └── js/
        ├── posts.js        ← Post registry loader
        ├── main.js         ← Homepage renderer
        ├── archive.js      ← Archive renderer
        └── post-viewer.js  ← Markdown post renderer
```
