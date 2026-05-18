import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useCart } from "../lib/cart";
import { ShoppingBag, Trash2, ArrowRight, Plus, Minus } from "lucide-react";
import SEO from "../components/SEO";

function money(cents) { return `$${((cents || 0) / 100).toFixed(2)}`; }

export default function Cart() {
  const { items, setQty, removeItem } = useCart();
  const [quote, setQuote] = useState(null);
  const [err, setErr] = useState("");
  const nav = useNavigate();

  useEffect(() => {
    if (!items.length) { setQuote(null); return; }
    setErr("");
    api.post("/checkout/quote-cart", { items: items.map((i) => ({ product_slug: i.product_slug, variant_sku: i.variant_sku || "", quantity: i.quantity })) })
      .then(({ data }) => setQuote(data))
      .catch((e) => setErr(e.response?.data?.detail || "Could not calculate totals"));
  }, [items]);

  return (
    <main className="pt-24 pb-12 bg-foam-grad min-h-screen" data-testid="cart-page">
      <SEO title="Your Cart" description="Review your Myrtle and Ray Stuffies before checkout." />
      <div className="max-w-4xl mx-auto px-4 md:px-6">
        <h1 className="font-accent text-4xl font-bold mb-6">Your Cart</h1>

        {items.length === 0 && (
          <div className="bg-white rounded-[28px] p-10 text-center" data-testid="cart-empty">
            <ShoppingBag className="w-12 h-12 mx-auto text-[#7fcfc7] mb-3" />
            <p className="text-[#5a6b76] mb-4">No Stuffies in your cart yet.</p>
            <Link to="/shop" className="btn-primary inline-flex" data-testid="cart-empty-shop"><ShoppingBag className="w-5 h-5" />Shop the Crew</Link>
          </div>
        )}

        {items.length > 0 && (
          <div className="grid lg:grid-cols-[2fr_1fr] gap-6">
            <div className="bg-white rounded-[28px] p-4 sm:p-6 space-y-3">
              {items.map((i) => (
                <div key={`${i.product_slug}::${i.variant_sku || ""}`} className="flex gap-4 items-center border-b border-[#f4e4c6] pb-3 last:border-0 last:pb-0" data-testid={`cart-row-${i.product_slug}`}>
                  <div className="w-20 h-20 rounded-2xl bg-[#eef9fb] p-1 shrink-0">
                    {i.image && <img src={i.image.startsWith("/") ? (process.env.REACT_APP_BACKEND_URL + i.image) : i.image} alt="" className="w-full h-full object-contain" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">{i.name}</div>
                    {i.variant_label && <div className="text-xs text-[#6b7280]">{i.variant_label}</div>}
                    <div className="text-sm text-[#5a8a6f] font-bold">{money(i.unit_price_cents)}</div>
                  </div>
                  <div className="flex items-center gap-1 bg-[#fffbf3] rounded-full border-2 border-[#f4e4c6]">
                    <button onClick={() => setQty(i.product_slug, i.variant_sku || "", i.quantity - 1)} className="p-2" aria-label="Decrease" data-testid={`cart-qty-minus-${i.product_slug}`}><Minus className="w-4 h-4" /></button>
                    <span className="font-bold w-6 text-center text-sm" data-testid={`cart-qty-${i.product_slug}`}>{i.quantity}</span>
                    <button onClick={() => setQty(i.product_slug, i.variant_sku || "", i.quantity + 1)} className="p-2" aria-label="Increase" data-testid={`cart-qty-plus-${i.product_slug}`}><Plus className="w-4 h-4" /></button>
                  </div>
                  <button onClick={() => removeItem(i.product_slug, i.variant_sku || "")} className="text-red-500 p-2 hover:bg-red-50 rounded-full" aria-label="Remove" data-testid={`cart-remove-${i.product_slug}`}><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-[28px] p-6 h-fit lg:sticky lg:top-24">
              <h2 className="font-accent text-2xl font-bold mb-3">Summary</h2>
              {err && <div className="text-red-600 text-sm mb-3" data-testid="cart-error">{err}</div>}
              {quote && (
                <dl className="text-sm space-y-2 mb-4">
                  <div className="flex justify-between"><dt>Subtotal</dt><dd data-testid="cart-subtotal">{money(quote.subtotal_cents)}</dd></div>
                  <div className="flex justify-between"><dt>NY Tax ({(quote.tax_rate * 100).toFixed(2)}%)</dt><dd data-testid="cart-tax">{money(quote.tax_cents)}</dd></div>
                  <div className="flex justify-between"><dt>Shipping (flat)</dt><dd data-testid="cart-shipping">{money(quote.shipping_cents)}</dd></div>
                  <div className="border-t border-[#f4e4c6] pt-2 flex justify-between font-bold text-base"><dt>Total</dt><dd data-testid="cart-total">{money(quote.total_cents)}</dd></div>
                </dl>
              )}
              <button
                onClick={() => nav("/checkout")}
                disabled={!quote || err}
                className="btn-primary w-full justify-center"
                data-testid="cart-checkout"
              >
                Checkout <ArrowRight className="w-5 h-5" />
              </button>
              <p className="text-xs text-[#6b7280] mt-3 text-center">Secure checkout powered by Square. We never see your card details.</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
