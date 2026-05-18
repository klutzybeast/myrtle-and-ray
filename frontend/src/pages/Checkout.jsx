import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PaymentForm, CreditCard } from "react-square-web-payments-sdk";
import { api } from "../lib/api";
import { useCart } from "../lib/cart";
import { getStoredVisitor, setStoredVisitor } from "../lib/visitor";
import { Lock, Loader2 } from "lucide-react";
import SEO from "../components/SEO";
import { toast } from "sonner";

function money(cents) { return `$${((cents || 0) / 100).toFixed(2)}`; }

const APP_ID = process.env.REACT_APP_SQUARE_APPLICATION_ID;
const LOC_ID = process.env.REACT_APP_SQUARE_LOCATION_ID;

export default function Checkout() {
  const { items, clearCart } = useCart();
  const v = getStoredVisitor() || {};
  const [fullName, setFullName] = useState(v.name || "");
  const [email, setEmail] = useState(v.email || "");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("NY");
  const [postal, setPostal] = useState("");
  const [country, setCountry] = useState("US");
  const [quote, setQuote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState(null);
  const nav = useNavigate();

  useEffect(() => {
    if (!items.length) return;
    api.post("/checkout/quote-cart", { items: items.map((i) => ({ product_slug: i.product_slug, variant_sku: i.variant_sku || "", quantity: i.quantity })) })
      .then(({ data }) => setQuote(data))
      .catch(() => {});
  }, [items]);

  const shippingValid = fullName && email && line1 && city && state && postal && country;

  if (submittedOrder) {
    return (
      <main className="pt-24 pb-12 bg-foam-grad min-h-screen" data-testid="checkout-success">
        <div className="max-w-2xl mx-auto px-4 md:px-6">
          <div className="bg-white rounded-[28px] p-8 text-center">
            <div className="text-5xl mb-3">🎉</div>
            <h1 className="font-accent text-3xl font-bold mb-2">Thank you, {fullName}!</h1>
            <p className="text-[#5a6b76] mb-4">Your order <b>{submittedOrder.order_number}</b> is confirmed.</p>
            <p className="text-sm text-[#6b7280] mb-6">A receipt is on its way to <b>{email}</b>.</p>
            {submittedOrder.receipt_url && (
              <a href={submittedOrder.receipt_url} target="_blank" rel="noopener noreferrer" className="btn-secondary inline-flex mr-2" data-testid="success-receipt">View Square receipt</a>
            )}
            <Link to="/shop" className="btn-primary inline-flex">Keep shopping</Link>
          </div>
        </div>
      </main>
    );
  }

  if (!items.length) {
    return (
      <main className="pt-24 pb-12 text-center" data-testid="checkout-empty">
        <p className="text-[#5a6b76] mb-4">Your cart is empty.</p>
        <Link to="/shop" className="btn-primary inline-flex">Shop the Crew</Link>
      </main>
    );
  }

  const handleToken = async (tokenResult, verifiedBuyer) => {
    if (tokenResult.status !== "OK") {
      toast.error("Could not validate your card. Please check the details and try again.");
      setBusy(false);
      return;
    }
    try {
      const { data } = await api.post("/checkout/square", {
        items: items.map((i) => ({ product_slug: i.product_slug, variant_sku: i.variant_sku || "", quantity: i.quantity })),
        email,
        full_name: fullName,
        shipping_address: { line1, line2, city, state, postal_code: postal, country },
        source_id: tokenResult.token,
        verification_token: verifiedBuyer?.token,
      });
      setStoredVisitor({ name: fullName, email, audience: v.audience });
      setSubmittedOrder(data);
      clearCart();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Payment failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="pt-24 pb-12 bg-foam-grad min-h-screen" data-testid="checkout-page">
      <SEO title="Checkout" description="Secure Stuffies checkout." />
      <div className="max-w-5xl mx-auto px-4 md:px-6">
        <h1 className="font-accent text-4xl font-bold mb-6">Checkout</h1>

        <div className="grid lg:grid-cols-[2fr_1fr] gap-6">
          <div className="space-y-6">
            <section className="bg-white rounded-[28px] p-6" data-testid="checkout-shipping">
              <h2 className="font-accent text-2xl font-bold mb-4">Shipping address</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Full name" full><input value={fullName} onChange={(e) => setFullName(e.target.value)} className="inp" data-testid="ship-name" autoComplete="name" /></Field>
                <Field label="Email" full><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="inp" data-testid="ship-email" autoComplete="email" /></Field>
                <Field label="Address line 1" full><input value={line1} onChange={(e) => setLine1(e.target.value)} className="inp" data-testid="ship-line1" autoComplete="address-line1" /></Field>
                <Field label="Address line 2 (optional)" full><input value={line2} onChange={(e) => setLine2(e.target.value)} className="inp" data-testid="ship-line2" autoComplete="address-line2" /></Field>
                <Field label="City"><input value={city} onChange={(e) => setCity(e.target.value)} className="inp" data-testid="ship-city" autoComplete="address-level2" /></Field>
                <Field label="State / Province"><input value={state} onChange={(e) => setState(e.target.value)} className="inp" data-testid="ship-state" autoComplete="address-level1" /></Field>
                <Field label="Postal code"><input value={postal} onChange={(e) => setPostal(e.target.value)} className="inp" data-testid="ship-postal" autoComplete="postal-code" /></Field>
                <Field label="Country"><input value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} maxLength={2} className="inp" data-testid="ship-country" autoComplete="country" /></Field>
              </div>
            </section>

            <section className="bg-white rounded-[28px] p-6" data-testid="checkout-payment">
              <h2 className="font-accent text-2xl font-bold mb-4 flex items-center gap-2"><Lock className="w-5 h-5 text-[#5a8a6f]" /> Payment</h2>
              {!shippingValid && (
                <p className="text-sm text-[#6b7280] mb-3">Fill in your shipping address above to enter card details.</p>
              )}
              {shippingValid && APP_ID && LOC_ID && quote && (
                <div data-testid="square-card-form">
                  <PaymentForm
                    applicationId={APP_ID}
                    locationId={LOC_ID}
                    cardTokenizeResponseReceived={handleToken}
                    createVerificationDetails={() => ({
                      amount: (quote.total_cents / 100).toFixed(2),
                      billingContact: {
                        familyName: fullName.split(" ").slice(-1)[0] || "",
                        givenName: fullName.split(" ")[0] || "",
                        email,
                        country,
                        city,
                        addressLines: [line1, line2].filter(Boolean),
                        postalCode: postal,
                        state,
                      },
                      currencyCode: "USD",
                      intent: "CHARGE",
                    })}
                  >
                    <div onClickCapture={() => setBusy(true)}>
                      <CreditCard
                        buttonProps={{
                          isLoading: busy,
                          css: {
                            backgroundColor: "#7fcfc7",
                            fontFamily: "Fraunces, serif",
                            fontWeight: 700,
                            fontSize: "1rem",
                            borderRadius: "9999px",
                            padding: "14px 24px",
                            "&:hover": { backgroundColor: "#6abdb5" },
                          },
                        }}
                      >
                        {busy ? "Processing..." : `Pay ${money(quote.total_cents)}`}
                      </CreditCard>
                    </div>
                  </PaymentForm>
                  <p className="text-xs text-[#6b7280] mt-3 text-center">Your card details never touch our servers. Tokenized by Square.</p>
                </div>
              )}
              {(!APP_ID || !LOC_ID) && (
                <p className="text-sm text-red-600">Payments are not configured. Please contact support.</p>
              )}
            </section>
          </div>

          <aside className="bg-white rounded-[28px] p-6 h-fit lg:sticky lg:top-24" data-testid="checkout-summary">
            <h2 className="font-accent text-2xl font-bold mb-3">Your order</h2>
            <ul className="space-y-2 mb-3">
              {items.map((i) => (
                <li key={`${i.product_slug}::${i.variant_sku || ""}`} className="flex justify-between text-sm">
                  <span className="truncate pr-2">{i.quantity}× {i.name}</span>
                  <span className="tabular-nums">{money(i.unit_price_cents * i.quantity)}</span>
                </li>
              ))}
            </ul>
            {quote && (
              <dl className="text-sm space-y-1 border-t border-[#f4e4c6] pt-3">
                <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(quote.subtotal_cents)}</dd></div>
                <div className="flex justify-between"><dt>NY Tax</dt><dd>{money(quote.tax_cents)}</dd></div>
                <div className="flex justify-between"><dt>Shipping</dt><dd>{money(quote.shipping_cents)}</dd></div>
                <div className="flex justify-between font-bold text-base border-t border-[#f4e4c6] pt-2 mt-2"><dt>Total</dt><dd data-testid="summary-total">{money(quote.total_cents)}</dd></div>
              </dl>
            )}
            {!quote && <div className="flex items-center gap-2 text-sm text-[#6b7280]"><Loader2 className="w-4 h-4 animate-spin" /> Calculating...</div>}
          </aside>
        </div>
      </div>
    </main>
  );
}

function Field({ label, children, full }) {
  return (
    <label className={`text-sm ${full ? "sm:col-span-2" : ""}`}>
      <div className="font-semibold text-[#3a4a55] mb-1">{label}</div>
      {children}
    </label>
  );
}
