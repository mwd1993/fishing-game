/* sounds.js — zero-dependency WebAudio layer. 2D = volume only, 3D = world-positioned panner. */

class Sound {
  constructor(url, opts = {}) {
    this.url = url;
    this.spatial = !!opts.spatial;
    this.volume = opts.volume ?? 1;
    this.rate = opts.rate ?? 1;
    this.loop = !!opts.loop;
    this.fadeIn = opts.fadeIn ?? 0;
    this.fadeOut = opts.fadeOut ?? 0;
    this.refDist = opts.refDist ?? 2;
    this.maxDist = opts.maxDist ?? 60;
    this.rolloff = opts.rolloff ?? 1.2;
    this.maxVoices = opts.maxVoices ?? 6;
    this.voices = new Set();
    this._buf = null;
    this._req = null;
  }

  load() {
    if (this._buf) return Promise.resolve(this._buf);
    if (this._req) return this._req;
    return this._req = fetch(this.url)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then(ab => SoundManager.decode(ab))
      .then(buf => { this._buf = buf; this._req = null; return buf; })
      .catch(err => { this._req = null; throw err; });
  }

  preload() { return this.load().catch(() => null); }

  /* opts: { x,y,z, volume, rate, loop, delay, offset } */
  play(opts = {}) {
    if (!SoundManager.enabled) return null;
    const ctx = SoundManager.ctx();
    if (!ctx) return null;
    const vol = this.volume * (opts.volume ?? 1) * SoundManager.volume;
    if (vol <= 0.0002) return null;
    const rate = this.rate * (opts.rate ?? 1);
    if (this.spatial && opts.x != null) SoundManager.syncListener(ctx);
    if (this._buf) return this._spawn(ctx, this._buf, opts, vol, rate);
    return this.load().then(buf => this._spawn(ctx, buf, opts, vol, rate), () => null);
  }

  _spawn(ctx, buf, opts, vol, rate) {
    if (this.voices.size >= this.maxVoices) {
      const oldest = this.voices.values().next().value;
      this.voices.delete(oldest);
      try { oldest.onended = null; oldest.stop(); } catch (e) {}
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = opts.loop ?? this.loop;
    src.playbackRate.value = rate;
    const fade = opts.fadeIn ?? this.fadeIn;
    const t0 = ctx.currentTime + (opts.delay || 0);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(fade > 0 ? 0.0001 : vol, t0);
    if (fade > 0) gain.gain.linearRampToValueAtTime(vol, t0 + fade);
    src._gain = gain;

    let node = src;
    if (this.spatial && opts.x != null) {
      const pan = ctx.createPanner();
      pan.panningModel = 'HRTF';
      pan.distanceModel = 'inverse';
      pan.refDistance = this.refDist;
      pan.maxDistance = this.maxDist;
      pan.rolloffFactor = this.rolloff;
      const y = opts.y ?? 0, z = opts.z ?? 0;
      if (pan.positionX) {
        pan.positionX.value = opts.x; pan.positionY.value = y; pan.positionZ.value = z;
      } else pan.setPosition(opts.x, y, z);
      node.connect(pan);
      node = pan;
    }

    node.connect(gain);
    gain.connect(ctx.destination);
    src.onended = () => { this.voices.delete(src); gain.disconnect(); };
    this.voices.add(src);
    src.start(ctx.currentTime + (opts.delay || 0), opts.offset || 0);
    return src;
  }

  stop(opts = {}) {
    const ctx = SoundManager.ctx();
    const fade = opts.fadeOut ?? this.fadeOut;
    const t = ctx ? ctx.currentTime : 0;
    const ramp = fade > 0 && ctx;
    for (const v of this.voices) {
      const g = v._gain;
      if (ramp && g) {
        try {
          g.gain.cancelScheduledValues(t);
          g.gain.setValueAtTime(g.gain.value, t);
          g.gain.linearRampToValueAtTime(0.0001, t + fade);
          v.onended = () => g.disconnect();
          v.stop(t + fade);
          continue;
        } catch (e) {}
      }
      try { v.onended = null; v.stop(); } catch (e) {}
    }
    this.voices.clear();
  }
}

const SoundManager = {
  enabled: true,
  _ctx: null,
  _vol: 0.8,
  registry: new Map(),

  ctx() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!this._ctx) this._ctx = new AC();
    if (this._ctx.state === 'suspended') this._ctx.resume().catch(() => {});
    return this._ctx;
  },

  decode(ab) { const c = this.ctx(); return c ? c.decodeAudioData(ab) : Promise.reject(); },

  get volume() { return this._vol; },
  set volume(v) { this._vol = v < 0 ? 0 : v > 1 ? 1 : v; },
  setVolume(v) { this.volume = v > 1 ? v / 100 : v; },

  register(name, sound) { this.registry.set(name, sound); return sound; },
  get(name) { return this.registry.get(name); },
  play(name, opts) { const s = this.registry.get(name); return s && s.play(opts); },
  preloadAll() { for (const s of this.registry.values()) s.preload(); },

  camera: null,
  attachCamera(cam) { this.camera = cam; return this; },

  /* Mirror the three.js camera into the AudioListener so panner coords are world space. */
  syncListener(ctx) {
    const cam = this.camera;
    const l = ctx.listener;
    if (!cam || !l) return;
    const p = cam.position, e = cam.matrixWorld.elements;
    const fx = -e[8], fy = -e[9], fz = -e[10], ux = e[4], uy = e[5], uz = e[6];
    if (l.positionX) {
      l.positionX.value = p.x; l.positionY.value = p.y; l.positionZ.value = p.z;
      l.forwardX.value = fx; l.forwardY.value = fy; l.forwardZ.value = fz;
      l.upX.value = ux; l.upY.value = uy; l.upZ.value = uz;
    } else {
      l.setPosition(p.x, p.y, p.z);
      l.setOrientation(fx, fy, fz, ux, uy, uz);
    }
  },
};

