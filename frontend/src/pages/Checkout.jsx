import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { PaymentForm, CreditCard } from "react-square-web-payments-sdk";
import { api } from "../lib/api";
import { useCart } from "../lib/cart";
import { getStoredVisitor, setStoredVisitor } from "../lib/visitor";
import { Lock, Loader2, Truck, AlertCircle, Tag, Check, X as XIcon } from "lucide-react";
import SEO from "../components/SEO";
import AddressAutocomplete from "../components/AddressAutocomplete";
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
  const [rates, setRates] = useState([]);
  const [selectedRateId, setSelectedRateId] = useState("");
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesError, setRatesError] = useState("");
  const [quote, setQuote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState(null);
  // Discount code state
  const [searchParams] = useSearchParams();
  const [codeInput, setCodeInput] = useState("");
  const [appliedCode, setAppliedCode] = useState(""); // accepted code currently affecting quote
  const [codeError, setCodeError] = useState("");
  const [codeBusy, setCodeBusy] = useState(false);
  const nav = useNavigate();

  const addressReady = !!(line1 && city && state && postal && country);
  const totalQty = useMemo(() => items.reduce((s, i) => s + (i.quantity || 0), 0), [items]);

  // Fetch live ShipStation rates whenever the destination address is complete.
  // Debounced by 400ms so we don't fire a ShipStation call on every keystroke.
  useEffect(() => {
    if (!items.length || !addressReady) {
      setRates([]); setSelectedRateId(""); setRatesError("");
      return;
    }
    let cancelled = false;
    setRatesLoading(true); setRatesError("");
    const t = setTimeout(() => {
      api.post("/checkout/shipping-rates", {
        items: items.map((i) => ({ quantity: i.quantity })),
        full_name: fullName || "Buyer",
        shipping_address: { line1, line2, city, state, postal_code: postal, country },
      })
        .then(({ data }) => {
          if (cancelled) return;
          const list = data?.rates || [];
          setRates(list);
          if (list.length) {
            const stillValid = list.find((r) => r.rate_id === selectedRateId);
            setSelectedRateId(stillValid ? selectedRateId : list[0].rate_id);
          } else {
            setSelectedRateId("");
          }
        })
        .catch((err) => {
          if (cancelled) return;
          setRates([]); setSelectedRateId("");
          setRatesError(err.response?.data?.detail || "Could not fetch shipping rates for this address.");
        })
        .finally(() => { if (!cancelled) setRatesLoading(false); });
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line1, line2, city, state, postal, country, totalQty]);

  const selectedRate = rates.find((r) => r.rate_id === selectedRateId) || null;
  const selectedShippingCents = selectedRate ? selectedRate.shipping_cents : null;

  // Recompute totals whenever cart OR selected shipping OR applied code changes.
  // While no rate is selected yet, force shipping_cents=0 so the summary
  // doesn't flash the legacy $8 fallback during loading / address-error.
  useEffect(() => {
    if (!items.length) return;
    const body = {
      items: items.map((i) => ({ product_slug: i.product_slug, variant_sku: i.variant_sku || "", quantity: i.quantity })),
      shipping_cents: selectedShippingCents !== null ? selectedShippingCents : 0,
    };
    if (appliedCode) body.discount_code = appliedCode;
    if (email) body.email = email;
    api.post("/checkout/quote-cart", body)
      .then(({ data }) => {
        setQuote(data);
        // If the server invalidated the code (expired since apply, etc.), drop it.
        if (appliedCode && data?.discount?.error) {
          setCodeError(data.discount.error);
          setAppliedCode("");
        }
      })
      .catch(() => {});
  }, [items, selectedShippingCents, appliedCode, email]);

  // Auto-apply ?code=XYZ from URL (or sessionStorage if user arrived via /shop?code=…).
  useEffect(() => {
    if (appliedCode) return;
    const fromUrl = (searchParams.get("code") || "").trim();
    const fromSession = (typeof window !== "undefined" && sessionStorage.getItem("mr_discount_code")) || "";
    const candidate = (fromUrl || fromSession || "").trim();
    if (!candidate) return;
    setCodeInput(candidate.toUpperCase());
    // Defer to next tick so handler can use up-to-date state
    setTimeout(() => applyCode(candidate), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shippingValid = fullName && email && line1 && city && state && postal && country && !!selectedRate;

  const applyCode = async (raw) => {
    const code = (raw || codeInput || "").trim().toUpperCase();
    if (!code) return;
    setCodeBusy(true); setCodeError("");
    try {
      const subtotalCents = items.reduce((s, i) => s + (i.unit_price_cents * i.quantity), 0);
      const { data } = await api.post("/checkout/validate-discount", {
        code,
        items: items.map((i) => ({ product_slug: i.product_slug, variant_sku: i.variant_sku || "", quantity: i.quantity, unit_price_cents: i.unit_price_cents })),
        subtotal_cents: subtotalCents,
        shipping_cents: selectedShippingCents || 0,
        email: email || undefined,
      });
      if (data?.ok) {
        setAppliedCode(code);
        setCodeInput(code);
        try { sessionStorage.setItem("mr_discount_code", code); } catch {}
        toast.success(`Code ${code} applied — ${data.notes}`);
      }
    } catch (err) {
      setCodeError(err.response?.data?.detail || "Invalid code.");
      setAppliedCode("");
    } finally {
      setCodeBusy(false);
    }
  };

  const removeCode = () => {
    setAppliedCode("");
    setCodeInput("");
    setCodeError("");
    try { sessionStorage.removeItem("mr_discount_code"); } catch {}
  };

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
      const errMsg = tokenResult.errors?.[0]?.message || "Could not validate your card. Please check the details and try again.";
      toast.error(errMsg);
      setBusy(false);
      return;
    }
    if (!selectedRate) {
      toast.error("Please select a shipping option.");
      setBusy(false);
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post("/checkout/square", {
        items: items.map((i) => ({ product_slug: i.product_slug, variant_sku: i.variant_sku || "", quantity: i.quantity })),
        email,
        full_name: fullName,
        shipping_address: { line1, line2, city, state, postal_code: postal, country },
        source_id: tokenResult.token,
        verification_token: verifiedBuyer?.token,
        shipping_cents: selectedRate.shipping_cents,
        shipping_service: selectedRate.service_type,
        shipping_carrier: selectedRate.carrier_name,
        shipping_rate_id: selectedRate.rate_id,
        discount_code: appliedCode || "",
      });
      setStoredVisitor({ name: fullName, email, audience: v.audience });
      setSubmittedOrder(data);
      try { sessionStorage.removeItem("mr_discount_code"); } catch {}
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
                <Field label="Address line 1" full>
                  <AddressAutocomplete
                    value={line1}
                    onChange={(v) => setLine1(v)}
                    onPlaceSelected={(p) => {
                      setLine1(p.line1 || "");
                      if (p.city) setCity(p.city);
                      if (p.state) setState(p.state);
                      if (p.postal_code) setPostal(p.postal_code);
                      if (p.country) setCountry(p.country);
                    }}
                    placeholder="Start typing your address..."
                    className="inp"
                    testid="ship-line1"
                  />
                </Field>
                <Field label="Address line 2 (optional)" full><input value={line2} onChange={(e) => setLine2(e.target.value)} className="inp" data-testid="ship-line2" autoComplete="address-line2" /></Field>
                <Field label="City"><input value={city} onChange={(e) => setCity(e.target.value)} className="inp" data-testid="ship-city" autoComplete="address-level2" /></Field>
                <Field label="State / Province"><input value={state} onChange={(e) => setState(e.target.value)} className="inp" data-testid="ship-state" autoComplete="address-level1" /></Field>
                <Field label="Postal code"><input value={postal} onChange={(e) => setPostal(e.target.value)} className="inp" data-testid="ship-postal" autoComplete="postal-code" /></Field>
                <Field label="Country"><input value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} maxLength={2} className="inp" data-testid="ship-country" autoComplete="country" /></Field>
              </div>
            </section>

            <section className="bg-white rounded-[28px] p-6" data-testid="checkout-shipping-rates">
              <h2 className="font-accent text-2xl font-bold mb-4 flex items-center gap-2"><Truck className="w-5 h-5 text-[#5a8a6f]" /> Shipping method</h2>
              {!addressReady && (
                <p className="text-sm text-[#6b7280]">Fill in your shipping address above to see live carrier rates.</p>
              )}
              {addressReady && ratesLoading && (
                <div className="flex items-center gap-2 text-sm text-[#6b7280]" data-testid="rates-loading">
                  <Loader2 className="w-4 h-4 animate-spin" /> Fetching live carrier rates...
                </div>
              )}
              {addressReady && !ratesLoading && ratesError && (
                <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-2xl p-3" data-testid="rates-error">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{ratesError}</span>
                </div>
              )}
              {addressReady && !ratesLoading && !ratesError && rates.length > 0 && (
                <ul className="space-y-2" data-testid="rates-list">
                  {rates.map((r) => {
                    const selected = r.rate_id === selectedRateId;
                    return (
                      <li key={r.rate_id}>
                        <label
                          className={`flex items-start gap-3 p-3 rounded-2xl border-2 cursor-pointer transition ${selected ? "border-[#7fcfc7] bg-[#eaf7f5]" : "border-[#f4e4c6] hover:border-[#cfe0d8]"}`}
                          data-testid={`rate-option-${r.service_code || r.rate_id}`}
                        >
                          <input
                            type="radio"
                            name="shipping-rate"
                            className="mt-1.5 accent-[#5a8a6f]"
                            checked={selected}
                            onChange={() => setSelectedRateId(r.rate_id)}
                            data-testid={`rate-radio-${r.service_code || r.rate_id}`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-3">
                              <div className="font-semibold text-[#3a4a55] truncate">{r.service_type}</div>
                              <div className="tabular-nums font-bold text-[#3a4a55]">{money(r.shipping_cents)}</div>
                            </div>
                            <div className="text-xs text-[#6b7280] mt-0.5">
                              {r.carrier_name}
                              {r.delivery_days ? ` · ~${r.delivery_days} business day${r.delivery_days === 1 ? "" : "s"}` : ""}
                              {r.rate_attributes?.includes("cheapest") ? " · Cheapest" : ""}
                              {r.rate_attributes?.includes("fastest") ? " · Fastest" : ""}
                            </div>
                          </div>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="bg-white rounded-[28px] p-6" data-testid="checkout-discount">
              <h2 className="font-accent text-2xl font-bold mb-4 flex items-center gap-2"><Tag className="w-5 h-5 text-[#5a8a6f]" /> Discount code</h2>
              {appliedCode ? (
                <div className="flex items-center justify-between bg-[#eaf7f5] border-2 border-[#7fcfc7] rounded-2xl p-3" data-testid="discount-applied">
                  <div className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-[#5a8a6f]" />
                    <div>
                      <div className="font-mono font-bold text-[#3a4a55]">{appliedCode}</div>
                      {quote?.discount?.notes && <div className="text-xs text-[#6b7280]">{quote.discount.notes}</div>}
                    </div>
                  </div>
                  <button onClick={removeCode} className="p-2 rounded-full hover:bg-white" aria-label="Remove discount" data-testid="discount-remove"><XIcon className="w-4 h-4" /></button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={codeInput}
                    onChange={(e) => { setCodeInput(e.target.value.toUpperCase().replace(/\s+/g, "")); setCodeError(""); }}
                    onKeyDown={(e) => { if (e.key === "Enter") applyCode(); }}
                    placeholder="Enter code"
                    className="inp font-mono uppercase tracking-wider flex-1"
                    data-testid="discount-input"
                  />
                  <button onClick={() => applyCode()} disabled={codeBusy || !codeInput.trim()} className="btn-secondary disabled:opacity-50" data-testid="discount-apply">
                    {codeBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
                  </button>
                </div>
              )}
              {codeError && <div className="text-sm text-red-700 mt-2 flex items-center gap-1" data-testid="discount-error"><AlertCircle className="w-4 h-4" />{codeError}</div>}
            </section>

            <section className="bg-white rounded-[28px] p-6" data-testid="checkout-payment">
              <h2 className="font-accent text-2xl font-bold mb-4 flex items-center gap-2"><Lock className="w-5 h-5 text-[#5a8a6f]" /> Payment</h2>
              {!shippingValid && (
                <p className="text-sm text-[#6b7280] mb-3">
                  {!addressReady ? "Fill in your shipping address above to enter card details." :
                    !selectedRate ? "Select a shipping method above to enter card details." :
                    "Fill in your full name and email above to enter card details."}
                </p>
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
                {quote.discount_cents > 0 && (
                  <div className="flex justify-between text-[#5a8a6f]" data-testid="summary-discount-row">
                    <dt>Discount {appliedCode ? `(${appliedCode})` : ""}</dt>
                    <dd data-testid="summary-discount">−{money(quote.discount_cents)}</dd>
                  </div>
                )}
                <div className="flex justify-between"><dt>NY Tax</dt><dd>{money(quote.tax_cents)}</dd></div>
                <div className="flex justify-between">
                  <dt>
                    Shipping
                    {selectedRate && <span className="block text-xs text-[#6b7280]">{selectedRate.service_type}</span>}
                  </dt>
                  <dd data-testid="summary-shipping">{money(quote.shipping_cents)}</dd>
                </div>
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
