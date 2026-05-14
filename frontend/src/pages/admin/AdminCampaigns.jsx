import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Send, Mail } from "lucide-react";

export default function AdminCampaigns() {
  const [items, setItems] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");

  const load = () => api.get("/admin/campaigns").then(({ data }) => setItems(data));
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post("/admin/campaigns", {
        name,
        subject: name,
        blocks: [
          { id: "h1", type: "heading", data: { text: name, level: 2, align: "center" } },
          { id: "p1", type: "paragraph", data: { text: "Hi friends,\n\nWrite your story here.", align: "left" } },
        ],
        background_color: "#fffbf3",
        content_background: "#ffffff",
        text_color: "#3a4a55",
        accent_color: "#f0a988",
        content_width: 600,
      });
      toast.success("Campaign created");
      setShowNew(false); setName("");
      window.location.href = `/admin/campaigns/${data.id}`;
    } catch (err) { toast.error(err.response?.data?.detail || "Create failed"); }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this campaign?")) return;
    await api.delete(`/admin/campaigns/${id}`);
    toast.success("Deleted");
    load();
  };

  return (
    <div data-testid="admin-campaigns">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-accent text-3xl font-bold">Email Campaigns</h1>
          <p className="text-[#5a6b76]">Build and send beautiful emails to your mailing list.</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary"><Plus className="w-5 h-5" />New Campaign</button>
      </header>

      {items.length === 0 ? (
        <div className="card-soft p-10 text-center">
          <Mail className="w-10 h-10 mx-auto text-[#7fcfc7]" />
          <div className="font-accent text-xl mt-2">No campaigns yet</div>
          <p className="text-[#5a6b76] text-sm">Tap "New Campaign" to compose your first email.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((c) => (
            <div key={c.id} className="card-soft p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-accent text-lg font-bold truncate">{c.name}</h3>
                  <div className="text-xs text-[#5a6b76] truncate">{c.subject}</div>
                </div>
                <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${c.status === "sent" ? "bg-[#b8e0c2] text-[#5a8a6f]" : "bg-[#f4e4c6] text-[#8b6f4d]"}`}>{c.status === "sent" ? "Sent" : "Draft"}</span>
              </div>
              <div className="text-xs text-[#5a6b76] mt-2">{(c.blocks || []).length} block{(c.blocks || []).length === 1 ? "" : "s"}{c.total_sent ? ` · sent to ${c.total_sent}` : ""}</div>
              <div className="flex gap-1 mt-3">
                <Link to={`/admin/campaigns/${c.id}`} className="btn-ghost text-xs"><Pencil className="w-3 h-3" />Edit</Link>
                <Link to={`/admin/campaigns/${c.id}#send`} className="btn-ghost text-xs"><Send className="w-3 h-3" />Send</Link>
                <button onClick={() => remove(c.id)} className="btn-ghost text-xs text-red-500"><Trash2 className="w-3 h-3" />Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setShowNew(false)}>
          <form onSubmit={create} className="bg-white rounded-[24px] max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-accent text-2xl font-bold mb-4">New Campaign</h3>
            <input required placeholder="Campaign name / subject line" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-3 rounded-full border-2 border-[#f4e4c6] focus:outline-none focus:border-[#7fcfc7]" />
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={() => setShowNew(false)} className="btn-ghost">Cancel</button>
              <button className="btn-primary">Create</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
