// Audio context: plays an admin-supplied MP3 loop (set via Admin → Site & Emails → Ambient loop URL)
// PLUS a soft tap-pop and per-character voice clips. No synthesized "music" — if the admin hasn't
// uploaded a track, the toggle is hidden so we never play awkward tones.
import { createContext, useContext, useEffect, useRef, useState } from "react";

const AudioCtx = createContext(null);

export function AudioProvider({ children, audioUrl }) {
  const hasTrack = !!audioUrl;
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("mr_audio") === "on";
  });
  const elRef = useRef(null);
  const popCtxRef = useRef(null);

  // Build / replace the audio element whenever the URL changes
  useEffect(() => {
    if (elRef.current) { try { elRef.current.pause(); } catch {} elRef.current = null; }
    if (!audioUrl) return;
    const el = new Audio(audioUrl);
    el.loop = true;
    el.volume = 0.5;
    el.preload = "auto";
    el.crossOrigin = "anonymous";
    elRef.current = el;
    if (enabled) el.play().catch(() => {});
    return () => { try { el.pause(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl]);

  const start = () => { if (elRef.current) elRef.current.play().catch(() => {}); };
  const stop = () => { if (elRef.current) elRef.current.pause(); };

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem("mr_audio", next ? "on" : "off");
    if (next) start(); else stop();
  };

  // Auto-start once user interacts (browser autoplay policy) — only if a URL is set
  useEffect(() => {
    if (!enabled || !audioUrl) return;
    const onAny = () => { start(); window.removeEventListener("pointerdown", onAny); };
    window.addEventListener("pointerdown", onAny, { once: true });
    return () => window.removeEventListener("pointerdown", onAny);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, audioUrl]);

  // Soft tap-pop — used on game tile clicks
  const pop = () => {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const c = popCtxRef.current || new AC();
      popCtxRef.current = c;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(880, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(440, c.currentTime + 0.08);
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.08, c.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.14);
      o.connect(g).connect(c.destination);
      o.start(); o.stop(c.currentTime + 0.16);
    } catch {}
  };

  const playClip = (url) => {
    if (!url) return;
    try { const a = new Audio(url); a.volume = 0.9; a.play(); } catch {}
  };

  return (
    <AudioCtx.Provider value={{ enabled: hasTrack && enabled, hasTrack, toggle, pop, playClip }}>
      {children}
    </AudioCtx.Provider>
  );
}

export function useAudio() {
  return useContext(AudioCtx) || { enabled: false, hasTrack: false, toggle: () => {}, pop: () => {}, playClip: () => {} };
}
