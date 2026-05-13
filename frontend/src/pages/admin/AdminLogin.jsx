import { useState } from "react";
import { useAuth } from "../../lib/auth";
import { Navigate, useLocation } from "react-router-dom";
import { Waves } from "lucide-react";
import { toast } from "sonner";

export default function AdminLogin() {
  const { user, login } = useAuth();
  const loc = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (user && user.role === "admin") return <Navigate to={loc.state?.from || "/admin"} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await login(email, password); toast.success("Welcome back!"); }
    catch (err) { toast.error(typeof err.response?.data?.detail === "string" ? err.response.data.detail : "Login failed"); }
    finally { setBusy(false); }
  };

  return (
    <main className="min-h-screen grid place-items-center bg-foam-grad p-6" data-testid="admin-login">
      <div className="card-soft max-w-md w-full p-8">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-full gradient-wave grid place-items-center mx-auto"><Waves className="w-7 h-7 text-white" /></div>
          <h1 className="font-accent text-3xl font-bold mt-3">Admin Sign-in</h1>
          <p className="text-[#6b7280] text-sm">Catch the W.A.V.E. of Excitement.</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input required type="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 rounded-full border-2 border-[#f4e4c6] focus:outline-none focus:border-[#7fcfc7]" data-testid="login-email" />
          <input required type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 rounded-full border-2 border-[#f4e4c6] focus:outline-none focus:border-[#7fcfc7]" data-testid="login-password" />
          <button disabled={busy} className="btn-primary w-full justify-center" data-testid="login-submit">{busy ? "Signing in..." : "Sign In"}</button>
        </form>
      </div>
    </main>
  );
}
