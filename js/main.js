// Scroll handling and bootstrap.
import { Scene } from "./scene.js";
import { BODIES, cameraAt, distanceAU, nearestBody } from "./orbits.js";

const canvas = document.getElementById("stage");
const track = document.getElementById("track");
const panels = Array.from(document.querySelectorAll(".panel"));
const railList = document.getElementById("rail-list");
const readoutBody = document.getElementById("readout-body");
const readoutDistance = document.getElementById("readout-distance");
const hint = document.getElementById("hint");

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let scene;
try {
  scene = new Scene(canvas);
} catch (error) {
  // A clear message beats a blank page when WebGL is unavailable.
  document.body.insertAdjacentHTML(
    "beforeend",
    `<div style="position:fixed;inset:0;display:grid;place-items:center;z-index:9;
      background:#05070d;color:#8b95a8;font:14px/1.6 ui-monospace,monospace;padding:32px;text-align:center">
      <p>This experience needs WebGL.<br>${String(error.message || error)}</p></div>`,
  );
  throw error;
}
scene.reducedMotion = reducedMotion;

// Build the rail from the same data the scene uses, so they cannot drift apart.
BODIES.forEach((body, index) => {
  const item = document.createElement("li");
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = body.name;
  button.addEventListener("click", () => {
    const target = (index / (BODIES.length - 1)) * (track.scrollHeight - window.innerHeight);
    window.scrollTo({ top: target, behavior: reducedMotion ? "auto" : "smooth" });
  });
  item.appendChild(button);
  railList.appendChild(item);
});

const railButtons = Array.from(railList.querySelectorAll("button"));

function progress() {
  const max = track.scrollHeight - window.innerHeight;
  if (max <= 0) return 0;
  return Math.max(0, Math.min(1, window.scrollY / max));
}

let activeIndex = -1;

function update() {
  const p = progress();
  scene.progress = p;

  const index = Math.round(p * (BODIES.length - 1));
  if (index !== activeIndex) {
    activeIndex = index;
    panels.forEach((panel, i) => {
      panel.dataset.active = String(i === index);
    });
    railButtons.forEach((button, i) => {
      button.setAttribute("aria-current", String(i === index));
    });
    const body = nearestBody(p);
    readoutBody.textContent = body.name;
    readoutDistance.textContent = `${distanceAU(p).toFixed(2)} AU`;
  }

  if (window.scrollY > 40) hint.dataset.hidden = "true";
}

let ticking = false;
window.addEventListener(
  "scroll",
  () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      update();
      ticking = false;
    });
  },
  { passive: true },
);

window.addEventListener("resize", () => scene.resize());

let last = performance.now();
function frame(now) {
  const delta = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!reducedMotion) scene.time += delta;
  scene.render(cameraAt(scene.progress));
  requestAnimationFrame(frame);
}

update();
requestAnimationFrame(frame);
