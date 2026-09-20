import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent } from "../components/ui/card";
import { toast } from "sonner";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("admin@artsoffinance.in");
  const [password, setPassword] = useState("Admin@12345");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const u = await login(email, password);
      toast.success(`Welcome, ${u.name}`);
      const to = u.role === "reception" ? "/reception" : u.role === "counsellor" ? "/my-leads" : "/admin";
      nav(to);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:block aof-brand-gradient text-white p-10">
        <div style={{ fontFamily: "Outfit" }} className="text-3xl font-bold">Arts of Finance</div>
        <div className="text-slate-300 mt-2">Admissions & Lead Management</div>
        <div className="mt-12 space-y-4 max-w-md">
          <div className="p-4 rounded-lg bg-white/5 border border-white/10">
            <div className="text-sm text-slate-300">For</div>
            <div className="text-lg font-semibold">Reception, Counsellors & Admin</div>
          </div>
          <div className="p-4 rounded-lg bg-white/5 border border-white/10">
            <div className="text-sm text-slate-300">Same-day offer</div>
            <div className="text-lg font-semibold">10% OFF on registration today</div>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center p-8 bg-slate-50">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <h1 className="text-2xl font-bold mb-1">Sign in</h1>
            <p className="text-sm text-slate-500 mb-6">Use your staff credentials</p>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="login-email-input" />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required data-testid="login-password-input" />
              </div>
              <Button type="submit" className="w-full" disabled={loading} data-testid="login-submit-btn">
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </form>
            <div className="mt-5 text-xs text-slate-500 space-y-1">
              <div><b>Admin:</b> admin@artsoffinance.in / Admin@12345</div>
              <div><b>Counsellor:</b> priya@artsoffinance.in / Counsellor@123</div>
              <div><b>Reception:</b> reception@artsoffinance.in / Reception@123</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
