import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { Package, RefreshCw, CheckCircle2, ExternalLink } from "lucide-react";

function money(cents) { return `$${((cents || 0) / 100).toFixed(2)}`; }
function fmt(iso) { try { return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); } catch { return iso; } }

const STATUS_COLOR = {
  paid: "bg-[#dff7ec] text-[#1f7a4d]",
  pending_payment: "bg-[#fff5d6] text-[#876a17]",
  payment_processing: "bg-[#dff3f6] text-[#3a6b78]",
  payment_failed: "bg-[#fde2e1] text-[#9d2a26]",
  fulfilled: "bg-[#d6e7ff] text-[#1f4a82]",
  refunded: "bg-[#f0e6ff] text-[#5a3aa0]",
  partial_refund: "bg-[#f7ddf0] text-[#7d2466]",
};

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get("/admin/orders").then(({ data }) => setOrders(data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const fulfill = async (id) => {
    if (!window.confirm("Mark this order as fulfilled?")) return;
    try { await api.post(`/admin/orders/${id}/fulfill`); toast.success("Marked fulfilled"); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  const refund = async (id, total_cents) => {
    const txt = window.prompt(`Refund amount in dollars? Leave blank to refund full ${money(total_cents)}`, "");
    if (txt === null) return;
    const amount_cents = txt.trim() ? Math.round(parseFloat(txt) * 100) : null;
    if (amount_cents !== null && (Number.isNaN(amount_cents) || amount_cents <= 0)) { toast.error("Invalid amount"); return; }
    try {
      await api.post(`/admin/orders/${id}/refund`, amount_cents ? { amount_cents } : {});
      toast.success("Refund initiated");
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Refund failed"); }
  };

  return (
    <div data-testid="admin-orders">
      <header className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <div>
          <h1 className="font-accent text-3xl font-bold">Orders</h1>
          <p className="text-[#5a6b76]">{orders.length} order{orders.length === 1 ? "" : "s"}</p>
        </div>
        <button onClick={load} className="btn-ghost" data-testid="orders-refresh"><RefreshCw className="w-4 h-4" />Refresh</button>
      </header>

      {loading && <div className="text-[#6b7280]">Loading…</div>}
      {!loading && orders.length === 0 && (
        <div className="bg-white rounded-3xl p-10 text-center" data-testid="orders-empty">
          <Package className="w-12 h-12 mx-auto text-[#7fcfc7] mb-3" />
          <p className="text-[#5a6b76]">No orders yet. Once families buy a Stuffie, they'll appear here.</p>
        </div>
      )}

      <div className="space-y-3">
        {orders.map((o) => {
          const statusClass = STATUS_COLOR[o.status] || "bg-[#eef9fb] text-[#3a6b78]";
          return (
            <div key={o.id} className="bg-white rounded-3xl border border-[#f4e4c6] p-4 sm:p-5" data-testid={`order-row-${o.order_number}`}>
              <div className="flex flex-wrap items-start gap-3 justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-accent font-bold text-lg">{o.order_number}</div>
                    <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${statusClass}`} data-testid={`order-status-${o.order_number}`}>{(o.status || "").replace(/_/g, " ")}</span>
                  </div>
                  <div className="text-sm text-[#5a6b76] mt-0.5">{o.full_name} · {o.email}</div>
                  <div className="text-xs text-[#7f8b94]">{fmt(o.created_at)}</div>
                </div>
                <div className="text-right">
                  <div className="font-accent text-2xl font-bold tabular-nums">{money(o.total_cents)}</div>
                  <div className="text-xs text-[#6b7280]">{o.items?.length || 0} item{(o.items?.length || 0) === 1 ? "" : "s"}</div>
                </div>
              </div>

              <ul className="text-sm text-[#3a4a55] mt-3 space-y-0.5">
                {(o.items || []).map((it, idx) => (
                  <li key={idx}>{it.quantity}× {it.product_name}{it.variant_label ? ` (${it.variant_label})` : ""} <span className="text-[#7f8b94]">— {money(it.line_total_cents)}</span></li>
                ))}
              </ul>

              {o.shipping_address && (
                <div className="text-xs text-[#5a6b76] mt-2">
                  Ship to: {o.shipping_address.line1}{o.shipping_address.line2 ? ", " + o.shipping_address.line2 : ""}, {o.shipping_address.city}, {o.shipping_address.state} {o.shipping_address.postal_code}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 mt-3">
                {o.square_receipt_url && (
                  <a href={o.square_receipt_url} target="_blank" rel="noopener noreferrer" className="btn-ghost text-xs" data-testid={`order-receipt-${o.order_number}`}><ExternalLink className="w-4 h-4" />Square receipt</a>
                )}
                {(o.status === "paid" || o.status === "payment_processing") && (
                  <button onClick={() => fulfill(o.id)} className="btn-secondary text-xs" data-testid={`order-fulfill-${o.order_number}`}><CheckCircle2 className="w-4 h-4" />Mark fulfilled</button>
                )}
                {(o.status === "paid" || o.status === "fulfilled" || o.status === "partial_refund") && o.square_payment_id && (
                  <button onClick={() => refund(o.id, o.total_cents)} className="text-xs text-red-600 underline" data-testid={`order-refund-${o.order_number}`}>Refund</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