/* --- project sound assets --- */
SoundManager.register('splash', new Sound('./sounds/splash1.wav', {
  spatial: true, volume: 0.8, maxDist: 50, refDist: 3, rolloff: 1.1,
}));
SoundManager.register('splash2', new Sound('./sounds/splash2.mp3', {
  spatial: true, volume: 0.6, maxDist: 50, refDist: 3, rolloff: 1.1,
}));
SoundManager.register('splash3', new Sound('./sounds/splash3.wav', {
  spatial: true, volume: 0.7, maxDist: 50, refDist: 3, rolloff: 1.1,
}));
SoundManager.get('splash3').preload();

/* Looping reel: 2D (no panner) so it sits at the player while the mouse is held. */
SoundManager.register('reel', new Sound('./sounds/reelsound1.wav', { loop: true, volume: 0.7 }));
SoundManager.get('reel').preload();

/* Fish pull/fight: 3D so it emanates from the struggling bobber. */
SoundManager.register('reelpull', new Sound('./sounds/reelpullsound1.wav', {
  spatial: true, volume: 0.85, maxDist: 50, refDist: 3, rolloff: 1.1, maxVoices: 3,
}));
SoundManager.get('reelpull').preload();

/* Line snap: 2D so it sits at the player. */
SoundManager.register('linesnap', new Sound('./sounds/fishinglinesnap1.wav', { volume: 0.9 }));
SoundManager.get('linesnap').preload();

/* Rain ambience: loops while raining, fades in/out around weather changes. */
SoundManager.register('rain1', new Sound('./sounds/rain1.wav', { loop: true, volume: 0.45, fadeIn: 2, fadeOut: 2 }));
SoundManager.get('rain1').preload();

/* Main scene ambience: continuous looped bed under everything. */
SoundManager.register('ambience1', new Sound('./sounds/ambience1.wav', { loop: true, volume: 0.45, fadeIn: 3 }));
SoundManager.get('ambience1').preload();

/* Fish catch success: 2D cue at the player. */
SoundManager.register('fishcatch', new Sound('./sounds/fishcatch1.wav', { volume: 0.9 }));
SoundManager.get('fishcatch').preload();
/* Thunder: 3D crack from the strike point; audible across the whole scene. */
SoundManager.register('thunder', new Sound('./sounds/thunder1.wav', {
  spatial: true, volume: 1, maxDist: 200, refDist: 10, rolloff: 0.5, maxVoices: 2,
}));
window.SoundManager = SoundManager;
window.Sound = Sound;
