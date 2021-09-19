import * as terminus from './terminus';

const text_shader_unit = 0;
const uniform_binding_point = 0;

const text_vertex_shader_source = `#version 300 es
precision mediump float;
const float glyph_size_x = 6.0;
const float glyph_size_y = 12.0;
const float atlas_stride_x = 8.0;
const float atlas_stride_y = 16.0;
const float atlas_width = 256.0;
const float atlas_height = 128.0;
const float inv_atlas_width = 1.0 / atlas_width;
const float inv_atlas_height = 1.0 / atlas_height;
layout(std140) uniform TextUniforms {
  vec4  viewport;
  vec4  origin;
  vec4  bg_col;
};
uniform sampler2D font_tex;
float remap(float x, float a1, float a2, float b1, float b2) {
  x = (x - a1) / (a2 - a1);
  x = x * (b2 - b1) + b1;
  return x;
}

layout(location = 0) in vec3 glyph_pos;
layout(location = 1) in int  glyph_idx;
layout(location = 2) in vec4 glyph_col;
out vec2  tc_glyph;
out vec4  fg_col;
void main() {
  float corner_x = float((gl_VertexID >> 0) & 1);
  float corner_y = float((gl_VertexID >> 1) & 1);
  float col     = float((glyph_idx >> 0) & 0x1F);
  float row     = float((glyph_idx >> 5) & 0x07);
  float glyph_tcx = (col * atlas_stride_x) + (corner_x * glyph_size_x);
  float glyph_tcy = (row * atlas_stride_y) + (corner_y * glyph_size_y);
  glyph_tcx = remap(glyph_tcx, 0.0, atlas_width,  0.0, 1.0);
  glyph_tcy = remap(glyph_tcy, 0.0, atlas_height, 0.0, 1.0);
  tc_glyph = vec2(glyph_tcx, glyph_tcy);
  fg_col = glyph_col;
  //----------
  float glyph_scale_x = glyph_pos.z;
  float glyph_scale_y = glyph_pos.z;
  float glyph_x = glyph_pos.x;
  float glyph_y = glyph_pos.y;
  float quad_x = glyph_x + (corner_x * glyph_size_x) * glyph_scale_x + origin.x;
  float quad_y = glyph_y + (corner_y * glyph_size_y) * glyph_scale_y + origin.y;
  gl_Position = vec4(remap(quad_x, viewport.x, viewport.z, -1.0,  1.0),
                     remap(quad_y, viewport.y, viewport.w,  1.0, -1.0),
                     0.0,
                     1.0);
}
`;

const text_frag_shader_source = `#version 300 es
precision mediump float;
uniform sampler2D font_tex;

layout(std140) uniform TextUniforms {
  vec4  viewport;
  vec4  origin;
  vec4  bg_col;
};

in vec2 tc_glyph;
in vec4 fg_col;
out vec4 fs_out;
void main() {
  float p = texture(font_tex, tc_glyph).r;
  fs_out = mix(bg_col, fg_col, p);
}
`;

let text_shader: WebGLProgram;

let font_atlas: WebGLTexture;

let text_shader_sampler_location: WebGLUniformLocation;

let uniform_buffer: WebGLBuffer;

let uniform_buffer_data: Float32Array;

let uniform_buffer_values: {
  viewport: Float32Array,
  origin: Float32Array,
  bg_col: Float32Array,
};

let zoom = 0;
let centre = { x: 0, y: 0 };

