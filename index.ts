import * as terminus from './terminus';

window.addEventListener("DOMContentLoaded", () => main());

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

const text_shader_unit = 0;
const uniform_binding_point = 0;
const bytes_per_glyph = 20;
const max_glyphs = 20;

const vertex_attrib_offset = {
  pos: 0,
  idx: 12,
  col: 16,
};

function textProgram(gl: WebGL2RenderingContext): WebGLProgram {
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

  let text_shader = gl.createProgram();

  gl.attachShader(text_shader, text_vertex_shader);
  gl.attachShader(text_shader, text_frag_shader);

  gl.linkProgram(text_shader);

  if (!gl.getProgramParameter(text_shader, gl.LINK_STATUS)) {
    let info = gl.getProgramInfoLog(text_shader);
    console.error('Link error', info);
    return;
  }

  return text_shader;
}

function resetStyle(el: HTMLElement) {
  el.style.margin = "0";
  el.style.padding = "0";
  el.style.width = "100%";
  el.style.height = "100%";
}

function resizeCanvas(gl: WebGL2RenderingContext) {
  let canvas = gl.canvas as HTMLCanvasElement;
  let multiplier = window.devicePixelRatio;
  const width = canvas.clientWidth * multiplier | 0;
  const height = canvas.clientHeight * multiplier | 0;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;

    gl.viewport(0,0, width, height);
    return true;
  }
  return false;
}

function main() {
  resetStyle(window.document.body);
  resetStyle(window.document.documentElement);

  let el = window.document.body;

  let canvas = window.document.createElement("canvas");
  el.appendChild(canvas);

  el.style.display = "flex";
  el.style.alignItems = "stretch";
  canvas.style.flexGrow = "1";

  let gl = canvas.getContext("webgl2");

  resizeCanvas(gl);
  window.addEventListener("resize", () => resizeCanvas(gl));

  gl.clearColor(0.3,0.3,0.3,1.0);

  let text_shader = textProgram(gl);
  let text_shader_sampler_location = gl.getUniformLocation(text_shader, "font_tex");
  let text_shader_uniforms_location = gl.getUniformBlockIndex(text_shader, "TextUniforms");

  let font_atlas = terminus.loadTexture(gl);

  // uniforms
  let uniform_buffer = gl.createBuffer();
  let uniform_buffer_data = new Float32Array(12);
  let uniform_buffer_values = {
    viewport: uniform_buffer_data.subarray(0, 4),
    origin: uniform_buffer_data.subarray(4, 8),
    bg_col: uniform_buffer_data.subarray(8, 12),
  }

  // 
  gl.uniformBlockBinding(text_shader, text_shader_uniforms_location, uniform_binding_point);

  // Vertex attibs

  // vec3 glyph_pos;
  // int  glyph_idx;
  // vec4 glyph_col;

  let vertex_attrib_buffer = gl.createBuffer();
  let vertex_attrib_data = new ArrayBuffer(bytes_per_glyph * max_glyphs);

  let vertex_attrib_object = gl.createVertexArray();
  gl.bindVertexArray(vertex_attrib_object);

  gl.bindBuffer(gl.ARRAY_BUFFER, vertex_attrib_buffer);

  gl.enableVertexAttribArray(0);
  gl.enableVertexAttribArray(1);
  gl.enableVertexAttribArray(2);
  
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, bytes_per_glyph, vertex_attrib_offset.pos); // vec3
  gl.vertexAttribIPointer(1, 1, gl.INT, bytes_per_glyph, vertex_attrib_offset.idx); // int
  gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, bytes_per_glyph, vertex_attrib_offset.col); // vec4

  gl.vertexAttribDivisor(0, 1);
  gl.vertexAttribDivisor(1, 1);
  gl.vertexAttribDivisor(2, 1);

  // update vertex attribs
  let put_char = (idx: number, pos:{x:number, y:number}, scale: number, glyph: string, color: number) => {

    let d = new DataView(vertex_attrib_data, idx * bytes_per_glyph, bytes_per_glyph);
    d.setFloat32(vertex_attrib_offset.pos + 0, pos.x, true); // X
    d.setFloat32(vertex_attrib_offset.pos + 4, pos.y, true); // Y
    d.setFloat32(vertex_attrib_offset.pos + 8, scale, true); // scale
    d.setInt32(vertex_attrib_offset.idx, glyph.charCodeAt(0), true); // glyph index
    d.setInt32(vertex_attrib_offset.col, color); // fg color
  }

  put_char(0, {x:0, y:0}, 2, 'J', 0x000000ff);
  put_char(1, {x:12, y:0}, 2, 'a', 0xff0000ff);
  put_char(2, {x:24, y:0}, 2, 'm', 0x000000ff);
  put_char(3, {x:36, y:0}, 2, 'e', 0x000000ff);
  put_char(4, {x:48, y:0}, 2, 's', 0x000000ff);

  console.info("Finished setup");

  // Drawing
  let draw = () => {
    gl.clear(gl.COLOR_BUFFER_BIT);

    // bind font atlas
    gl.useProgram(text_shader);
    gl.activeTexture(gl.TEXTURE0 + text_shader_unit);
    gl.bindTexture(gl.TEXTURE_2D, font_atlas);
    gl.uniform1i(text_shader_sampler_location, text_shader_unit);

    // set uniforms
    uniform_buffer_values.viewport.set([0, 0, canvas.width, canvas.height]);
    uniform_buffer_values.origin.set([canvas.width/2, canvas.height/2, 1/* unused */, 1 /* unused */]);
    uniform_buffer_values.bg_col.set([1, 1, 1, 1]);
    gl.bindBuffer(gl.UNIFORM_BUFFER, uniform_buffer);
    gl.bufferData(gl.UNIFORM_BUFFER, uniform_buffer_data, gl.DYNAMIC_DRAW);

    // bind uniforms 
    gl.bindBufferBase(gl.UNIFORM_BUFFER, uniform_binding_point, uniform_buffer);

    // set vertex attribs
    gl.bindVertexArray(vertex_attrib_object);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertex_attrib_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertex_attrib_data, gl.DYNAMIC_DRAW);

    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, vertex_attrib_data.byteLength / bytes_per_glyph);

    window.requestAnimationFrame(()=>draw());
  };

  draw();
}