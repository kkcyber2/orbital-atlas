import test from "node:test";
import assert from "node:assert/strict";

import {
  cross, dot, identity, invert, lookAt, multiply, normalize, perspective,
  rotationY, scaling, subtract, transformPoint, translation,
} from "../js/mat4.js";

const close = (a, b, epsilon = 1e-5) => Math.abs(a - b) < epsilon;

test("identity leaves a point unchanged", () => {
  const p = transformPoint(identity(), [3, -2, 5]);
  assert.ok(close(p[0], 3) && close(p[1], -2) && close(p[2], 5));
});

test("multiplying by identity is a no-op", () => {
  const m = translation(1, 2, 3);
  const product = multiply(m, identity());
  for (let i = 0; i < 16; i += 1) assert.ok(close(product[i], m[i]));
});

test("translation moves a point", () => {
  const p = transformPoint(translation(10, 20, 30), [1, 1, 1]);
  assert.ok(close(p[0], 11) && close(p[1], 21) && close(p[2], 31));
});

test("scaling scales a point", () => {
  const p = transformPoint(scaling(2, 3, 4), [1, 1, 1]);
  assert.ok(close(p[0], 2) && close(p[1], 3) && close(p[2], 4));
});

test("rotationY turns the x axis toward -z", () => {
  const p = transformPoint(rotationY(Math.PI / 2), [1, 0, 0]);
  assert.ok(close(p[0], 0) && close(p[2], -1));
});

test("matrix multiplication is associative", () => {
  const a = translation(1, 2, 3);
  const b = scaling(2, 2, 2);
  const c = rotationY(0.7);
  const left = multiply(multiply(a, b), c);
  const right = multiply(a, multiply(b, c));
  for (let i = 0; i < 16; i += 1) assert.ok(close(left[i], right[i]));
});

test("invert undoes a transform", () => {
  const m = multiply(translation(4, -2, 7), scaling(2, 3, 0.5));
  const inverse = invert(m);
  assert.ok(inverse !== null);
  const p = transformPoint(multiply(inverse, m), [5, 6, 7]);
  assert.ok(close(p[0], 5) && close(p[1], 6) && close(p[2], 7));
});

test("invert returns null for a singular matrix", () => {
  assert.equal(invert(scaling(0, 1, 1)), null);
});

test("perspective maps the near plane to -1 and the far plane to 1", () => {
  const p = perspective(Math.PI / 2, 1, 1, 100);
  const near = transformPoint(p, [0, 0, -1]);
  const far = transformPoint(p, [0, 0, -100]);
  assert.ok(close(near[2] / near[3], -1, 1e-4));
  assert.ok(close(far[2] / far[3], 1, 1e-4));
});

test("lookAt places the eye at the origin of view space", () => {
  const view = lookAt([0, 0, 10], [0, 0, 0], [0, 1, 0]);
  const p = transformPoint(view, [0, 0, 10]);
  assert.ok(close(p[0], 0) && close(p[1], 0) && close(p[2], 0));
});

test("lookAt puts the target down the negative z axis", () => {
  const view = lookAt([0, 0, 10], [0, 0, 0], [0, 1, 0]);
  const p = transformPoint(view, [0, 0, 0]);
  assert.ok(close(p[2], -10));
});

test("vector helpers", () => {
  assert.deepEqual(subtract([5, 5, 5], [1, 2, 3]), [4, 3, 2]);
  assert.deepEqual(cross([1, 0, 0], [0, 1, 0]), [0, 0, 1]);
  assert.equal(dot([1, 2, 3], [4, 5, 6]), 32);
  const n = normalize([0, 3, 0]);
  assert.ok(close(n[1], 1));
});

test("normalize of a zero vector is safe", () => {
  assert.deepEqual(normalize([0, 0, 0]), [0, 0, 0]);
});
