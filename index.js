window.addEventListener("DOMContentLoaded", function () { return main(); });
var text_vertex_shader_source = "#version 300 es\nprecision mediump float;\nconst float glyph_size_x = 6.0;\nconst float glyph_size_y = 12.0;\nconst float atlas_stride_x = 8.0;\nconst float atlas_stride_y = 16.0;\nconst float atlas_width = 256.0;\nconst float atlas_height = 128.0;\nconst float inv_atlas_width = 1.0 / atlas_width;\nconst float inv_atlas_height = 1.0 / atlas_height;\nlayout(std140) uniform TextUniforms {\n  vec4  viewport;\n  vec4  origin;\n  vec4  bg_col;\n};\nuniform sampler2D font_tex;\nfloat remap(float x, float a1, float a2, float b1, float b2) {\n  x = (x - a1) / (a2 - a1);\n  x = x * (b2 - b1) + b1;\n  return x;\n}\n\nlayout(location = 0) in vec3 glyph_pos;\nlayout(location = 1) in int  glyph_idx;\nlayout(location = 2) in vec4 glyph_col;\nout vec2  tc_glyph;\nout vec4  fg_col;\nvoid main() {\n  float corner_x = float((gl_VertexID >> 0) & 1);\n  float corner_y = float((gl_VertexID >> 1) & 1);\n  float col     = float((glyph_idx >> 0) & 0x1F);\n  float row     = float((glyph_idx >> 5) & 0x07);\n  float glyph_tcx = (col * atlas_stride_x) + (corner_x * glyph_size_x);\n  float glyph_tcy = (row * atlas_stride_y) + (corner_y * glyph_size_y);\n  glyph_tcx = remap(glyph_tcx, 0.0, atlas_width,  0.0, 1.0);\n  glyph_tcy = remap(glyph_tcy, 0.0, atlas_height, 0.0, 1.0);\n  tc_glyph = vec2(glyph_tcx, glyph_tcy);\n  fg_col = glyph_col;\n  //----------\n  float glyph_scale_x = glyph_pos.z;\n  float glyph_scale_y = glyph_pos.z;\n  float glyph_x = glyph_pos.x;\n  float glyph_y = glyph_pos.y;\n  float quad_x = glyph_x + (corner_x * glyph_size_x) * glyph_scale_x + origin.x;\n  float quad_y = glyph_y + (corner_y * glyph_size_y) * glyph_scale_y + origin.y;\n  gl_Position = vec4(remap(quad_x, viewport.x, viewport.z, -1.0,  1.0),\n                     remap(quad_y, viewport.y, viewport.w,  1.0, -1.0),\n                     0.0,\n                     1.0);\n}\n";
var text_frag_shader_source = "#version 300 es\nprecision mediump float;\nuniform sampler2D font_tex;\n\nlayout(std140) uniform TextUniforms {\n  vec4  viewport;\n  vec4  origin;\n  vec4  bg_col;\n};\n\nin vec2 tc_glyph;\nin vec4 fg_col;\nout vec4 fs_out;\nvoid main() {\n  float p = texture(font_tex, tc_glyph).r;\n  fs_out = mix(bg_col, fg_col, p);\n}\n";
function resetStyle(el) {
    el.style.margin = "0";
    el.style.padding = "0";
    el.style.width = "100%";
    el.style.height = "100%";
}
function main() {
    resetStyle(window.document.body);
    resetStyle(window.document.documentElement);
    var el = window.document.body;
    var canvas = window.document.createElement("canvas");
    el.appendChild(canvas);
    el.style.display = "flex";
    el.style.alignItems = "stretch";
    canvas.style.flexGrow = "1";
    var gl = canvas.getContext("webgl2");
    console.debug("Vertex shader source");
    console.debug(text_vertex_shader_source);
    var text_vertex_shader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(text_vertex_shader, text_vertex_shader_source);
    gl.compileShader(text_vertex_shader);
    if (!gl.getShaderParameter(text_vertex_shader, gl.COMPILE_STATUS)) {
        var info = gl.getShaderInfoLog(text_vertex_shader);
        console.error('Could not compile vert shader WebGL program.', info);
        return;
    }
    console.debug("Fragment shader source");
    console.debug(text_frag_shader_source);
    var text_frag_shader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(text_frag_shader, text_frag_shader_source);
    gl.compileShader(text_frag_shader);
    if (!gl.getShaderParameter(text_frag_shader, gl.COMPILE_STATUS)) {
        var info = gl.getShaderInfoLog(text_frag_shader);
        console.error('Could not compile frag shader WebGL program.', info);
        return;
    }
    var text_shader = gl.createProgram();
    gl.attachShader(text_shader, text_vertex_shader);
    gl.attachShader(text_shader, text_frag_shader);
    gl.linkProgram(text_shader);
    if (!gl.getProgramParameter(text_shader, gl.LINK_STATUS)) {
        var info = gl.getProgramInfoLog(text_shader);
        console.error('Link error', info);
        return;
    }
}
