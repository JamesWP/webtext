
const font = `
*******|       |
*******|       |
*******| ***   |
*******|*   *  |
*******|*   *  |
*******|*   *  |
*******|*****  |
*******|*   *  |
*******|*   *  |
*******|*   *  |
*******|       |
*******|       |
*******|       |
`;

const charSize = [6, 12];
const mapSize = [2, 1];
const textureSize = [mapSize[0] * charSize[0], mapSize[1] * charSize[1]];

export function loadTexture(gl: WebGL2RenderingContext): WebGLTexture {
    let bitmap = Array.from("".concat(...font.split("\n"))).filter(x => x !== "|").map(x => x === "*" ? 0xFF : 0x00);

    let b = new ArrayBuffer(bitmap.length);
    let u8 = new Uint8Array(b);
    u8.set(bitmap);

    let texture = gl.createTexture();

    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.pixelStorei(
        gl.UNPACK_ALIGNMENT,
        1 // allignment
    );

    gl.texImage2D(
        gl.TEXTURE_2D,
        0, // level
        gl.LUMINANCE, // internal format
        textureSize[0], textureSize[1], // size
        0, // border
        gl.LUMINANCE, // format
        gl.UNSIGNED_BYTE, // type
        u8 // data
    );

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    return texture;
}