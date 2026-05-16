// Reusable full-screen lightbox with pinch-zoom, double-tap zoom,
// mouse wheel zoom, drag-to-pan, prev/next, and keyboard controls.
// Uses Pointer Events so the same code path handles mouse + touch.
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

const MAX_SCALE = 5;
const MIN_SCALE = 1;
const DOUBLE_TAP_MS = 300;

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

export default function Lightbox({ images, index = 0, onClose, alt = "" }) {
  const [i, setI] = useState(index);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);

  // Active pointers for pinch tracking
  const pointersRef = useRef(new Map());
  const lastTapRef = useRef(0);
  const dragStartRef = useRef(null);
  const pinchStartRef = useRef(null);
  const containerRef = useRef(null);

  const total = images.length;

  const reset = useCallback(() => { setScale(1); setTx(0); setTy(0); }, []);
  const goPrev = useCallback(() => { setI((c) => (c - 1 + total) % total); reset(); }, [total, reset]);
  const goNext = useCallback(() => { setI((c) => (c + 1) % total); reset(); }, [total, reset]);

  useEffect(() => { setI(index); reset(); }, [index, reset]);

  // Keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "+" || e.key === "=") setScale((s) => clamp(s * 1.4, MIN_SCALE, MAX_SCALE));
      else if (e.key === "-") setScale((s) => clamp(s / 1.4, MIN_SCALE, MAX_SCALE));
      else if (e.key === "0") reset();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, goPrev, goNext, reset]);

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const onWheel = (e) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.0025;
    setScale((s) => clamp(s + delta * s, MIN_SCALE, MAX_SCALE));
  };

  const onPointerDown = (e) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 1) {
      // Could be a tap (double-tap zoom) or drag start
      const now = Date.now();
      if (now - lastTapRef.current < DOUBLE_TAP_MS) {
        setScale((s) => (s > 1.2 ? 1 : 2.5));
        setTx(0); setTy(0);
        lastTapRef.current = 0;
      } else {
        lastTapRef.current = now;
      }
      dragStartRef.current = { x: e.clientX - tx, y: e.clientY - ty };
    } else if (pointersRef.current.size === 2) {
      const [p1, p2] = Array.from(pointersRef.current.values());
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      pinchStartRef.current = { dist, scale };
      dragStartRef.current = null;
    }
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2 && pinchStartRef.current) {
      const [p1, p2] = Array.from(pointersRef.current.values());
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const next = clamp((dist / pinchStartRef.current.dist) * pinchStartRef.current.scale, MIN_SCALE, MAX_SCALE);
      setScale(next);
    } else if (pointersRef.current.size === 1 && dragStartRef.current && scale > 1) {
      setTx(e.clientX - dragStartRef.current.x);
      setTy(e.clientY - dragStartRef.current.y);
    }
  };

  const onPointerUp = (e) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchStartRef.current = null;
    if (pointersRef.current.size === 0) dragStartRef.current = null;
    if (scale <= 1.02) { setScale(1); setTx(0); setTy(0); }
  };

  const onBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const src = images[i];
  if (!src) return null;

  return createPortal(
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] bg-black/90 grid place-items-center select-none"
      onClick={onBackdropClick}
      onWheel={onWheel}
      data-testid="lightbox"
    >
      {/* Top controls */}
      <div className="absolute top-4 right-4 flex gap-2 z-10">
        <button onClick={() => setScale((s) => clamp(s * 1.4, MIN_SCALE, MAX_SCALE))} className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white grid place-items-center" aria-label="Zoom in" data-testid="lightbox-zoom-in"><ZoomIn className="w-5 h-5" /></button>
        <button onClick={() => setScale((s) => clamp(s / 1.4, MIN_SCALE, MAX_SCALE))} className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white grid place-items-center" aria-label="Zoom out" data-testid="lightbox-zoom-out"><ZoomOut className="w-5 h-5" /></button>
        <button onClick={reset} className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white grid place-items-center" aria-label="Reset zoom" data-testid="lightbox-reset"><RotateCcw className="w-5 h-5" /></button>
        <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white grid place-items-center" aria-label="Close" data-testid="lightbox-close"><X className="w-5 h-5" /></button>
      </div>

      {/* Counter */}
      {total > 1 && (
        <div className="absolute top-4 left-4 text-white/80 text-sm font-semibold px-3 py-1 rounded-full bg-white/10" data-testid="lightbox-counter">
          {i + 1} / {total}
        </div>
      )}

      {/* Prev / Next */}
      {total > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); goPrev(); }} className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/15 hover:bg-white/25 text-white grid place-items-center z-10" aria-label="Previous" data-testid="lightbox-prev"><ChevronLeft className="w-6 h-6" /></button>
          <button onClick={(e) => { e.stopPropagation(); goNext(); }} className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/15 hover:bg-white/25 text-white grid place-items-center z-10" aria-label="Next" data-testid="lightbox-next"><ChevronRight className="w-6 h-6" /></button>
        </>
      )}

      {/* Image */}
      <div
        className="w-full h-full grid place-items-center touch-none"
        style={{ cursor: scale > 1 ? "grab" : "default" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-w-[92vw] max-h-[88vh] object-contain pointer-events-none select-none"
          style={{
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            transformOrigin: "center center",
            transition: pointersRef.current.size === 0 ? "transform 0.12s ease-out" : "none",
          }}
          data-testid="lightbox-image"
        />
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-xs">
        Pinch · double-tap · scroll to zoom
      </div>
    </div>,
    document.body
  );
}
