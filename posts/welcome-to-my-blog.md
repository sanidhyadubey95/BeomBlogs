---
title: Welcome to My Blog
date: 2025-03-14
tags: [meta, introduction]
---

# Welcome to My Blog

Hello and welcome! This is my little corner of the internet where I write about things that fascinate me — mathematics, code, data, and ideas worth exploring.

## How This Blog Works

This site is entirely **static** — no server, no database. Everything is just HTML, CSS, and JavaScript files hosted on GitHub Pages. Posts are written in **Markdown** (like this one) and rendered in the browser.

Here are some things this blog supports out of the box:

- ✅ **Markdown** — write posts in plain text with simple formatting
- ✅ **Math equations** — rendered beautifully with KaTeX
- ✅ **Code highlighting** — syntax-highlighted code blocks
- ✅ **Embedded visualizations** — interactive HTML/JS charts and demos
- ✅ **Custom HTML blocks** — embed any HTML you want

## Writing Math

You can write inline math like $E = mc^2$ or display equations:

$$\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}$$

The Fourier transform is one of the most beautiful results in all of mathematics:

$$\hat{f}(\xi) = \int_{-\infty}^{\infty} f(x)\, e^{-2\pi i x \xi}\, dx$$

## Code Blocks

You can write code with syntax highlighting:

```python
def fibonacci(n):
    """Return the nth Fibonacci number."""
    if n <= 1:
        return n
    a, b = 0, 1
    for _ in range(n - 1):
        a, b = b, a + b
    return b

# Print first 10 Fibonacci numbers
for i in range(10):
    print(f"F({i}) = {fibonacci(i)}")
```

```javascript
// A simple D3.js snippet
const svg = d3.select("body")
  .append("svg")
  .attr("width", 500)
  .attr("height", 300);
```

## Embedding Visualizations

You can embed any HTML visualization by adding a special block in your Markdown:

```
[viz: my-chart.html]
```

This will embed the file `visualizations/my-chart.html` as an interactive iframe in your post. See the **Mandelbrot Set** post for an example!

## Getting Started

To write your own post, head to the [editor](../admin/editor.html) — a browser-based writing tool with a drag-and-drop interface for adding visualization blocks.

Happy writing! 🎉
