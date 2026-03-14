---
title: Writing Math in Markdown
date: 2025-03-05
tags: [tutorial, mathematics, markdown]
---

# Writing Math in Markdown

This blog renders mathematical equations beautifully using **KaTeX** — a fast, accurate LaTeX renderer. Here's a guide to writing math in your posts.

## Inline Math

Wrap equations in single dollar signs for **inline math**:

- Write `$E = mc^2$` to get $E = mc^2$
- Write `$\sin^2\theta + \cos^2\theta = 1$` to get $\sin^2\theta + \cos^2\theta = 1$
- Write `$\sqrt{2}$` to get $\sqrt{2}$

## Display Math

Wrap equations in double dollar signs for **display math** (centered, on its own line):

$$\sum_{n=1}^{\infty} \frac{1}{n^2} = \frac{\pi^2}{6}$$

This is the Basel problem, solved by Euler in 1734.

## The Gaussian Integral

One of the most beautiful results in analysis:

$$\int_{-\infty}^{\infty} e^{-x^2} \, dx = \sqrt{\pi}$$

## Maxwell's Equations

In differential form, Maxwell's equations describe all of classical electromagnetism:

$$\nabla \cdot \mathbf{E} = \frac{\rho}{\varepsilon_0}$$

$$\nabla \cdot \mathbf{B} = 0$$

$$\nabla \times \mathbf{E} = -\frac{\partial \mathbf{B}}{\partial t}$$

$$\nabla \times \mathbf{B} = \mu_0 \mathbf{J} + \mu_0 \varepsilon_0 \frac{\partial \mathbf{E}}{\partial t}$$

## Matrices and Linear Algebra

$$A = \begin{pmatrix} a_{11} & a_{12} & \cdots & a_{1n} \\ a_{21} & a_{22} & \cdots & a_{2n} \\ \vdots & \vdots & \ddots & \vdots \\ a_{m1} & a_{m2} & \cdots & a_{mn} \end{pmatrix}$$

The **eigenvalue equation**:

$$A\mathbf{v} = \lambda \mathbf{v}$$

## Probability & Statistics

The **normal distribution** probability density function:

$$f(x) = \frac{1}{\sigma\sqrt{2\pi}} \exp\!\left(-\frac{(x-\mu)^2}{2\sigma^2}\right)$$

**Bayes' Theorem**:

$$P(A \mid B) = \frac{P(B \mid A) \cdot P(A)}{P(B)}$$

## Quick Reference

| What you write | What you get |
|---|---|
| `$x^2$` | $x^2$ |
| `$x_n$` | $x_n$ |
| `$\frac{a}{b}$` | $\frac{a}{b}$ |
| `$\sqrt{x}$` | $\sqrt{x}$ |
| `$\sum_{i=0}^n$` | $\sum_{i=0}^n$ |
| `$\int_a^b$` | $\int_a^b$ |
| `$\infty$` | $\infty$ |
| `$\alpha, \beta, \gamma$` | $\alpha, \beta, \gamma$ |

For a full reference, see the [KaTeX supported functions list](https://katex.org/docs/supported.html).
