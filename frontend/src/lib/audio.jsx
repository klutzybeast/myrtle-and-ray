// Simple audio context: ambient ocean loop (synthesized or admin-uploaded) + tap pop.
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

const AudioCtx = createContext(null);

function makeHappyTones(audioCtx) {
  // Gentle marimba/music-box style: soft sine notes from a C-major pentatonic
  // scale (C4 E4 G4 A4 C5 D5 E5 G5) played at random ~2.4s intervals, with
  // a tiny fifth harmonic for warmth. Master gain stays low (0.0 by default).
  const masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.0;
  // Soft reverb-y feel via a short delay line
  const delay = audioCtx.createDelay(0.6);
  delay.delayTime.value = 0.32;
  const feedback = audioCtx.createGain();
  feedback.gain.value = 0.25;
  const wet = audioCtx.createGain();
  wet.gain.value = 0.35;
  masterGain.connect(audioCtx.destination);
  masterGain.connect(delay);
  delay.connect(feedback).connect(delay);
  delay.connect(wet).connect(audioCtx.destination);

  const SCALE = [261.63, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99];
  let stopped = false;

  const playNote = () => {
    if (stopped) return;
    const t = audioCtx.currentTime;
    const f = SCALE[Math.floor(Math.random() * SCALE.length)];
    const o1 = audioCtx.createOscillator();
    o1.type = "sine"; o1.frequency.value = f;
    const o2 = audioCtx.createOscillator();
    o2.type = "sine"; o2.frequency.value = f * 2.0;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.55, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    const h = audioCtx.createGain();
    h.gain.setValueAtTime(0.0001, t);
    h.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
    h.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    o1.connect(g).connect(masterGain);
    o2.connect(h).connect(masterGain);
    o1.start(t); o2.start(t);
    o1.stop(t + 1.8); o2.stop(t + 1.3);
    // Random next note 1.6–3.0s
    const next = 1600 + Math.random() * 1400;
    setTimeout(playNote, next);
  };
  playNote();

  return { masterGain, stop: () => { stopped = true; } };
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
        synthRef.current = makeHappyTones(ctxRef.current);
      } catch { return; }
    }
    const c = ctxRef.current; if (c.state === "suspended") c.resume();
    // Very soft target volume — happy tones, not a foreground sound.
    synthRef.current?.masterGain.gain.linearRampToValueAtTime(0.06, c.currentTime + 0.6);
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
      o.type = "sine";
      o.frequency.setValueAtTime(880, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(440, c.currentTime + 0.08);
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.06, c.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.14);
      o.connect(g).connect(c.destination);
      o.start(); o.stop(c.currentTime + 0.16);
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
