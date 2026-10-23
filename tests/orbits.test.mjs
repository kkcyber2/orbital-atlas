import test from "node:test";
import assert from "node:assert/strict";

import { BODIES, cameraAt, distanceAU, nearestBody, positionAt } from "../js/orbits.js";

test("every body has the fields the renderer needs", () => {
  for (const body of BODIES) {
    assert.equal(typeof body.id, "string");
    assert.equal(typeof body.radius, "number");
    assert.equal(body.colour.length, 3);
  }
});

test("the sun sits at the origin", () => {
  const sun = BODIES.find((b) => b.id === "sun");
  assert.deepEqual(positionAt(sun, 5), [0, 0, 0]);
});

test("a body returns to its start after one full period", () => {
  const earth = BODIES.find((b) => b.id === "earth");
  const start = positionAt(earth, 0);
  const after = positionAt(earth, earth.period);
  for (let i = 0; i < 3; i += 1) assert.ok(Math.abs(start[i] - after[i]) < 1e-9);
});

test("a body is on the opposite side after half a period", () => {
  const earth = BODIES.find((b) => b.id === "earth");
  const start = positionAt(earth, 0);
  const half = positionAt(earth, earth.period / 2);
  assert.ok(Math.abs(start[0] + half[0]) < 1e-9);
});

test("orbital radius matches the declared orbit", () => {
  const mars = BODIES.find((b) => b.id === "mars");
  const [x, y, z] = positionAt(mars, 0.3);
  const radius = Math.hypot(x, z);
  assert.ok(Math.abs(radius - mars.orbit) < 1e-6);
});

test("outer bodies orbit further out than inner ones", () => {
  const mercury = BODIES.find((b) => b.id === "mercury");
  const neptune = BODIES.find((b) => b.id === "neptune");
  assert.ok(neptune.orbit > mercury.orbit);
});

test("camera path is continuous at the ends", () => {
  const start = cameraAt(0);
  const end = cameraAt(1);
  assert.equal(start.eye.length, 3);
  assert.equal(end.eye.length, 3);
  assert.ok(Math.hypot(...end.eye) > Math.hypot(...start.eye));
});

test("camera progress is clamped", () => {
  assert.deepEqual(cameraAt(-5).eye, cameraAt(0).eye);
  assert.deepEqual(cameraAt(5).eye, cameraAt(1).eye);
});

test("nearestBody walks the list in order", () => {
  assert.equal(nearestBody(0).id, "sun");
  assert.equal(nearestBody(1).id, BODIES[BODIES.length - 1].id);
  assert.equal(nearestBody(0.5).id, BODIES[Math.round(0.5 * (BODIES.length - 1))].id);
});

test("distance readout grows with progress", () => {
  assert.equal(distanceAU(0), 0);
  assert.ok(distanceAU(1) > distanceAU(0.5));
  assert.ok(Math.abs(distanceAU(1) - 30.05) < 1e-9);
});
