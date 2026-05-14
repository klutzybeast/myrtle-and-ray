import { useState } from "react";
import { X } from "lucide-react";

export default function TagsInput({ value = [], onChange, placeholder = "Type a tag and press Enter or comma", testid = "tags-input" }) {
  const tags = Array.isArray(value) ? value : [];
  const [draft, setDraft] = useState("");

  const commit = (raw) => {
    const fresh = raw.split(",").map((t) => t.trim()).filter(Boolean).filter((t) => !tags.includes(t));
    if (fresh.length) onChange([...tags, ...fresh]);
    setDraft("");
  };
  const remove = (i) => onChange(tags.filter((_, idx) => idx !== i));

  const onKey = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
    } else if (e.key === "Backspace" && !draft && tags.length) {
      onChange(tags.slice(0, -1));
    }
  };

  const onChangeRaw = (e) => {
    const v = e.target.value;
    // If user pastes "a, b, c" or types a comma, auto-commit
    if (v.includes(",")) {
      commit(v);
    } else {
      setDraft(v);
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5 items-center bg-white border-2 border-[#f4e4c6] rounded-2xl px-2.5 py-1.5 focus-within:border-[#7fcfc7]" data-testid={testid}>
      {tags.map((t, i) => (
        <span key={t + i} className="inline-flex items-center gap-1 bg-[#eef9fb] text-[#5a8a6f] text-xs font-semibold px-2 py-0.5 rounded-full" data-testid={`${testid}-tag-${i}`}>
          {t}
          <button type="button" onClick={() => remove(i)} className="hover:text-red-500" aria-label={`Remove ${t}`} data-testid={`${testid}-remove-${i}`}><X className="w-3 h-3" /></button>
        </span>
      ))}
      <input
        value={draft}
        onChange={onChangeRaw}
        onKeyDown={onKey}
        onBlur={() => draft && commit(draft)}
        placeholder={tags.length ? "" : placeholder}
        className="flex-1 min-w-[140px] outline-none text-sm bg-transparent py-1"
        data-testid={`${testid}-field`}
      />
    </div>
  );
}
