import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Tent } from "lucide-react";

export default function ForCamps() {
  const [content, setContent] = useState({ benefits: [], tiers: [], intro: "" });
  const [form, setForm] = useState({ name: "", camp_name: "", email: "", phone: "", quantity: "", order_date: "", message: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/pages/for_camps").then(({ data }) => setContent(data.content || {})).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await api.post("/wholesale", form); toast.success("Wholesale inquiry sent — we'll be in touch within 2 business days."); setForm({ name: "", camp_name: "", email: "", phone: "", quantity: "", order_date: "", message: "" }); }
    catch { toast.error("Try again in a moment."); }
    finally { setBusy(false); }
  };

  return (
    <main className="pt-24 pb-12 bg-foam-grad min-h-screen" data-testid="for-camps-page">
      <div className="max-w-5xl mx-auto px-4 md:px-6">
        <header className="text-center mb-8">
          <Tent className="w-10 h-10 text-[#3cb371] mx-auto mb-3" />
          <h1 className="font-accent text-5xl md:text-6xl font-bold">Bring Stingray Cay to Your Camp</h1>
          <p className="text-[#4a5568] mt-3 max-w-2xl mx-auto">{content.intro || "Set a positive tone on opening day with a story your campers will quote all summer."}</p>
        </header>

        {content.benefits?.length > 0 && (
          <section className="card-soft p-6 md:p-10 mb-10" data-testid="benefits-list">
            <h2 className="font-accent text-2xl font-bold mb-4">Why Camp Directors Love It</h2>
            <ul className="grid sm:grid-cols-2 gap-3">
              {content.benefits.map((b, i) => <li key={i} className="flex items-start gap-2"><span className="text-[#ff9b71] font-bold">✦</span><span className="text-[#4a5568]">{b}</span></li>)}
            </ul>
          </section>
        )}

        {content.tiers?.length > 0 && (
          <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10" data-testid="bulk-tiers">
            {content.tiers.map((t, i) => (
              <div key={i} className="card-soft p-5 text-center">
                <div className="font-accent text-3xl font-bold text-[#40e0d0]">{t.qty}+</div>
                <div className="text-[#6b7280] mt-1">copies</div>
                <div className="mt-2 font-accent text-xl font-bold text-[#2e3a3a]">${t.price_per?.toFixed?.(2) || t.price_per}</div>
                <div className="text-xs text-[#6b7280]">per book</div>
              </div>
            ))}
          </section>
        )}

        <section className="card-soft p-6 md:p-10" data-testid="wholesale-form">
          <h2 className="font-accent text-2xl font-bold mb-4">Request a Wholesale Quote</h2>
          <form onSubmit={submit} className="grid sm:grid-cols-2 gap-4">
            <input required placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="px-4 py-3 rounded-full border-2 border-[#fde6c8] focus:outline-none focus:border-[#40e0d0]" data-testid="wholesale-name" />
            <input placeholder="Camp name" value={form.camp_name} onChange={(e) => setForm({ ...form, camp_name: e.target.value })} className="px-4 py-3 rounded-full border-2 border-[#fde6c8] focus:outline-none focus:border-[#40e0d0]" data-testid="wholesale-camp" />
            <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="px-4 py-3 rounded-full border-2 border-[#fde6c8] focus:outline-none focus:border-[#40e0d0]" data-testid="wholesale-email" />
            <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="px-4 py-3 rounded-full border-2 border-[#fde6c8] focus:outline-none focus:border-[#40e0d0]" data-testid="wholesale-phone" />
            <input placeholder="Quantity (e.g. 50)" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="px-4 py-3 rounded-full border-2 border-[#fde6c8] focus:outline-none focus:border-[#40e0d0]" data-testid="wholesale-qty" />
            <input placeholder="Needed by (date)" value={form.order_date} onChange={(e) => setForm({ ...form, order_date: e.target.value })} className="px-4 py-3 rounded-full border-2 border-[#fde6c8] focus:outline-none focus:border-[#40e0d0]" data-testid="wholesale-date" />
            <textarea placeholder="Tell us about your camp" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={4} className="sm:col-span-2 px-4 py-3 rounded-3xl border-2 border-[#fde6c8] focus:outline-none focus:border-[#40e0d0]" data-testid="wholesale-message" />
            <button disabled={busy} className="btn-primary sm:col-span-2 justify-center" data-testid="wholesale-submit">{busy ? "Sending..." : "Request a Quote"}</button>
          </form>
        </section>
      </div>
    </main>
  );
}
