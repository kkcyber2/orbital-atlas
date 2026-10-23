// The WebGL renderer: shaders, buffers and the draw loop.
import {
  identity, invert, lookAt, multiply, perspective, rotationY, scaling, translation,
} from "./mat4.js";
import { BODIES, positionAt } from "./orbits.js";

const VERTEX_SHADER = `
attribute vec3 aPosition;
attribute vec3 aNormal;
uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;
uniform mat3 uNormalMatrix;
varying vec3 vNormal;
varying vec3 vWorld;
void main() {
  vec4 world = uModel * vec4(aPosition, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(uNormalMatrix * aNormal);
  gl_Position = uProjection * uView * world;
}
`;

const FRAGMENT_SHADER = `
precision highp float;
varying vec3 vNormal;
varying vec3 vWorld;
uniform vec3 uColour;
uniform vec3 uLightPos;
uniform vec3 uCameraPos;
uniform float uEmissive;
void main() {
  vec3 toLight = normalize(uLightPos - vWorld);
  vec3 toEye = normalize(uCameraPos - vWorld);
  float diffuse = max(dot(vNormal, toLight), 0.0);
  // Rim term: brightens the silhouette, which reads as atmosphere.
  float rim = pow(1.0 - max(dot(vNormal, toEye), 0.0), 2.5);
  vec3 lit = uColour * (0.12 + diffuse * 0.95) + uColour * rim * 0.55;
  lit = mix(lit, uColour, uEmissive);
  // Distance fade keeps the far bodies from competing with the near ones.
  float depth = clamp(length(uCameraPos - vWorld) / 120.0, 0.0, 1.0);
  lit = mix(lit, vec3(0.02, 0.03, 0.06), depth * 0.75);
  gl_FragColor = vec4(lit, 1.0);
}
`;

const STAR_VERTEX = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.999, 1.0);
}
`;

const STAR_FRAGMENT = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
void main() {
  vec2 grid = floor(vUv * 420.0);
  float star = hash(grid);
  // Only the top slice of the hash becomes a star, so the field stays sparse.
  float brightness = smoothstep(0.9975, 1.0, star);
  float twinkle = 0.75 + 0.25 * sin(uTime * 2.0 + star * 40.0);
  vec3 tint = mix(vec3(0.7, 0.8, 1.0), vec3(1.0, 0.9, 0.75), hash(grid + 7.0));
  gl_FragColor = vec4(tint * brightness * twinkle, 1.0);
}
`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`shader compile failed: ${log}`);
  }
  return shader;
}

function program(gl, vertexSource, fragmentSource) {
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`program link failed: ${gl.getProgramInfoLog(prog)}`);
  }
  return prog;
}

// A UV sphere, generated rather than loaded.
export function sphereMesh(segments = 32, rings = 24) {
  const positions = [];
  const normals = [];
  const indices = [];
  for (let ring = 0; ring <= rings; ring += 1) {
    const phi = (ring / rings) * Math.PI;
    for (let segment = 0; segment <= segments; segment += 1) {
      const theta = (segment / segments) * Math.PI * 2;
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.cos(phi);
      const z = Math.sin(phi) * Math.sin(theta);
      positions.push(x, y, z);
      normals.push(x, y, z);
    }
  }
  for (let ring = 0; ring < rings; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const a = ring * (segments + 1) + segment;
      const b = a + segments + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices),
  };
}

// A ring in the XZ plane, for Saturn.
export function ringMesh(segments = 96, inner = 1.4, outer = 2.2) {
  const positions = [];
  const normals = [];
  const indices = [];
  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    positions.push(c * inner, 0, s * inner);
    positions.push(c * outer, 0, s * outer);
    normals.push(0, 1, 0, 0, 1, 0);
  }
  for (let i = 0; i < segments; i += 1) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices),
  };
}

