# Orbital Atlas

A scroll-driven 3D solar-system explorer. Scrolling does not move the page — it moves
the **camera** through the system, so the scrollbar becomes a timeline.

## Why raw WebGL

No Three.js, no CDN, no build step. The whole renderer is about 400 lines of hand-written
WebGL with custom GLSL shaders, which means the page opens from `file://` with no
network access and nothing to install. The matrix maths lives in its own module so it
can be unit-tested in Node.

## What it does

* **Scroll scrubs the camera.** A single normalised scroll value drives the camera
  along a spline through the system; the page never actually scrolls.
* **Orbital mechanics, not decoration.** Each body's position is computed from its
  orbital period, so the planets are where they should be relative to each other.
* **Custom shaders.** Bodies are lit by a point light at the sun with a rim term;
  the starfield is a procedural hash in the fragment shader, not a texture.
* **Depth of field by distance.** Far bodies fade and desaturate, which reads as
  atmosphere without a post-processing pass.
* **Reduced-motion aware.** `prefers-reduced-motion` freezes the animation and keeps
  the scroll scrub, so the site is still usable.

## Run it

```bash
# no build step, no dependencies
python3 -m http.server 8000
# then open http://localhost:8000
```

Or just open `index.html` directly in a browser.

## Tests

```bash
node --test tests/
```

The suite covers the matrix/vector maths — projection, look-at, perspective, matrix
inversion and the orbital position function — which is where a 3D renderer actually
goes wrong.

## Structure

```
index.html          markup and the scroll track
css/style.css       layout, typography, overlay panels
js/mat4.js          matrix and vector maths (unit-tested)
js/orbits.js        orbital mechanics (unit-tested)
js/scene.js         WebGL setup, shaders, draw loop
js/main.js          scroll handling and bootstrap
tests/              node --test suites
```

## License

MIT — see [LICENSE](LICENSE).

Built by **KK (Conan Sultan Khan)** · <kkdev9715@gmail.com>
[https://github.com/kkcyber2](https://github.com/kkcyber2) · LinkedIn: _add profile URL_
