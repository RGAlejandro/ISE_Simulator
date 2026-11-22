/**
 * AudioWorklet: microphone → 16 kHz mono PCM16 chunks (~40 ms) for Gemini Live.
 * Runs at the AudioContext's native rate (Firefox can't mix sample rates) and
 * downsamples by box-averaging, which doubles as a cheap anti-alias filter.
 * Posts ArrayBuffers (transferred). `{type:"mute", value}` sends silence instead.
 */
class PcmRecorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000;
    this.chunk = new Int16Array(640);
    this.len = 0;
    this.acc = 0;
    this.n = 0;
    this.t = 0;
    this.muted = false;
    this.port.onmessage = (e) => {
      if (e.data && e.data.type === "mute") this.muted = !!e.data.value;
    };
  }

  push(v) {
    const s = this.muted ? 0 : Math.max(-1, Math.min(1, v));
    this.chunk[this.len++] = s < 0 ? s * 0x8000 : s * 0x7fff;
    if (this.len === this.chunk.length) {
      const out = this.chunk.buffer;
      this.port.postMessage(out, [out]);
      this.chunk = new Int16Array(640);
      this.len = 0;
    }
  }

  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this.acc += ch[i];
      this.n++;
      this.t += 1;
      if (this.t >= this.ratio) {
        this.t -= this.ratio;
        this.push(this.acc / this.n);
        this.acc = 0;
        this.n = 0;
      }
    }
    return true;
  }
}

registerProcessor("pcm-recorder", PcmRecorder);
