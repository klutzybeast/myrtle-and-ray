// Simple audio context: ambient ocean loop (synthesized or admin-uploaded) + tap pop.
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

const AudioCtx = createContext(null);

function makeSynthLoop(audioCtx) {
  // Soft ocean-like noise: brown-ish noise band-passed + slow LFO.
  const bufferSize = 2 * audioCtx.sampleRate;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const out = buffer.getChannelData(0);
  let lastOut = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    out[i] = (lastOut + 0.02 * white) / 1.02;
    lastOut = out[i];
    out[i] *= 3.5;
  }
  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer; noise.loop = true;
  const filter = audioCtx.createBiquadFilter();
  filter.type = "lowpass"; filter.frequency.value = 800;
  const lfo = audioCtx.createOscillator();
  const lfoGain = audioCtx.createGain();
  lfo.frequency.value = 0.18; lfoGain.gain.value = 320;
  lfo.connect(lfoGain).connect(filter.frequency);
  lfo.start();
  const masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.0;
  noise.connect(filter).connect(masterGain).connect(audioCtx.destination);
  noise.start();
  return { masterGain };
}

export function AudioProvider({ children, audioUrl }) {
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("mr_audio") === "on";
  });
  const ctxRef = useRef(null);
  const synthRef = useRef(null);
  const elRef = useRef(null);

  const start = () => {
    if (!enabled) return;
    if (audioUrl) {
      if (!elRef.current) {
        const el = new Audio(audioUrl);
        el.loop = true; el.volume = 0.35; el.crossOrigin = "anonymous";
        elRef.current = el;
      }
      elRef.current.play().catch(() => {});
      return;
    }
    if (!ctxRef.current) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        ctxRef.current = new AC();
        synthRef.current = makeSynthLoop(ctxRef.current);
      } catch { return; }
    }
    const c = ctxRef.current; if (c.state === "suspended") c.resume();
    synthRef.current?.masterGain.gain.linearRampToValueAtTime(0.18, c.currentTime + 0.6);
  };

  const stop = () => {
    if (elRef.current) elRef.current.pause();
    if (synthRef.current && ctxRef.current) {
      synthRef.current.masterGain.gain.cancelScheduledValues(ctxRef.current.currentTime);
      synthRef.current.masterGain.gain.linearRampToValueAtTime(0, ctxRef.current.currentTime + 0.4);
    }
  };

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem("mr_audio", next ? "on" : "off");
    if (next) start(); else stop();
  };

  // Restart loop when audioUrl changes
  useEffect(() => {
    stop();
    elRef.current = null;
    if (enabled) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl]);

  // Auto-start once user interacts (browser policy)
  useEffect(() => {
    if (!enabled) return;
    const onAny = () => { start(); window.removeEventListener("pointerdown", onAny); };
    window.addEventListener("pointerdown", onAny, { once: true });
    return () => window.removeEventListener("pointerdown", onAny);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Tap pop
  const pop = () => {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const c = ctxRef.current || new AC();
      ctxRef.current = c;
      const o = c.createOscillator();
      const g = c.createGain();
      o.frequency.setValueAtTime(800, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(220, c.currentTime + 0.12);
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.18, c.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.16);
      o.connect(g).connect(c.destination);
      o.start(); o.stop(c.currentTime + 0.18);
    } catch {}
  };

  const playClip = (url) => {
    if (!url) return;
    try { const a = new Audio(url); a.play(); } catch {}
  };

  const value = useMemo(() => ({ enabled, toggle, pop, playClip }), [enabled, audioUrl]);
  return <AudioCtx.Provider value={value}>{children}</AudioCtx.Provider>;
}

export function useAudio() {
  return useContext(AudioCtx) || { enabled: false, toggle: () => {}, pop: () => {}, playClip: () => {} };
}
