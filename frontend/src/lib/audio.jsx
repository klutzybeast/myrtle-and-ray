// Audio context: plays an ADMIN-supplied playlist (multiple MP3 URLs) in order,
// loops the whole playlist forever, supports next/prev. No synthesized "music".
// Also exposes pop() for tile-click pop sounds and playClip() for character voices.
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

const AudioCtx = createContext(null);

// Resolve a stored URL to an absolute, reachable URL.
// - Relative `/api/uploads/...` -> prepend REACT_APP_BACKEND_URL
// - Absolute URLs pointing to a stale emergent.host backend -> rewrite to current backend
// - Absolute URLs to other hosts -> leave alone
function resolveUrl(u) {
  if (!u) return u;
  const backend = process.env.REACT_APP_BACKEND_URL || "";
  if (u.startsWith("/")) return `${backend}${u}`;
  // Rewrite stale emergent-host backend paths to the current backend
  try {
    const parsed = new URL(u);
    if (parsed.pathname.startsWith("/api/uploads/") && /emergent(agent\.com|\.host)$/i.test(parsed.hostname)) {
      return `${backend}${parsed.pathname}${parsed.search || ""}`;
    }
  } catch {}
  return u;
}

export function AudioProvider({ children, urls }) {
  const playlist = useMemo(
    () => (Array.isArray(urls) ? urls : []).map(resolveUrl).filter(Boolean),
    [urls]
  );
  const hasTracks = playlist.length > 0;

  const [enabled, setEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("mr_audio") === "on";
  });
  const [trackIdx, setTrackIdx] = useState(0);
  const elRef = useRef(null);
  const popCtxRef = useRef(null);
  const playlistRef = useRef(playlist);
  useEffect(() => { playlistRef.current = playlist; }, [playlist]);

  // (Re)build the audio element whenever the URL for the current track changes
  useEffect(() => {
    if (!hasTracks) {
      if (elRef.current) { try { elRef.current.pause(); } catch {} elRef.current = null; }
      return;
    }
    const url = playlist[trackIdx % playlist.length];
    if (elRef.current) { try { elRef.current.pause(); elRef.current.src = ""; } catch {} }
    const el = new Audio();
    el.loop = false; // playlist mode — DO NOT loop the same song
    el.volume = 0.5;
    el.preload = "auto";
    // Note: deliberately NOT setting crossOrigin — same-origin /api/uploads/* don't need it
    // and setting it can prevent the 'ended' event from firing in some browsers.

    const goNext = () => {
      // Use functional updater + ref to current playlist length to avoid stale closures
      setTrackIdx((i) => {
        const len = playlistRef.current.length || 1;
        return (i + 1) % len;
      });
    };

    el.addEventListener("ended", goNext);
    el.addEventListener("error", () => setTimeout(goNext, 800));
    // Safety: if 'ended' never fires (some MP3s lack metadata), poll a watchdog
    let watchdog = null;
    const startWatchdog = () => {
      if (watchdog) clearInterval(watchdog);
      watchdog = setInterval(() => {
        if (!el.duration || Number.isNaN(el.duration)) return;
        if (el.currentTime >= el.duration - 0.05 && !el.paused) {
          clearInterval(watchdog);
          goNext();
        }
      }, 1000);
    };
    el.addEventListener("playing", startWatchdog);

    el.src = url; // assign AFTER listeners so we don't miss early events
    elRef.current = el;
    if (enabled) el.play().catch(() => {});
    return () => {
      try { el.pause(); el.src = ""; } catch {}
      if (watchdog) clearInterval(watchdog);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlist, trackIdx]);

  // Reset index if playlist shrinks
  useEffect(() => {
    if (hasTracks && trackIdx >= playlist.length) setTrackIdx(0);
  }, [playlist, hasTracks, trackIdx]);

  const start = () => { if (elRef.current) elRef.current.play().catch(() => {}); };
  const stop = () => { if (elRef.current) elRef.current.pause(); };

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem("mr_audio", next ? "on" : "off");
    if (next) start(); else stop();
  };

  const nextTrack = () => { setTrackIdx((i) => (i + 1) % Math.max(1, playlist.length)); };
  const prevTrack = () => { setTrackIdx((i) => (i - 1 + playlist.length) % Math.max(1, playlist.length)); };

  // Auto-start on first user interaction once enabled
  useEffect(() => {
    if (!enabled || !hasTracks) return;
    const onAny = () => { start(); window.removeEventListener("pointerdown", onAny); };
    window.addEventListener("pointerdown", onAny, { once: true });
    return () => window.removeEventListener("pointerdown", onAny);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, hasTracks]);

  // Soft tap-pop
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
    try { const a = new Audio(resolveUrl(url)); a.volume = 0.9; a.play(); } catch {}
  };

  return (
    <AudioCtx.Provider value={{
      enabled: hasTracks && enabled,
      hasTracks,
      trackCount: playlist.length,
      trackIdx,
      currentUrl: playlist[trackIdx] || "",
      toggle, nextTrack, prevTrack, pop, playClip,
    }}>
      {children}
    </AudioCtx.Provider>
  );
}

export function useAudio() {
  return useContext(AudioCtx) || { enabled: false, hasTracks: false, trackCount: 0, trackIdx: 0, currentUrl: "", toggle: () => {}, nextTrack: () => {}, prevTrack: () => {}, pop: () => {}, playClip: () => {} };
}
