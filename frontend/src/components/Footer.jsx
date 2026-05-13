import { useEffect, useState } from "react";
import { useSite } from "../lib/site";
import { api } from "../lib/api";
import { Facebook, Instagram, Youtube, Twitter, Linkedin } from "lucide-react";
import { toast } from "sonner";

export default function Footer() {
  const site = useSite();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [customPages, setCustomPages] = useState([]);

  useEffect(() => {
    import("../lib/api").then(({ api }) => {
      api.get("/custom-pages").then(({ data }) => setCustomPages(data.filter((p) => p.show_in_footer))).catch(() => {});
    });
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/mailing-list", { email, source: "footer" });
      toast.success("You're on the list! Wave hello soon.");
      setEmail("");
    } catch (err) {
      toast.error("Something went wrong. Please try again.");
    } finally { setBusy(false); }
  };

  const socials = [
    { url: site.facebook_url, icon: Facebook, label: "Facebook" },
    { url: site.instagram_url, icon: Instagram, label: "Instagram" },
    { url: site.youtube_url, icon: Youtube, label: "YouTube" },
    { url: site.twitter_url, icon: Twitter, label: "X/Twitter" },
    { url: site.linkedin_url, icon: Linkedin, label: "LinkedIn" },
  ].filter((s) => s.url);

  return (
    <footer className="bg-[#fffbf3] border-t border-[#f4e4c6] mt-16" data-testid="site-footer">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-12 grid md:grid-cols-3 gap-10">
        <div>
          <h3 className="font-accent text-2xl font-bold mb-3">{site.site_name || "Myrtle and Ray"}</h3>
          <p className="text-[#4a5568] leading-relaxed">A rhyming picture book about being brave on your very first day. Catch the W.A.V.E. of Excitement with Myrtle, Ray, and every Sea Star at Stingray Cay.</p>
          <p className="mt-4 text-sm text-[#6b7280]">By Marissa Allaben & Alison Rothenberg · Edited by Brian Stein · Published by KingApe Media</p>
        </div>
        <div>
          <h4 className="font-accent text-lg font-bold mb-3">Send the Wave Your Way</h4>
          <form onSubmit={submit} className="flex gap-2" data-testid="footer-signup-form">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com"
              className="flex-1 px-4 py-3 rounded-full border-2 border-[#f4e4c6] bg-white focus:outline-none focus:border-[#7fcfc7]" data-testid="footer-signup-input" />
            <button disabled={busy} className="btn-primary" data-testid="footer-signup-submit">{busy ? "..." : "Join"}</button>
          </form>
          <div className="flex gap-3 mt-5">
            {socials.map((s) => (
              <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer" aria-label={s.label} className="w-10 h-10 rounded-full bg-white border-2 border-[#f4e4c6] grid place-items-center hover:border-[#7fcfc7] transition" data-testid={`footer-social-${s.label.toLowerCase()}`}>
                <s.icon className="w-5 h-5 text-[#5a8a6f]" />
              </a>
            ))}
          </div>
        </div>
        <div className="text-sm text-[#6b7280]">
          <h4 className="font-accent text-lg font-bold mb-3 text-[#2e3a3a]">Quick Links</h4>
          <ul className="space-y-2">
            <li><a className="hover:text-[#5a8a6f]" href="/story">Meet the Sea Stars</a></li>
            <li><a className="hover:text-[#5a8a6f]" href="/downloads">Free Downloads</a></li>
            <li><a className="hover:text-[#5a8a6f]" href="/for-camps">For Camp Directors</a></li>
            <li><a className="hover:text-[#5a8a6f]" href="/contact">Contact</a></li>
            {customPages.map((p) => (
              <li key={p.slug}><a className="hover:text-[#5a8a6f]" href={`/p/${p.slug}`}>{p.title}</a></li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-[#f4e4c6] py-4 text-center text-xs text-[#6b7280]" data-testid="footer-copyright">{site.footer_text || "© 2026 KingApe Media. All rights reserved."}</div>
    </footer>
  );
}
