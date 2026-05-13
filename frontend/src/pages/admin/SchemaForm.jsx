import { useRef, useState } from "react";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { Plus, Trash2, ChevronDown, ChevronUp, Upload, GripVertical } from "lucide-react";

// Render a list of typed fields against a plain object value.
export default function SchemaForm({ fields, value, onChange }) {
  const set = (key, v) => onChange({ ...value, [key]: v });
  return (
    <div className="space-y-4">
      {fields.map((f) => (
        <FieldRow key={f.key} field={f} value={value?.[f.key]} onChange={(v) => set(f.key, v)} />
      ))}
    </div>
  );
}

function FieldRow({ field, value, onChange }) {
  switch (field.type) {
    case "text":
      return <Label text={field.label}><input value={value || ""} onChange={(e) => onChange(e.target.value)} className="inp" data-testid={`field-${field.key}`} /></Label>;
    case "textarea":
      return <Label text={field.label}><textarea value={value || ""} onChange={(e) => onChange(e.target.value)} rows={4} className="inp min-h-[110px]" data-testid={`field-${field.key}`} /></Label>;
    case "number":
      return <Label text={field.label}><input type="number" value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} className="inp max-w-[200px]" data-testid={`field-${field.key}`} /></Label>;
    case "color":
      return (
        <Label text={field.label}>
          <div className="flex gap-2 items-center">
            <input type="color" value={value || "#a8e6e1"} onChange={(e) => onChange(e.target.value)} className="w-14 h-10 rounded-md border border-[#f4e4c6]" />
            <input value={value || ""} onChange={(e) => onChange(e.target.value)} className="inp max-w-[180px]" />
          </div>
        </Label>
      );
    case "image":
      return <Label text={field.label}><ImageField value={value} onChange={onChange} testid={`field-${field.key}`} /></Label>;
    case "csv":
      return (
        <Label text={field.label}>
          <input
            value={Array.isArray(value) ? value.join(", ") : ""}
            onChange={(e) => onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
            className="inp"
          />
        </Label>
      );
    case "csv-num":
      return (
        <Label text={field.label}>
          <input
            value={Array.isArray(value) ? value.join(", ") : ""}
            onChange={(e) => onChange(e.target.value.split(",").map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n)))}
            className="inp"
          />
        </Label>
      );
    case "lines":
      return (
        <Label text={field.label}>
          <textarea
            rows={8}
            value={Array.isArray(value) ? value.join("\n") : ""}
            onChange={(e) => onChange(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
            className="inp min-h-[160px]"
          />
        </Label>
      );
    case "list":
      return <ListField field={field} value={value} onChange={onChange} />;
    default:
      return <div className="text-xs text-red-500">Unknown field: {field.type}</div>;
  }
}

function Label({ text, children }) {
  return (
    <label className="block text-sm">
      <div className="font-semibold text-[#3a4a55] mb-1">{text}</div>
      {children}
    </label>
  );
}

function ImageField({ value, onChange, testid }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const upload = async (file) => {
    setBusy(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const { data } = await api.post("/admin/media/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      onChange(data.url);
      toast.success("Uploaded");
    } catch (err) { toast.error(err.response?.data?.detail || "Upload failed"); }
    finally { setBusy(false); }
  };
  return (
    <div className="flex gap-3 items-start">
      <div className="flex-1 space-y-2">
        <input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="Paste image URL or upload" className="inp" data-testid={testid} />
        <div className="flex gap-2">
          <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="btn-secondary text-xs"><Upload className="w-4 h-4" />{busy ? "Uploading..." : "Upload"}</button>
          {value && <button type="button" onClick={() => onChange("")} className="btn-ghost text-xs text-red-500"><Trash2 className="w-4 h-4" />Clear</button>}
          <input ref={ref} type="file" hidden accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
        </div>
      </div>
      {value && <img src={value} alt="" className="w-20 h-20 rounded-2xl object-cover border-2 border-[#f4e4c6]" />}
    </div>
  );
}

function ListField({ field, value, onChange }) {
  const items = Array.isArray(value) ? value : [];
  const [openIdx, setOpenIdx] = useState(null);

  const addItem = () => {
    const blank = field.valueIsString ? "" : Object.fromEntries((field.itemSchema || []).map((s) => [s.key, defaultForType(s.type)]));
    onChange([...items, blank]);
    setOpenIdx(items.length);
  };
  const removeItem = (idx) => onChange(items.filter((_, i) => i !== idx));
  const move = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };
  const updateItem = (idx, patch) => {
    const next = [...items];
    if (field.valueIsString) {
      next[idx] = patch.value ?? "";
    } else {
      next[idx] = { ...(next[idx] || {}), ...patch };
    }
    onChange(next);
  };

  return (
    <div className="border-2 border-[#f4e4c6] rounded-3xl p-3 bg-[#fffbf3]">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold text-[#3a4a55]">{field.label}</div>
        <button type="button" onClick={addItem} className="btn-primary text-xs" data-testid={`list-add-${field.key}`}><Plus className="w-4 h-4" />Add</button>
      </div>
      {items.length === 0 && <div className="text-xs text-[#5a6b76] py-3 text-center">Nothing yet — tap Add.</div>}
      <div className="space-y-2">
        {items.map((it, idx) => {
          const label = field.itemLabel ? field.itemLabel(it, idx) : `Item ${idx + 1}`;
          const isOpen = openIdx === idx;
          return (
            <div key={idx} className="bg-white border border-[#f4e4c6] rounded-2xl overflow-hidden" data-testid={`list-${field.key}-${idx}`}>
              <div className="flex items-center gap-2 p-2">
                <GripVertical className="w-4 h-4 text-[#5a6b76]" />
                <button type="button" onClick={() => setOpenIdx(isOpen ? null : idx)} className="flex-1 text-left text-sm font-semibold truncate">{label}</button>
                <div className="flex gap-1">
                  <button type="button" onClick={() => move(idx, -1)} className="text-xs px-2 py-1 hover:bg-gray-100 rounded">↑</button>
                  <button type="button" onClick={() => move(idx, 1)} className="text-xs px-2 py-1 hover:bg-gray-100 rounded">↓</button>
                  <button type="button" onClick={() => setOpenIdx(isOpen ? null : idx)} className="text-xs px-2 py-1 hover:bg-gray-100 rounded">{isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>
                  <button type="button" onClick={() => removeItem(idx)} className="text-xs px-2 py-1 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              {isOpen && (
                <div className="p-3 border-t border-[#f4e4c6] space-y-3">
                  {field.valueIsString ? (
                    <Label text={field.itemSchema?.[0]?.label || "Value"}>
                      <input value={it || ""} onChange={(e) => updateItem(idx, { value: e.target.value })} className="inp" />
                    </Label>
                  ) : (
                    <SchemaForm fields={field.itemSchema || []} value={it || {}} onChange={(v) => onChange([...items.slice(0, idx), v, ...items.slice(idx + 1)])} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function defaultForType(t) {
  if (t === "number") return 0;
  if (t === "list") return [];
  if (t === "csv" || t === "csv-num" || t === "lines") return [];
  return "";
}
