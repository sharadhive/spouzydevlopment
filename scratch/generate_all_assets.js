const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9318;
const USER_DATA_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200\\scratch\\chrome-asset-gen';

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
  }
  ready() {
    return new Promise(resolve => {
      if (this.ws.readyState === WebSocket.OPEN) resolve();
      else this.ws.onopen = resolve;
    });
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() { this.ws.close(); }
}

async function run() {
  const gifBase64 = fs.readFileSync('image/SPOUZY-loader.gif').toString('base64');
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--disable-gpu',
    '--no-sandbox'
  ]);

  try {
    let tabs = null;
    for (let i = 0; i < 20; i++) {
      try {
        tabs = await getJson(`http://127.0.0.1:${PORT}/json`);
        if (tabs && tabs.length > 0) break;
      } catch (e) { await wait(200); }
    }
    const client = new CDPClient(tabs[0].webSocketDebuggerUrl);
    await client.ready();
    await client.send('Runtime.enable');

    console.log('Extracting frames and encoding WebP payloads in Chrome...');
    const result = await client.send('Runtime.evaluate', {
      expression: `(async () => {
        const b64 = "${gifBase64}";
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

        const decoder = new ImageDecoder({ data: bytes.buffer, type: 'image/gif' });
        await decoder.tracks.ready;

        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 360;
        const ctx = canvas.getContext('2d');

        // Extract Frame 32 static PNG
        const f32 = await decoder.decode({ frameIndex: 32 });
        ctx.clearRect(0, 0, 640, 360);
        ctx.drawImage(f32.image, 0, 0);
        f32.image.close();
        const staticPngB64 = canvas.toDataURL('image/png').split(',')[1];

        // Process Frames 1 to 32 (32 frames total)
        // Frames 1..31 duration: 40ms
        // Frame 32 duration: 220ms
        const framePayloads = [];

        for (let i = 1; i <= 32; i++) {
          const res = await decoder.decode({ frameIndex: i });
          ctx.clearRect(0, 0, 640, 360);
          ctx.drawImage(res.image, 0, 0);
          res.image.close();

          const blob = await new Promise(r => canvas.toBlob(r, 'image/webp', 0.95));
          const arrBuf = await blob.arrayBuffer();
          const frameBytes = new Uint8Array(arrBuf);

          // Extract subchunks (ALPH and VP8 or VP8L)
          let pos = 12; // skip RIFF + size + WEBP
          let subChunks = [];
          while (pos < frameBytes.length) {
            let id = String.fromCharCode(frameBytes[pos], frameBytes[pos+1], frameBytes[pos+2], frameBytes[pos+3]);
            let size = frameBytes[pos+4] | (frameBytes[pos+5] << 8) | (frameBytes[pos+6] << 16) | (frameBytes[pos+7] << 24);
            let totalChunkSize = 8 + size + (size % 2);
            if (id === 'ALPH' || id === 'VP8 ' || id === 'VP8L') {
              subChunks.push(Array.from(frameBytes.slice(pos, pos + totalChunkSize)));
            }
            pos += totalChunkSize;
          }

          // Flatten subchunks
          let flat = [];
          for (const sc of subChunks) {
            flat.push(...sc);
          }

          const duration = (i === 32) ? 220 : 40;
          framePayloads.push({
            frameIndex: i,
            duration,
            payload: flat
          });
        }

        return {
          staticPngB64,
          framePayloads
        };
      })()`,
      returnByValue: true,
      awaitPromise: true
    });

    console.log('Finished extraction from Chrome.');
    const { staticPngB64, framePayloads } = result.result.value;

    // 1. Save static PNG
    const staticPngBuf = Buffer.from(staticPngB64, 'base64');
    fs.writeFileSync('image/spouzy-transition-static.png', staticPngBuf);
    console.log(`Saved image/spouzy-transition-static.png (${staticPngBuf.length} bytes)`);

    // 2. Assemble animated WebP
    // Build chunks
    // VP8X chunk
    const vp8x = Buffer.alloc(18);
    vp8x.write('VP8X', 0, 4, 'ascii');
    vp8x.writeUInt32LE(10, 4); // size = 10
    vp8x[8] = 0x12; // flags: animation (0x02) | alpha (0x10)
    vp8x[9] = 0x00;
    vp8x[10] = 0x00;
    vp8x[11] = 0x00;
    // Canvas Width Minus One (640 - 1 = 639)
    vp8x[12] = 639 & 0xFF;
    vp8x[13] = (639 >> 8) & 0xFF;
    vp8x[14] = (639 >> 16) & 0xFF;
    // Canvas Height Minus One (360 - 1 = 359)
    vp8x[15] = 359 & 0xFF;
    vp8x[16] = (359 >> 8) & 0xFF;
    vp8x[17] = (359 >> 16) & 0xFF;

    // ANIM chunk
    const anim = Buffer.alloc(14);
    anim.write('ANIM', 0, 4, 'ascii');
    anim.writeUInt32LE(6, 4); // size = 6
    // background color: RGBA (0, 0, 0, 0)
    anim[8] = 0x00;
    anim[9] = 0x00;
    anim[10] = 0x00;
    anim[11] = 0x00;
    // loop count: 1 (play once!)
    anim.writeUInt16LE(1, 12);

    const anmfChunks = [];
    framePayloads.forEach((f, idx) => {
      const payloadBuf = Buffer.from(f.payload);
      const anmfHeader = Buffer.alloc(24);
      anmfHeader.write('ANMF', 0, 4, 'ascii');
      const chunkSize = 16 + payloadBuf.length;
      anmfHeader.writeUInt32LE(chunkSize, 4);
      // Frame X (0)
      anmfHeader[8] = 0; anmfHeader[9] = 0; anmfHeader[10] = 0;
      // Frame Y (0)
      anmfHeader[11] = 0; anmfHeader[12] = 0; anmfHeader[13] = 0;
      // Frame W - 1 (639)
      anmfHeader[14] = 639 & 0xFF;
      anmfHeader[15] = (639 >> 8) & 0xFF;
      anmfHeader[16] = (639 >> 16) & 0xFF;
      // Frame H - 1 (359)
      anmfHeader[17] = 359 & 0xFF;
      anmfHeader[18] = (359 >> 8) & 0xFF;
      anmfHeader[19] = (359 >> 16) & 0xFF;
      // Frame duration in ms
      anmfHeader[20] = f.duration & 0xFF;
      anmfHeader[21] = (f.duration >> 8) & 0xFF;
      anmfHeader[22] = (f.duration >> 16) & 0xFF;
      // Flags: disposal = 1 (dispose to bg), blend = 1 (do not blend) -> 0x03
      anmfHeader[23] = 0x03;

      anmfChunks.push(anmfHeader);
      anmfChunks.push(payloadBuf);
      if (chunkSize % 2 !== 0) {
        anmfChunks.push(Buffer.from([0x00])); // padding byte
      }
    });

    const riffBody = Buffer.concat([vp8x, anim, ...anmfChunks]);
    const riffHeader = Buffer.alloc(12);
    riffHeader.write('RIFF', 0, 4, 'ascii');
    riffHeader.writeUInt32LE(4 + riffBody.length, 4);
    riffHeader.write('WEBP', 8, 4, 'ascii');

    const finalWebP = Buffer.concat([riffHeader, riffBody]);
    fs.writeFileSync('image/spouzy-transition.webp', finalWebP);
    console.log(`Saved image/spouzy-transition.webp (${finalWebP.length} bytes)`);

    // Validate the generated WebP in Chrome ImageDecoder!
    const testValidation = await client.send('Runtime.evaluate', {
      expression: `(async () => {
        const b64 = "${finalWebP.toString('base64')}";
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

        const decoder = new ImageDecoder({ data: bytes.buffer, type: 'image/webp' });
        await decoder.tracks.ready;

        const count = decoder.tracks.selectedTrack.frameCount;
        const repetitionCount = decoder.tracks.selectedTrack.repetitionCount;

        const frames = [];
        let totalMs = 0;
        for (let i = 0; i < count; i++) {
          const res = await decoder.decode({ frameIndex: i });
          const durMs = res.image.duration / 1000;
          totalMs += durMs;
          frames.push({
            frame: i,
            duration: durMs,
            width: res.image.displayWidth,
            height: res.image.displayHeight
          });
          res.image.close();
        }

        return {
          valid: true,
          count,
          repetitionCount,
          totalMs,
          firstFrame: frames[0],
          lastFrame: frames[frames.length - 1]
        };
      })()`,
      returnByValue: true,
      awaitPromise: true
    });

    console.log('WebP Validation Result:', JSON.stringify(testValidation.result.value, null, 2));

    client.close();
  } finally {
    chrome.kill();
  }
}

run().catch(console.error);
