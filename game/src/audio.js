// Sound, all of it synthesized: no audio files, just oscillators and a
// little noise through the Web Audio API. A whistle is two detuned sines
// sliding up; a chug is filtered noise in a steady rhythm; a delivery is a
// bright major triad; the Maw is a low sawtooth growl.

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicTimer = null;
  let musicOn = false;
  let muted = false;
  let musicStep = 0;

  /** Create the context on the first user gesture; browsers demand it. */
  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, freq) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
  }

  /** A two-note train whistle. */
  function whistle() {
    tone(880, 0.35, 'sine', 0.25, 1174);
    tone(1320, 0.35, 'sine', 0.12, 1760);
  }

  /** The chug-chug of a train rolling: called on a slow timer by the loop. */
  function chug() {
    noise(0.09, 0.16, 500);
  }

  function startMusic() {
    if (musicOn || !ctx) return;
    musicOn = true;
    // A lazy daytime lope: a chug every beat, a soft bass note every bar.
    const bass = [110, 110, 130.8, 98];
    musicTimer = window.setInterval(() => {
      if (muted) return;
      chug();
      musicStep += 1;
      if (musicStep % 4 === 0) tone(bass[(musicStep / 4) % 4 | 0], 0.5, 'triangle', 0.12);
    }, 320);
  }

  function stopMusic() {
    musicOn = false;
    if (musicTimer !== null) {
      window.clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  function toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.5;
    return muted;
  }

  const api = {
    unlock,
    startMusic,
    stopMusic,
    toggleMute,
    get muted() {
      return muted;
    },
    get musicOn() {
      return musicOn;
    },
    switch() {
      tone(660, 0.08, 'square', 0.14);
      tone(990, 0.1, 'square', 0.12);
    },
    deliver() {
      tone(523, 0.16, 'triangle', 0.22);
      tone(659, 0.16, 'triangle', 0.22);
      tone(784, 0.3, 'triangle', 0.22);
    },
    late() {
      tone(392, 0.2, 'triangle', 0.18);
      tone(330, 0.3, 'triangle', 0.18);
    },
    lost() {
      tone(220, 0.3, 'sawtooth', 0.16, 110);
    },
    shoo() {
      tone(1200, 0.08, 'sine', 0.16, 1800);
    },
    clang() {
      tone(180, 0.25, 'square', 0.2, 90);
      noise(0.12, 0.2, 1200);
    },
    clear() {
      noise(0.2, 0.2, 900);
      tone(523, 0.15, 'triangle', 0.16);
    },
    crack() {
      noise(0.1, 0.22, 700);
    },
    spawn() {
      tone(440, 0.12, 'sine', 0.1, 660);
    },
    rock() {
      noise(0.3, 0.25, 300);
    },
    furnaceHit() {
      tone(160, 0.35, 'sawtooth', 0.2, 70);
    },
    levelUp() {
      tone(523, 0.12, 'triangle', 0.2);
      tone(659, 0.12, 'triangle', 0.2);
      tone(784, 0.12, 'triangle', 0.2);
      tone(1046, 0.3, 'triangle', 0.2);
    },
    pick() {
      tone(784, 0.15, 'triangle', 0.2);
      tone(1046, 0.25, 'triangle', 0.2);
    },
    boss() {
      tone(65, 1.2, 'sawtooth', 0.3, 49);
      tone(98, 1.0, 'sawtooth', 0.18, 73);
    },
    mawHit() {
      tone(80, 0.5, 'sawtooth', 0.3, 40);
      noise(0.4, 0.25, 400);
    },
    tremor() {
      tone(55, 0.8, 'sine', 0.3, 40);
    },
    tremorHit() {
      noise(0.5, 0.3, 250);
      tone(49, 0.5, 'sine', 0.3, 35);
    },
    save() {
      tone(880, 0.15, 'triangle', 0.2);
      tone(1174, 0.25, 'triangle', 0.2);
    },
    whistle,
    chug,
    win() {
      const notes = [523, 659, 784, 1046, 784, 1046, 1318];
      notes.forEach((n, i) => window.setTimeout(() => tone(n, 0.3, 'triangle', 0.22), i * 140));
    },
    stoker() {
      noise(0.25, 0.2, 800);
      tone(330, 0.2, 'triangle', 0.14, 494);
    },
    water() {
      noise(0.4, 0.16, 2000);
    },
    brake() {
      tone(300, 0.4, 'sawtooth', 0.14, 150);
    },
    signal() {
      tone(990, 0.1, 'square', 0.14);
      tone(1320, 0.15, 'square', 0.14);
    },
    shunt() {
      tone(740, 0.1, 'square', 0.14);
      tone(988, 0.18, 'square', 0.14);
    },
  };
  return api;
}
