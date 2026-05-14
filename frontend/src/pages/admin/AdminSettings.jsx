import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { Save } from "lucide-react";
import MusicPlaylistManager from "./MusicPlaylistManager";

const SECTIONS = [
  { title: "Site identity", fields: [["site_name", "Site name"], ["tagline", "Tagline"], ["logo_url", "Logo URL"], ["favicon_url", "Favicon URL"], ["footer_text", "Footer copyright text"]] },
  { title: "Store URLs", fields: [["amazon_book_url", "Amazon book URL"], ["printify_popup_url", "Printify pop-up store URL"]] },
  { title: "Email routing (defaults to community@rollingriver.com)", placeholder: "community@rollingriver.com", fields: [["primary_contact_email", "Primary contact email"], ["contact_form_email", "Contact form recipient"], ["wholesale_email", "Wholesale inquiry recipient"], ["press_email", "Press inquiries email"], ["mailing_list_reply_to", "Mailing list reply-to"], ["download_capture_email", "Download capture notifications"], ["password_reset_email", "Admin password reset destination"], ["admin_login_alert_email", "Admin login alert destination"]] },
  { title: "Outgoing email", fields: [["outgoing_from_email", "Outgoing 'from' address"]] },
  { title: "Social links", fields: [["facebook_url", "Facebook"], ["instagram_url", "Instagram"], ["tiktok_url", "TikTok"], ["youtube_url", "YouTube"], ["pinterest_url", "Pinterest"], ["twitter_url", "X/Twitter"], ["threads_url", "Threads"], ["linkedin_url", "LinkedIn"]] },
  { title: "Tracking", fields: [["google_analytics_id", "Google Analytics ID"], ["meta_pixel_id", "Meta Pixel ID"]] },
];

export default function AdminSettings() {
  const [s, setS] = useState(null);
  useEffect(() => { api.get("/admin/settings").then(({ data }) => setS(data)); }, []);
  const set = (k, v) => setS({ ...s, [k]: v });

  // Auto-save the playlist whenever it changes (so the user doesn't have to click Save)
  const setPlaylist = async (newUrls) => {
    setS({ ...s, ambient_audio_urls: newUrls });
    try {
      const payload = { ...s, ambient_audio_urls: newUrls };
      delete payload._id;
      await api.put("/admin/settings", payload);
      toast.success("Playlist saved");
    } catch { toast.error("Save failed"); }
  };

  const save = async () => {
    try {
      const payload = { ...s };
      delete payload._id;
      await api.put("/admin/settings", payload);
      toast.success("Settings saved");
    } catch { toast.error("Save failed"); }
  };

  if (!s) return <div>Loading...</div>;

  const playlist = Array.isArray(s.ambient_audio_urls) ? s.ambient_audio_urls : (s.ambient_audio_url ? [s.ambient_audio_url] : []);

  return (
    <div data-testid="admin-settings">
      <h1 className="font-accent text-3xl font-bold mb-1">Site & Email Settings</h1>
      <p className="text-[#6b7280] mb-6">All public-facing site values and email routing live here.</p>
      <div className="space-y-6">
        <MusicPlaylistManager urls={playlist} onChange={setPlaylist} />
        {SECTIONS.map((sec) => (
          <section key={sec.title} className="card-soft p-5">
            <h3 className="font-accent text-lg font-bold mb-3">{sec.title}</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {sec.fields.map(([k, label]) => (
                <label key={k} className="text-sm">
                  <div className="font-semibold mb-1">{label}</div>
                  <input value={s[k] || ""} onChange={(e) => set(k, e.target.value)} placeholder={sec.placeholder || ""} className="inp" data-testid={`setting-${k}`} />
                </label>
              ))}
            </div>
          </section>
        ))}
        <section className="card-soft p-5">
          <h3 className="font-accent text-lg font-bold mb-3">Downloads & alerts</h3>
          <label className="flex items-center gap-2"><input type="checkbox" checked={!!s.email_gate_enabled} onChange={(e) => set("email_gate_enabled", e.target.checked)} data-testid="setting-email-gate" />Email gate enabled by default for downloads</label>
          <label className="flex items-center gap-2 mt-2"><input type="checkbox" checked={!!s.admin_login_alert_enabled} onChange={(e) => set("admin_login_alert_enabled", e.target.checked)} />Send me an email when someone logs into admin</label>
        </section>
      </div>
      <button onClick={save} className="btn-primary mt-6" data-testid="settings-save"><Save className="w-4 h-4" />Save All Settings</button>
      <style>{`.inp{width:100%;padding:10px 14px;border-radius:9999px;border:2px solid #f4e4c6;background:white;font-size:14px}.inp:focus{outline:none;border-color:#7fcfc7}`}</style>
    </div>
  );
}
