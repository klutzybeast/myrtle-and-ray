import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Download, Users, Calendar, TrendingUp, Mail } from "lucide-react";

const AUDIENCE_COLORS = {
  Parents: "#8fbfe0",
  Teachers: "#7cbf94",
  "Camp Directors": "#f0a988",
  Kids: "#e89bab",
  Grandparents: "#b8a3d9",
  Unspecified: "#cbd5e1",
};

function fmt(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function AdminAnalytics() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.get("/admin/analytics/downloads")
      .then(({ data }) => setData(data))
      .catch((e) => setErr(e?.response?.data?.detail || "Failed to load analytics"));
  }, []);

  if (err) return <div className="text-red-600" data-testid="analytics-error">{err}</div>;
  if (!data) return <div className="text-[#6b7280]" data-testid="analytics-loading">Loading…</div>;

  const audienceTotal = (data.audience_breakdown || []).reduce((s, a) => s + (a.count || 0), 0);

  const stats = [
    { label: "Total File Clicks", value: data.total_file_clicks, icon: Download, color: "#7fcfc7", testid: "stat-total-clicks" },
    { label: "Email Captures (all-time)", value: data.captures_total, icon: Mail, color: "#f0a988", testid: "stat-captures-total" },
    { label: "Captures This Week", value: data.captures_week, icon: TrendingUp, color: "#8fbfe0", testid: "stat-captures-week" },
    { label: "Captures This Month", value: data.captures_month, icon: Calendar, color: "#b8a3d9", testid: "stat-captures-month" },
  ];

  return (
    <div data-testid="admin-analytics">
      <h1 className="font-accent text-4xl font-bold mb-1">Download Analytics</h1>
      <p className="text-[#6b7280] mb-6">See what's resonating with families, teachers, and camps.</p>

      {/* Top stat cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-3xl p-5 border border-[#f4e4c6]" data-testid={s.testid}>
            <div className="w-10 h-10 rounded-2xl grid place-items-center mb-3" style={{ background: `${s.color}22` }}>
              <s.icon className="w-5 h-5" style={{ color: s.color }} />
            </div>
            <div className="font-accent text-3xl font-bold">{s.value ?? 0}</div>
            <div className="text-sm text-[#6b7280]">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Audience breakdown */}
        <section className="bg-white rounded-3xl p-6 border border-[#f4e4c6]" data-testid="analytics-audience">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-[#5a8a6f]" />
            <h2 className="font-accent text-2xl font-bold">Audience Breakdown</h2>
          </div>
          {audienceTotal === 0 ? (
            <p className="text-sm text-[#6b7280]">No captures yet. Once families download a printable with the email gate, you'll see the split here.</p>
          ) : (
            <ul className="space-y-3">
              {data.audience_breakdown.map((a) => {
                const pct = audienceTotal ? Math.round((a.count / audienceTotal) * 100) : 0;
                const color = AUDIENCE_COLORS[a.audience] || "#cbd5e1";
                return (
                  <li key={a.audience} data-testid={`audience-row-${a.audience.toLowerCase().replace(/\s+/g, "-")}`}>
                    <div className="flex items-center justify-between text-sm font-semibold mb-1">
                      <span>{a.audience}</span>
                      <span className="text-[#6b7280]">{a.count} · {pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#f3f4f6] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Top downloads */}
        <section className="bg-white rounded-3xl p-6 border border-[#f4e4c6]" data-testid="analytics-top-downloads">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-[#5a8a6f]" />
            <h2 className="font-accent text-2xl font-bold">Top Downloads</h2>
          </div>
          {(data.top_downloads || []).length === 0 ? (
            <p className="text-sm text-[#6b7280]">No downloads yet.</p>
          ) : (
            <ul className="divide-y divide-[#f4e4c6]">
              {data.top_downloads.map((d) => (
                <li key={d.slug} className="py-2 flex items-center gap-3" data-testid={`top-dl-${d.slug}`}>
                  {d.cover_image ? (
                    <img src={d.cover_image} alt="" className="w-10 h-10 rounded-xl object-contain bg-[#fafafa] border border-[#f4e4c6]" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-[#eef9fb]" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{d.title}</div>
                    <div className="text-xs text-[#6b7280] truncate">/{d.slug}</div>
                  </div>
                  <div className="font-accent text-lg font-bold tabular-nums">{d.total_downloads || 0}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Captures by download */}
        <section className="bg-white rounded-3xl p-6 border border-[#f4e4c6]" data-testid="analytics-captures-by-download">
          <div className="flex items-center gap-2 mb-4">
            <Mail className="w-5 h-5 text-[#5a8a6f]" />
            <h2 className="font-accent text-2xl font-bold">Captures by Download</h2>
          </div>
          {(data.captures_by_download || []).length === 0 ? (
            <p className="text-sm text-[#6b7280]">No email captures yet.</p>
          ) : (
            <ul className="divide-y divide-[#f4e4c6]">
              {data.captures_by_download.map((d) => (
                <li key={d.slug} className="py-2 flex items-center gap-3" data-testid={`captures-row-${d.slug}`}>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{d.title || d.slug}</div>
                    <div className="text-xs text-[#6b7280]">Last: {fmt(d.last_at)}</div>
                  </div>
                  <div className="font-accent text-lg font-bold tabular-nums">{d.captures}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent captures */}
        <section className="bg-white rounded-3xl p-6 border border-[#f4e4c6]" data-testid="analytics-recent-captures">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-[#5a8a6f]" />
            <h2 className="font-accent text-2xl font-bold">Recent Captures</h2>
          </div>
          {(data.recent_captures || []).length === 0 ? (
            <p className="text-sm text-[#6b7280]">No captures yet.</p>
          ) : (
            <ul className="divide-y divide-[#f4e4c6]">
              {data.recent_captures.map((c, idx) => (
                <li key={`${c.email}-${idx}`} className="py-2" data-testid={`recent-capture-${idx}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{c.name || c.email}</div>
                      <div className="text-xs text-[#6b7280] truncate">{c.email} · {c.audience || "Unspecified"}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-[#6b7280]">{fmt(c.created_at)}</div>
                      <div className="text-xs font-semibold text-[#5a8a6f] truncate max-w-[160px]">{c.download_title || c.download_slug}</div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
