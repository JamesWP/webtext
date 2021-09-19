
// vec3 glyph_pos;
// int  glyph_idx;
// vec4 glyph_col;

const bytes_per_glyph = 20;
//export const max_glyphs = 100000;
export const max_glyphs = 10000;

const vertex_attrib_offset = {
  pos: 0,
  idx: 12,
  col: 16,
};

export let vertex_attrib_buffer: WebGLBuffer;
export let vertex_attrib_data: ArrayBuffer;
export let vertex_attrib_object: WebGLVertexArrayObject;

export function setup(gl: WebGL2RenderingContext) {
  vertex_attrib_buffer = gl.createBuffer();
  vertex_attrib_data = new ArrayBuffer(bytes_per_glyph * max_glyphs);

  vertex_attrib_object = gl.createVertexArray();
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
}

export function bind(gl: WebGL2RenderingContext) {
  gl.bindVertexArray(vertex_attrib_object);
  gl.bindBuffer(gl.ARRAY_BUFFER, vertex_attrib_buffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertex_attrib_data, gl.DYNAMIC_DRAW);
}

// update vertex attribs
export function put_char(idx: number, pos: { x: number, y: number }, scale: number, glyph: string, color: number) {

  if(idx >= max_glyphs) {
    console.warn("not enough space for glyph at idx", idx, "max glyphs", max_glyphs);
    return;
  }
  let d = new DataView(vertex_attrib_data, idx * bytes_per_glyph, bytes_per_glyph);
  d.setFloat32(vertex_attrib_offset.pos + 0, pos.x, true); // X
  d.setFloat32(vertex_attrib_offset.pos + 4, pos.y, true); // Y
  d.setFloat32(vertex_attrib_offset.pos + 8, scale, true); // scale
  d.setInt32(vertex_attrib_offset.idx, glyph.charCodeAt(0), true); // glyph index
  d.setInt32(vertex_attrib_offset.col, color); // fg color
}

export function put_string(idx: number, pos: { x: number, y: number }, scale: number, text: string, color: number) {
  Array.from(text).forEach(char => {
    put_char(idx, pos, scale, char, color);
    idx += 1;
    pos.x += 6 * scale;
  });
}