export function setup(gl: WebGL2RenderingContext): WebGLProgram {
  console.debug("Vertex shader source");
  console.debug(text_vertex_shader_source);

  let text_vertex_shader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(text_vertex_shader, text_vertex_shader_source);
  gl.compileShader(text_vertex_shader);

  if (!gl.getShaderParameter(text_vertex_shader, gl.COMPILE_STATUS)) {
    let info = gl.getShaderInfoLog(text_vertex_shader);
    console.error('Could not compile vert shader WebGL program.', info);
    return;
  }

  let text_frag_shader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(text_frag_shader, text_frag_shader_source);
  gl.compileShader(text_frag_shader);

  if (!gl.getShaderParameter(text_frag_shader, gl.COMPILE_STATUS)) {
    let info = gl.getShaderInfoLog(text_frag_shader);
    console.error('Could not compile frag shader WebGL program.', info);
    return;
  }

  text_shader = gl.createProgram();

  gl.attachShader(text_shader, text_vertex_shader);
  gl.attachShader(text_shader, text_frag_shader);

  gl.linkProgram(text_shader);

  if (!gl.getProgramParameter(text_shader, gl.LINK_STATUS)) {
    let info = gl.getProgramInfoLog(text_shader);
    console.error('Link error', info);
    return;
  }

  font_atlas = terminus.loadTexture(gl);

  text_shader_sampler_location = gl.getUniformLocation(text_shader, "font_tex");
  let text_shader_uniforms_location = gl.getUniformBlockIndex(text_shader, "TextUniforms");

  // 
  gl.uniformBlockBinding(text_shader, text_shader_uniforms_location, uniform_binding_point);

  // uniforms
  uniform_buffer = gl.createBuffer();
  uniform_buffer_data = new Float32Array(12);
  uniform_buffer_values = {
    viewport: uniform_buffer_data.subarray(0, 4),
    origin: uniform_buffer_data.subarray(4, 8),
    bg_col: uniform_buffer_data.subarray(8, 12),
  }

  resetUniforms(gl);
}

function calculateViewport(size: { width: number, height: number }, zoom: number, centre: { x: number, y: number }) {
  // -10 : size.width * 10
  // 10  : 10

  let width = ((zoom + 10) / 20) * (size.width * 10 + 10) + 10;
  let height = (size.height / size.width) * width;

  return [
    -centre.x - width / 2,
    -centre.y - height / 2,
    -centre.x + width / 2,
    -centre.y + height / 2
  ];
}

export function resetUniforms(gl: WebGL2RenderingContext) {
  if(!uniform_buffer_values) {
    return;
  }

  // set uniforms
  uniform_buffer_values.viewport.set(calculateViewport(gl.canvas, zoom, centre));
  uniform_buffer_values.origin.set([0, 0, 1/* unused */, 1 /* unused */]);
  uniform_buffer_values.bg_col.set([0.3, 0.3, 0.3, 1]);

  gl.bindBuffer(gl.UNIFORM_BUFFER, uniform_buffer);
  gl.bufferData(gl.UNIFORM_BUFFER, uniform_buffer_data, gl.DYNAMIC_DRAW);
}

export function zoomUpdate(gl: WebGL2RenderingContext, z: number) {
  let zoom_speed = ((zoom + 10) / 20) * 3.0 + 0.1;
  zoom += z * zoom_speed;

  zoom = Math.min(10, zoom);
  zoom = Math.max(-10, zoom);

  // set uniforms
  uniform_buffer_values.viewport.set(calculateViewport(gl.canvas, zoom, centre));

  gl.bindBuffer(gl.UNIFORM_BUFFER, uniform_buffer);
  gl.bufferData(gl.UNIFORM_BUFFER, uniform_buffer_data, gl.DYNAMIC_DRAW);
}

export function panUpdate(gl: WebGL2RenderingContext, pan: { x: number, y: number }, persist: boolean) {

  let [minx, miny, maxx, maxy] = calculateViewport(gl.canvas, zoom, centre);

  let scale = (maxx - minx) / gl.canvas.width;

  pan.x = pan.x * scale;
  pan.y = pan.y * scale;

  if (persist) {
    centre.x += pan.x;
    centre.y += pan.y;
    pan = { x: 0, y: 0 };
  }

  let calc_centre = { x: centre.x + pan.x, y: centre.y + pan.y };

  // set uniforms
  uniform_buffer_values.viewport.set(calculateViewport(gl.canvas, zoom, calc_centre));

  gl.bindBuffer(gl.UNIFORM_BUFFER, uniform_buffer);
  gl.bufferData(gl.UNIFORM_BUFFER, uniform_buffer_data, gl.DYNAMIC_DRAW);
}

export function bind(gl: WebGL2RenderingContext) {
  // bind font atlas
  gl.useProgram(text_shader);
  gl.activeTexture(gl.TEXTURE0 + text_shader_unit);
  gl.bindTexture(gl.TEXTURE_2D, font_atlas);
  gl.uniform1i(text_shader_sampler_location, text_shader_unit);

  // bind uniforms 
  gl.bindBufferBase(gl.UNIFORM_BUFFER, uniform_binding_point, uniform_buffer);
}
