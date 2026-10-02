"use strict";

// Cat sounds made from scratch with Web Audio: no recordings, so no licences.
// Every function takes an AudioContext (or OfflineAudioContext, for tests) and
// a start time, and returns when the sound ends.
//
// To swap in a real recording later, keep the same names and play a file here.

(function (root) {
  // Meow: a buzzy voice (sawtooth) whose pitch rises then falls, through a
  // mouth filter that opens and closes: "mi-AAA-ow".
  function meow(ctx, { at = ctx.currentTime, pitch = 1, length = 0.55, volume = 0.7 } = {}) {
    const end = at + length;
    const voice = ctx.createOscillator();
    voice.type = "sawtooth";
    voice.frequency.setValueAtTime(520 * pitch, at);
    voice.frequency.linearRampToValueAtTime(820 * pitch, at + length * 0.3);
    voice.frequency.exponentialRampToValueAtTime(430 * pitch, end);

    // A little vibrato makes it sound alive.
    const wobble = ctx.createOscillator();
    const wobbleDepth = ctx.createGain();
    wobble.frequency.value = 7;
    wobbleDepth.gain.value = 12 * pitch;
    wobble.connect(wobbleDepth).connect(voice.frequency);

    const mouth = ctx.createBiquadFilter();
    mouth.type = "bandpass";
    mouth.Q.value = 6;
    mouth.frequency.setValueAtTime(900, at);
    mouth.frequency.linearRampToValueAtTime(2200, at + length * 0.35);
    mouth.frequency.linearRampToValueAtTime(700, end);

    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, at);
    amp.gain.exponentialRampToValueAtTime(volume, at + 0.06);
    amp.gain.setValueAtTime(volume, end - 0.15);
    amp.gain.exponentialRampToValueAtTime(0.0001, end);

    voice.connect(mouth).connect(amp).connect(ctx.destination);
    voice.start(at);
    wobble.start(at);
    voice.stop(end);
    wobble.stop(end);
    return end;
  }

  // Two quick rising meows: "the agent is done".
  function chirp(ctx, { at = ctx.currentTime, volume = 0.6 } = {}) {
    const first = meow(ctx, { at, pitch: 1.25, length: 0.22, volume });
    return meow(ctx, { at: first + 0.05, pitch: 1.4, length: 0.28, volume });
  }

  // Purr: low rumble (filtered noise) pulsing ~26 times a second, with the
  // breathing-in half a little quieter than the breathing-out half.
  function purr(ctx, { at = ctx.currentTime, length = 2.4, volume = 1 } = {}) {
    const end = at + length;
    const noise = ctx.createBufferSource();
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * length), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buffer;

    const chest = ctx.createBiquadFilter();
    chest.type = "lowpass";
    chest.frequency.value = 180;
    chest.Q.value = 1.5;

    const pulse = ctx.createGain();
    pulse.gain.value = 0;
    const pulser = ctx.createOscillator();
    pulser.frequency.value = 26;
    const pulseDepth = ctx.createGain();
    pulseDepth.gain.value = 1;
    pulser.connect(pulseDepth).connect(pulse.gain);

    const breath = ctx.createGain();
    const cycle = 1.2;
    for (let t = at; t < end; t += cycle) {
      breath.gain.setValueAtTime(volume * 0.6, t);
      breath.gain.linearRampToValueAtTime(volume, t + cycle * 0.5);
      breath.gain.linearRampToValueAtTime(volume * 0.6, t + cycle);
    }
    breath.gain.setValueAtTime(volume, end - 0.3);
    breath.gain.linearRampToValueAtTime(0, end);

    noise.connect(chest).connect(pulse).connect(breath).connect(ctx.destination);
    noise.start(at);
    pulser.start(at);
    noise.stop(end);
    pulser.stop(end);
    return end;
  }

  const sounds = { meow, chirp, purr };
  if (typeof module !== "undefined" && module.exports) module.exports = sounds;
  else root.NyanSounds = sounds;
})(typeof window !== "undefined" ? window : globalThis);