export class Scene {
  constructor(canvas) {
    const gl = canvas.getContext("webgl", { antialias: true, alpha: false });
    if (!gl) throw new Error("WebGL is not available in this browser");
    this.gl = gl;
    this.canvas = canvas;
    this.progress = 0;
    this.time = 0;
    this.reducedMotion = false;

    this.bodyProgram = program(gl, VERTEX_SHADER, FRAGMENT_SHADER);
    this.starProgram = program(gl, STAR_VERTEX, STAR_FRAGMENT);

    this.sphere = this.upload(sphereMesh());
    this.ring = this.upload(ringMesh());
    this.starQuad = this.uploadQuad();

    this.uniforms = {
      projection: gl.getUniformLocation(this.bodyProgram, "uProjection"),
      view: gl.getUniformLocation(this.bodyProgram, "uView"),
      model: gl.getUniformLocation(this.bodyProgram, "uModel"),
      normalMatrix: gl.getUniformLocation(this.bodyProgram, "uNormalMatrix"),
      colour: gl.getUniformLocation(this.bodyProgram, "uColour"),
      lightPos: gl.getUniformLocation(this.bodyProgram, "uLightPos"),
      cameraPos: gl.getUniformLocation(this.bodyProgram, "uCameraPos"),
      emissive: gl.getUniformLocation(this.bodyProgram, "uEmissive"),
    };
    this.starUniforms = {
      time: gl.getUniformLocation(this.starProgram, "uTime"),
    };

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.clearColor(0.02, 0.027, 0.05, 1.0);
  }

  upload(mesh) {
    const gl = this.gl;
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW);
    const normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.normals, gl.STATIC_DRAW);
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
    return { positionBuffer, normalBuffer, indexBuffer, count: mesh.indices.length };
  }

  uploadQuad() {
    const gl = this.gl;
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    return { buffer, count: 3 };
  }

  resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.floor(this.canvas.clientWidth * ratio);
    const height = Math.floor(this.canvas.clientHeight * ratio);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.gl.viewport(0, 0, width, height);
    return { width, height };
  }

  drawStars() {
    const gl = this.gl;
    gl.useProgram(this.starProgram);
    gl.disable(gl.DEPTH_TEST);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.starQuad.buffer);
    const location = gl.getAttribLocation(this.starProgram, "aPosition");
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1f(this.starUniforms.time, this.time);
    gl.drawArrays(gl.TRIANGLES, 0, this.starQuad.count);
    gl.enable(gl.DEPTH_TEST);
  }

  drawBody(mesh, model, colour, emissive, view, projection, camera) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.positionBuffer);
    const positionLocation = gl.getAttribLocation(this.bodyProgram, "aPosition");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normalBuffer);
    const normalLocation = gl.getAttribLocation(this.bodyProgram, "aNormal");
    gl.enableVertexAttribArray(normalLocation);
    gl.vertexAttribPointer(normalLocation, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);

    gl.uniformMatrix4fv(this.uniforms.model, false, model);
    gl.uniformMatrix3fv(this.uniforms.normalMatrix, false, normalMatrix(model));
    gl.uniform3fv(this.uniforms.colour, colour);
    gl.uniform3fv(this.uniforms.lightPos, [0, 0, 0]);
    gl.uniform3fv(this.uniforms.cameraPos, camera);
    gl.uniform1f(this.uniforms.emissive, emissive);
    gl.uniformMatrix4fv(this.uniforms.view, false, view);
    gl.uniformMatrix4fv(this.uniforms.projection, false, projection);

    gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
  }

  render(camera) {
    const gl = this.gl;
    const { width, height } = this.resize();
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    this.drawStars();

    const projection = perspective((55 * Math.PI) / 180, width / Math.max(1, height), 0.1, 400);
    const view = lookAt(camera.eye, camera.target, [0, 1, 0]);

    gl.useProgram(this.bodyProgram);
    const years = this.reducedMotion ? 0.35 : this.time / 12;

    for (const body of BODIES) {
      const [x, y, z] = positionAt(body, years);
      const spin = this.reducedMotion ? 0 : this.time * 0.15;
      const model = multiply(
        translation(x, y, z),
        multiply(rotationY(spin), scaling(body.radius, body.radius, body.radius)),
      );
      const emissive = body.id === "sun" ? 1.0 : 0.0;
      this.drawBody(this.sphere, model, body.colour, emissive, view, projection, camera.eye);

      if (body.id === "saturn") {
        const ringModel = multiply(
          translation(x, y, z),
          multiply(rotationY(spin * 0.4), scaling(body.radius, body.radius, body.radius)),
        );
        this.drawBody(this.ring, ringModel, [0.78, 0.72, 0.58], 0.0, view, projection, camera.eye);
      }
    }
  }
}

// Upper-left 3x3 of a model matrix, for transforming normals.
function normalMatrix(model) {
  const inverse = invert(model);
  if (!inverse) return new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  // Transpose of the inverse's upper-left 3x3.
  return new Float32Array([
    inverse[0], inverse[4], inverse[8],
    inverse[1], inverse[5], inverse[9],
    inverse[2], inverse[6], inverse[10],
  ]);
}
