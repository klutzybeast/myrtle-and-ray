import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { Plus, Trash2, Edit2, X, Tag, Calendar, Users, ShoppingBag, Copy, Check, Power, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const TYPES = [
  { value: "percent", label: "Percentage off" },
  { value: "fixed", label: "Fixed $ off" },
  { value: "free_shipping", label: "Free shipping" },
  { value: "bogo", label: "Buy-one-get-one (BOGO)" },
];

function blank() {
  return {
    code: "",
    description: "",
    type: "percent",
    value: 10,
    active: true,
    starts_at: "",
    expires_at: "",
    max_total_uses: 0,
    max_per_customer: 0,
    min_subtotal_cents: 0,
    allowed_product_slugs: [],
    allowed_categories: [],
    bogo_product_slug: "",
  };
}

function money(c) { return `$${((c || 0) / 100).toFixed(2)}`; }

function dtLocal(iso) {
  if (!iso) return "";
  // Format ISO to local datetime-local input value (YYYY-MM-DDTHH:mm)
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60_000);
  return local.toISOString().slice(0, 16);
}

function dtToIso(local) {
  if (!local) return "";
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

export default function AdminDiscounts() {
  const [rows, setRows] = useState([]);
  const [stuffies, setStuffies] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState("");

  const refresh = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/discounts");
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error("Failed to load discounts");
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    api.get("/products?category=Stuffies").then(({ data }) => setStuffies(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);

  const save = async (form) => {
    const payload = {
      ...form,
      code: (form.code || "").trim().toUpperCase(),
      value: Number(form.value) || 0,
      max_total_uses: Number(form.max_total_uses) || 0,
      max_per_customer: Number(form.max_per_customer) || 0,
      min_subtotal_cents: Math.round((Number(form.min_subtotal_dollars) || 0) * 100),
      starts_at: dtToIso(form.starts_at_local),
      expires_at: dtToIso(form.expires_at_local),
    };
    delete payload.min_subtotal_dollars;
    delete payload.starts_at_local;
    delete payload.expires_at_local;

    try {
      if (editing?.id) {
        await api.patch(`/admin/discounts/${editing.id}`, payload);
        toast.success("Saved");
      } else {
        await api.post("/admin/discounts", payload);
        toast.success("Created");
      }
      setEditing(null);
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Save failed");
    }
  };

  const del = async (row) => {
    if (!window.confirm(`Delete code ${row.code}? Existing redemptions will remain.`)) return;
    try {
      await api.delete(`/admin/discounts/${row.id}`);
      toast.success("Deleted");
      refresh();
    } catch {
      toast.error("Delete failed");
    }
  };

  const toggleActive = async (row) => {
    try {
      await api.patch(`/admin/discounts/${row.id}`, { active: !row.active });
      refresh();
    } catch {
      toast.error("Toggle failed");
    }
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(code);
      setTimeout(() => setCopied(""), 1500);
    });
  };

  const copyShareLink = (code) => {
    const link = `${window.location.origin}/shop?code=${encodeURIComponent(code)}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(`link-${code}`);
      toast.success("Share link copied");
      setTimeout(() => setCopied(""), 1500);
    });
  };

  const sorted = useMemo(() => [...rows].sort((a, b) => (a.code || "").localeCompare(b.code || "")), [rows]);

  return (
    <div data-testid="admin-discounts">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="font-accent text-3xl font-bold flex items-center gap-2"><Tag className="w-7 h-7 text-[#5a8a6f]" /> Discount Codes</h1>
          <p className="text-sm text-[#6b7280] mt-1">Codes apply at the Shop cart only (not Camp wholesale or downloads).</p>
        </div>
        <button onClick={() => setEditing(blank())} className="btn-primary inline-flex" data-testid="admin-discount-new">
          <Plus className="w-4 h-4" /> New code
        </button>
      </div>

      {loading ? (
        <div className="text-[#6b7280]">Loading…</div>
      ) : sorted.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center text-[#6b7280]" data-testid="admin-discounts-empty">
          <Tag className="w-10 h-10 mx-auto mb-3 text-[#cbd5e1]" />
          <div className="font-semibold mb-1">No discount codes yet</div>
          <div className="text-sm">Click "New code" to create your first one.</div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl overflow-hidden border border-[#f4e4c6]" data-testid="admin-discounts-list">
          <table className="w-full text-sm">
            <thead className="bg-[#f8fafc] text-[#3a4a55]">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Code</th>
                <th className="text-left px-4 py-3 font-semibold">Type</th>
                <th className="text-left px-4 py-3 font-semibold">Value</th>
                <th className="text-left px-4 py-3 font-semibold">Used</th>
                <th className="text-left px-4 py-3 font-semibold">Expires</th>
                <th className="text-left px-4 py-3 font-semibold">Active</th>
                <th className="text-right px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((d) => (
                <tr key={d.id} className="border-t border-[#f4e4c6]" data-testid={`discount-row-${d.code}`}>
                  <td className="px-4 py-3">
                    <button onClick={() => copyCode(d.code)} className="font-mono font-bold text-[#5a8a6f] hover:underline inline-flex items-center gap-1">
                      {d.code}
                      {copied === d.code ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 opacity-50" />}
                    </button>
                    {d.description && <div className="text-xs text-[#6b7280] truncate max-w-[18rem]">{d.description}</div>}
                  </td>
                  <td className="px-4 py-3">
                    {d.type === "percent" && "% off"}
                    {d.type === "fixed" && "$ off"}
                    {d.type === "free_shipping" && "Free ship"}
                    {d.type === "bogo" && "BOGO"}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {d.type === "percent" ? `${d.value}%` :
                     d.type === "fixed" ? `$${Number(d.value || 0).toFixed(2)}` :
                     d.type === "free_shipping" ? "—" :
                     d.type === "bogo" ? (d.bogo_product_slug || "—") : "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {d.usage_count || 0}{d.max_total_uses ? ` / ${d.max_total_uses}` : ""}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#4a5568]">
                    {d.expires_at ? new Date(d.expires_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActive(d)} className={`inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-1 ${d.active ? "bg-[#d1fae5] text-[#065f46]" : "bg-[#fee2e2] text-[#991b1b]"}`} data-testid={`discount-toggle-${d.code}`}>
                      <Power className="w-3 h-3" />{d.active ? "Active" : "Off"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <button onClick={() => copyShareLink(d.code)} title="Copy share link" className="p-2 rounded-full hover:bg-[#eef9fb]" data-testid={`discount-share-${d.code}`}>
                        <ExternalLink className="w-4 h-4 text-[#5a8a6f]" />
                      </button>
                      <button onClick={() => setEditing({
                        ...d,
                        min_subtotal_dollars: ((d.min_subtotal_cents || 0) / 100).toFixed(2),
                        starts_at_local: dtLocal(d.starts_at),
                        expires_at_local: dtLocal(d.expires_at),
                      })} title="Edit" className="p-2 rounded-full hover:bg-[#eef9fb]" data-testid={`discount-edit-${d.code}`}>
                        <Edit2 className="w-4 h-4 text-[#3a4a55]" />
                      </button>
                      <button onClick={() => del(d)} title="Delete" className="p-2 rounded-full hover:bg-red-50" data-testid={`discount-delete-${d.code}`}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && <DiscountEditor initial={editing} onClose={() => setEditing(null)} onSave={save} stuffies={stuffies} />}
    </div>
  );
}

function DiscountEditor({ initial, onClose, onSave, stuffies }) {
  const [form, setForm] = useState({
    ...blank(),
    ...initial,
    min_subtotal_dollars: initial.min_subtotal_dollars ?? ((initial.min_subtotal_cents || 0) / 100).toFixed(2),
    starts_at_local: initial.starts_at_local ?? "",
    expires_at_local: initial.expires_at_local ?? "",
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleSlug = (slug) => {
    setForm((f) => {
      const list = f.allowed_product_slugs || [];
      return { ...f, allowed_product_slugs: list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug] };
    });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose} data-testid="discount-editor-modal">
      <div className="bg-white rounded-[28px] max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h2 className="font-accent text-2xl font-bold">{initial.id ? "Edit code" : "New discount code"}</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-[#f3f4f6]" aria-label="Close" data-testid="discount-editor-close"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Code (case-insensitive)">
              <input value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase().replace(/\s+/g, ""))} placeholder="CAMP10" className="inp font-mono" data-testid="discount-input-code" />
            </Field>
            <Field label="Active">
              <select value={form.active ? "1" : "0"} onChange={(e) => set("active", e.target.value === "1")} className="inp" data-testid="discount-input-active">
                <option value="1">Active</option>
                <option value="0">Disabled</option>
              </select>
            </Field>
          </div>

          <Field label="Description (admin-only)">
            <input value={form.description || ""} onChange={(e) => set("description", e.target.value)} placeholder="What's this code for?" className="inp" data-testid="discount-input-description" />
          </Field>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Discount type">
              <select value={form.type} onChange={(e) => set("type", e.target.value)} className="inp" data-testid="discount-input-type">
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            {form.type === "percent" && (
              <Field label="Percent off (0–100)">
                <input type="number" min="0" max="100" step="1" value={form.value} onChange={(e) => set("value", e.target.value)} className="inp" data-testid="discount-input-value" />
              </Field>
            )}
            {form.type === "fixed" && (
              <Field label="Dollars off">
                <input type="number" min="0" step="0.01" value={form.value} onChange={(e) => set("value", e.target.value)} className="inp" data-testid="discount-input-value" />
              </Field>
            )}
            {form.type === "bogo" && (
              <Field label="BOGO target product">
                <select value={form.bogo_product_slug || ""} onChange={(e) => set("bogo_product_slug", e.target.value)} className="inp" data-testid="discount-input-bogo-slug">
                  <option value="">— pick a stuffie —</option>
                  {stuffies.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
                </select>
              </Field>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label={<><Calendar className="inline w-4 h-4 mr-1" />Starts at (optional)</>}>
              <input type="datetime-local" value={form.starts_at_local} onChange={(e) => set("starts_at_local", e.target.value)} className="inp" data-testid="discount-input-starts" />
            </Field>
            <Field label={<><Calendar className="inline w-4 h-4 mr-1" />Expires at (optional)</>}>
              <input type="datetime-local" value={form.expires_at_local} onChange={(e) => set("expires_at_local", e.target.value)} className="inp" data-testid="discount-input-expires" />
            </Field>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <Field label={<><Users className="inline w-4 h-4 mr-1" />Max total uses</>}>
              <input type="number" min="0" step="1" value={form.max_total_uses} onChange={(e) => set("max_total_uses", e.target.value)} placeholder="0 = unlimited" className="inp" data-testid="discount-input-max-total" />
            </Field>
            <Field label="Max per customer">
              <input type="number" min="0" step="1" value={form.max_per_customer} onChange={(e) => set("max_per_customer", e.target.value)} placeholder="0 = unlimited" className="inp" data-testid="discount-input-max-per-customer" />
            </Field>
            <Field label="Min order total ($)">
              <input type="number" min="0" step="0.01" value={form.min_subtotal_dollars} onChange={(e) => set("min_subtotal_dollars", e.target.value)} placeholder="0" className="inp" data-testid="discount-input-min-subtotal" />
            </Field>
          </div>

          <Field label={<><ShoppingBag className="inline w-4 h-4 mr-1" />Restrict to specific stuffies (optional — leave empty for all)</>}>
            <div className="grid sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-3 border border-[#f4e4c6] rounded-2xl bg-[#fafbfc]" data-testid="discount-allowed-products">
              {stuffies.length === 0 && <div className="text-xs text-[#6b7280] col-span-2">No stuffies products available.</div>}
              {stuffies.map((s) => {
                const checked = (form.allowed_product_slugs || []).includes(s.slug);
                return (
                  <label key={s.slug} className={`flex items-center gap-2 p-2 rounded-xl cursor-pointer border-2 ${checked ? "border-[#7fcfc7] bg-[#eaf7f5]" : "border-transparent hover:bg-white"}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleSlug(s.slug)} className="accent-[#5a8a6f]" data-testid={`discount-product-${s.slug}`} />
                    <span className="text-sm truncate">{s.name}</span>
                  </label>
                );
              })}
            </div>
          </Field>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="btn-ghost" data-testid="discount-editor-cancel">Cancel</button>
          <button onClick={() => onSave(form)} className="btn-primary" data-testid="discount-editor-save">{initial.id ? "Save changes" : "Create code"}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="text-sm block">
      <div className="font-semibold text-[#3a4a55] mb-1">{label}</div>
      {children}
    </label>
  );
}
