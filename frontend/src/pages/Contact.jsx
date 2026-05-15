import { useState } from "react";
import { useSite } from "../lib/site";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Mail, MessageCircle } from "lucide-react";
import SEO from "../components/SEO";

export default function Contact() {
  const site = useSite();
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await api.post("/contact", form); toast.success("Message sent! We'll wave back soon."); setForm({ name: "", email: "", subject: "", message: "" }); }
    catch { toast.error("Try again in a moment."); }
    finally { setBusy(false); }
  };

  return (
    <main className="pt-24 pb-12 bg-foam-grad min-h-screen" data-testid="contact-page">
      <SEO title="Contact Us" description="Get in touch with Marissa, Alison, and the Myrtle & Ray team." />
      <div className="max-w-3xl mx-auto px-4 md:px-6">
        <header className="text-center mb-8">
          <MessageCircle className="w-10 h-10 text-[#7cbf94] mx-auto mb-3" />
          <h1 className="font-accent text-5xl md:text-6xl font-bold">Wave Hello</h1>
          <p className="text-[#4a5568] mt-2">We love hearing from parents, teachers, and camp directors.</p>
        </header>
        <div className="card-soft p-6 md:p-10">
          <form onSubmit={submit} className="space-y-4">
            <input required placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-3 rounded-full border-2 border-[#f4e4c6] focus:outline-none focus:border-[#7fcfc7]" data-testid="contact-name" />
            <input required type="email" placeholder="your@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-4 py-3 rounded-full border-2 border-[#f4e4c6] focus:outline-none focus:border-[#7fcfc7]" data-testid="contact-email" />
            <input placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="w-full px-4 py-3 rounded-full border-2 border-[#f4e4c6] focus:outline-none focus:border-[#7fcfc7]" data-testid="contact-subject" />
            <textarea required placeholder="Your message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={5} className="w-full px-4 py-3 rounded-3xl border-2 border-[#f4e4c6] focus:outline-none focus:border-[#7fcfc7]" data-testid="contact-message" />
            <button disabled={busy} className="btn-primary w-full justify-center" data-testid="contact-submit">{busy ? "Sending..." : "Send Message"}</button>
          </form>
        </div>
        {site.press_email && (
          <div className="text-center mt-6 text-[#6b7280]">
            <Mail className="w-4 h-4 inline mr-1" /> Press inquiries: <a className="text-[#5a8a6f] font-semibold" href={`mailto:${site.press_email}`}>{site.press_email}</a>
          </div>
        )}
      </div>
    </main>
  );
}
