# How to Add Your Own Visualizations

This guide explains how to create and embed custom interactive visualizations in your blog posts.

## Step 1: Create your HTML visualization file

Create a self-contained HTML file. Everything should be in one file — inline CSS, inline JS, or loaded from a CDN. Here's a minimal template:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>My Visualization</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: white; font-family: sans-serif; padding: 12px; }
  /* Your styles here */
</style>
</head>
<body>

<!-- Your visualization HTML here -->
<canvas id="myCanvas" width="560" height="400"></canvas>

<script>
  // Your JavaScript here
  // You can load libraries from CDN, e.g.:
  // <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  
  const canvas = document.getElementById('myCanvas');
  // ... your code
</script>
</body>
</html>
```

## Step 2: Save the file

Place your HTML file in the `visualizations/` folder:

```
myblog/
└── visualizations/
    ├── mandelbrot.html        ← existing example
    ├── sample-chart.html      ← existing example  
    └── my-visualization.html  ← your new file
```

## Step 3: Embed it in a post

In your Markdown post, add this line wherever you want the visualization to appear:

```
[viz: my-visualization.html]
```

That's it! The post viewer will embed it as an interactive iframe.

## Popular Libraries You Can Use (via CDN)

### Charts & Graphs
```html
<!-- Chart.js -->
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

<!-- D3.js -->
<script src="https://d3js.org/d3.v7.min.js"></script>

<!-- Plotly -->
<script src="https://cdn.plot.ly/plotly-latest.min.js"></script>

<!-- ApexCharts -->
<script src="https://cdn.jsdelivr.net/npm/apexcharts"></script>
```

### 3D & Animation
```html
<!-- Three.js -->
<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>

<!-- p5.js (creative coding) -->
<script src="https://cdn.jsdelivr.net/npm/p5@1.9.0/lib/p5.min.js"></script>
```

### Math & Science
```html
<!-- math.js -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/mathjs/12.4.0/math.min.js"></script>
```

### Maps
```html
<!-- Leaflet.js -->
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
```

## Tips

- **Keep it self-contained**: All CSS and JS should be inline or loaded from a CDN
- **Make it responsive**: Use `width: 100%` and avoid fixed pixel widths where possible  
- **Transparent backgrounds** work well since the iframe sits on the blog's paper background
- **Test locally** by opening the HTML file directly in a browser before embedding
- The iframe height defaults to **440px** — your visualization should fit well in that space

## Example: Chart.js Bar Chart

```html
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>* { margin:0; padding:0; } body { padding: 10px; }</style>
</head>
<body>
<canvas id="chart"></canvas>
<script>
new Chart(document.getElementById('chart'), {
  type: 'bar',
  data: {
    labels: ['A', 'B', 'C', 'D', 'E'],
    datasets: [{ label: 'Values', data: [12, 19, 3, 5, 8], borderRadius: 4 }]
  },
  options: { responsive: true, plugins: { legend: { display: false } } }
});
</script>
</body>
</html>
```
