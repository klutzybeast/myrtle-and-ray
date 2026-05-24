import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { RefreshCw, Link2, CheckCircle2, AlertTriangle, Power } from "lucide-react";

export default function AdminEtsy() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [params] = useSearchParams();

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/etsy/status");
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Show toast based on OAuth callback redirect
  useEffect(() => {
    if (params.get("etsy_connected") === "1") {
      toast.success("Etsy connected! Now click Sync to pull your listings.");
      // Clean the URL so refresh doesn't re-fire the toast
      window.history.replaceState({}, "", "/admin/etsy");
    }
    const err = params.get("etsy_error");
    if (err) {
      toast.error(`Etsy connect failed: ${err}`);
      window.history.replaceState({}, "", "/admin/etsy");
    }
  }, [params]);

  const connect = async () => {
    setConnecting(true);
    try {
      const { data } = await api.post("/etsy/connect");
      // Open Etsy's authorize page in a new tab. The OAuth callback will
      // redirect back to /admin/etsy?etsy_connected=1.
      window.open(data.authorize_url, "_blank", "noopener,noreferrer");
      toast.info("A new tab opened — click Allow on Etsy to authorize.", { duration: 6000 });
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not start the Etsy connection.");
    } finally {
      setConnecting(false);
    }
  };

  const sync = async () => {
    setSyncing(true);
    try {
      const { data } = await api.post("/etsy/sync");
      toast.success(`Synced ${data.synced} listing${data.synced === 1 ? "" : "s"} from Etsy`);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm("Disconnect Etsy? You'll need to re-authorize to sync again.")) return;
    try {
      await api.post("/etsy/disconnect");
      toast.success("Etsy disconnected");
      await load();
    } catch {
      toast.error("Could not disconnect");
    }
  };

  if (loading) {
    return <div className="text-center text-[#5a6b76] py-20" data-testid="admin-etsy-loading">Loading…</div>;
  }

  const configured = status?.configured;
  const connected = status?.connected;

  return (
    <div className="space-y-5 max-w-2xl" data-testid="admin-etsy-page">
      <header>
        <h1 className="font-accent text-3xl font-bold text-[#2e3a3a]">Etsy Storefront Sync</h1>
        <p className="text-sm text-[#5a6b76] mt-1">Pull active listings directly from your Etsy shop. Tokens are stored on the server — you only authorize once.</p>
      </header>

      {/* Configuration card */}
      <div className={`rounded-3xl border-2 p-4 ${configured ? "bg-[#eaf7f5] border-[#7fcfc7]" : "bg-[#fff8ec] border-[#f4d28a]"}`} data-testid="etsy-config-card">
        <div className="flex items-start gap-3">
          {configured ? <CheckCircle2 className="w-5 h-5 text-[#5a8a6f] mt-0.5" /> : <AlertTriangle className="w-5 h-5 text-[#b8852b] mt-0.5" />}
          <div className="flex-1">
            <h2 className="font-bold text-[#2e3a3a]">1 · Etsy API keys</h2>
            {configured ? (
              <p className="text-sm text-[#3a4a55]">Keystring + shared secret are configured. Callback URL: <code className="text-xs bg-white/60 px-1 rounded">{status?.callback_url}</code></p>
            ) : (
              <p className="text-sm text-[#3a4a55]">Paste these into <code className="text-xs">/app/backend/.env</code>:<br /><code className="text-xs">ETSY_KEYSTRING=…</code> · <code className="text-xs">ETSY_SHARED_SECRET=…</code></p>
            )}
          </div>
        </div>
      </div>

      {/* Connection card */}
      <div className={`rounded-3xl border-2 p-4 ${connected ? "bg-[#eaf7f5] border-[#7fcfc7]" : "bg-white border-[#f4e4c6]"}`} data-testid="etsy-connection-card">
        <div className="flex items-start gap-3">
          {connected ? <CheckCircle2 className="w-5 h-5 text-[#5a8a6f] mt-0.5" /> : <Link2 className="w-5 h-5 text-[#5a6b76] mt-0.5" />}
          <div className="flex-1">
            <h2 className="font-bold text-[#2e3a3a]">2 · Connect to Etsy</h2>
            {connected ? (
              <div className="text-sm text-[#3a4a55] space-y-1">
                <p>Connected as shop <span className="font-bold">{status?.shop_name || `#${status?.shop_id}`}</span>{status?.shop_id ? ` (id ${status.shop_id})` : ""}.</p>
                {status?.last_sync_at && <p className="text-xs text-[#5a6b76]">Last sync: {new Date(status.last_sync_at * 1000).toLocaleString()}</p>}
              </div>
            ) : (
              <p className="text-sm text-[#3a4a55]">One-time browser authorization. Click below — a new tab opens Etsy's "Allow Myrtle and Ray Storefront to read your listings?" page.</p>
            )}
            <div className="mt-3 flex gap-2 flex-wrap">
              {!connected && (
                <button onClick={connect} disabled={connecting || !configured} className="btn-primary flex items-center gap-2 disabled:opacity-50" data-testid="etsy-connect-btn">
                  <Link2 className="w-4 h-4" /> {connecting ? "Starting…" : "Connect to Etsy"}
                </button>
              )}
              {connected && (
                <>
                  <button onClick={sync} disabled={syncing} className="btn-primary flex items-center gap-2" data-testid="etsy-sync-btn">
                    <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} /> {syncing ? "Syncing…" : "Sync listings"}
                  </button>
                  <button onClick={disconnect} className="btn-ghost flex items-center gap-2" data-testid="etsy-disconnect-btn">
                    <Power className="w-4 h-4" /> Disconnect
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="text-xs text-[#5a6b76] bg-white border border-[#f4e4c6] rounded-2xl p-3">
        <p className="font-bold text-[#3a4a55] mb-1">How it works</p>
        <ol className="list-decimal pl-4 space-y-1">
          <li>Etsy gives this site a short-lived access token + 90-day refresh token.</li>
          <li>The backend refreshes the access token automatically every ~1 hour.</li>
          <li>The Sync button pulls every active listing (title, price, image, listing URL) into MongoDB.</li>
          <li>Your <code>/shop</code> page reads from MongoDB with a 10-minute public cache.</li>
        </ol>
      </div>
    </div>
  );
}
