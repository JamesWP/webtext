import * as text from './text';
import * as program from './program';

const URL = "https://raw.githubusercontent.com/torvalds/linux/master/init/main.c";

window.addEventListener("DOMContentLoaded", () => main().then(() => { console.log("Finished") }));

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

    gl.viewport(0, 0, width, height);
    return true;
  }
  return false;
}

function setup(): WebGL2RenderingContext {
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

  return gl;
}

async function getLines(url: string) {
  let response = await window.fetch(url, {
    headers: {
      'Accept': 'application/text'
    }
  });
  if (!response.ok) {
    return ["Error loading content"];
  }
  let text = await response.text();

  return text.split("\n").map(line => line.replace(/\t/g, "        "));
}

async function main() {
  let gl = setup();

  gl.clearColor(0.3, 0.3, 0.3, 1.0);

  program.setup(gl);
  text.setup(gl);

  let content = await getLines(URL);

  let line_number = 0;
  let total_chars = 0;

  for (let line of content) {
    if (total_chars > text.max_glyphs) break;
    text.put_string(total_chars, { x: 0, y: 12 * line_number }, 1, line, 0xffffffff);
    total_chars += line.length;
    line_number += 1;
  }

  //text.put_string(0, { x: 0, y: 0 }, 5, "James", 0xff1133ff);
  //text.put_string(10, { x: 0, y: 5 * 12 }, 2, "SUCH TEXT", 0x0000ffff);
  //text.put_string(20, { x: 0, y: 5 * 12 * 2 }, 2, "Still works", 0x0000ffff);



  gl.canvas.addEventListener("wheel", ev => {
    ev.stopPropagation();
    ev.preventDefault();

    if (ev.deltaY > 0) {
      program.zoomUpdate(gl, +0.1);
    } else if (ev.deltaY < 0) {
      program.zoomUpdate(gl, -0.1);
    }
  });

  let mouse_start: { x: number, y: number } | null = null;

  gl.canvas.addEventListener("mousedown", ev => {
    ev.stopPropagation();
    ev.preventDefault();

    mouse_start = { x: ev.clientX, y: ev.clientY };
  });

  gl.canvas.addEventListener("mouseup", ev => {
    if(mouse_start === null) {
      return;
    }

    ev.stopPropagation();
    ev.preventDefault();

    program.panUpdate(gl, { x: ev.clientX - mouse_start.x, y: ev.clientY - mouse_start.y }, true);

    mouse_start = null;
  });

  gl.canvas.addEventListener("mousemove", ev => {
    if(mouse_start === null) {
      return;
    }

    ev.stopPropagation();
    ev.preventDefault();

    program.panUpdate(gl, { x: ev.clientX - mouse_start.x, y: ev.clientY - mouse_start.y }, false);
  });

  console.info("Finished setup");

  // Drawing
  let draw = () => {
    gl.clear(gl.COLOR_BUFFER_BIT);

    program.bind(gl);

    // set vertex attribs
    text.bind(gl);

    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, text.max_glyphs);

    window.requestAnimationFrame(() => draw());
  };

  draw();
}