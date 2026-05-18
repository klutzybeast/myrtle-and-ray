// Tiny localStorage-backed cart context for Stuffies-only checkout.
// Other categories continue to use external Buy URLs.
import { createContext, useContext, useEffect, useState, useCallback } from "react";

const CartCtx = createContext(null);
const KEY = "mr_cart_v1";

function load() {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function save(items) {
  try { if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(items)); } catch {}
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(load);

  useEffect(() => { save(items); }, [items]);

  const addItem = useCallback((entry) => {
    setItems((cur) => {
      const key = `${entry.product_slug}::${entry.variant_sku || ""}`;
      const idx = cur.findIndex((c) => `${c.product_slug}::${c.variant_sku || ""}` === key);
      if (idx >= 0) {
        const next = [...cur];
        next[idx] = { ...next[idx], quantity: Math.min(10, next[idx].quantity + (entry.quantity || 1)) };
        return next;
      }
      return [...cur, { ...entry, quantity: entry.quantity || 1 }];
    });
  }, []);

  const setQty = useCallback((product_slug, variant_sku, qty) => {
    setItems((cur) => cur.map((c) => (
      c.product_slug === product_slug && (c.variant_sku || "") === (variant_sku || "")
        ? { ...c, quantity: Math.max(1, Math.min(10, qty)) }
        : c
    )));
  }, []);

  const removeItem = useCallback((product_slug, variant_sku) => {
    setItems((cur) => cur.filter((c) => !(c.product_slug === product_slug && (c.variant_sku || "") === (variant_sku || ""))));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const count = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <CartCtx.Provider value={{ items, addItem, setQty, removeItem, clearCart, count }}>
      {children}
    </CartCtx.Provider>
  );
}

export function useCart() {
  return useContext(CartCtx) || { items: [], addItem: () => {}, setQty: () => {}, removeItem: () => {}, clearCart: () => {}, count: 0 };
}
