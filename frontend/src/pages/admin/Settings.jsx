import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";
import { toast } from "sonner";

export default function SettingsPage() {
  const [s, setS] = useState(null);
  useEffect(() => { api.get("/settings").then((r) => setS(r.data)); }, []);
  if (!s) return <div>Loading...</div>;

  const save = async () => {
    await api.patch("/settings", {
      razorpay_key_id: s.razorpay_key_id || "",
      razorpay_key_secret: s.razorpay_key_secret || "",
      reception_can_send_whatsapp: !!s.reception_can_send_whatsapp,
      counsellors_view_all: !!s.counsellors_view_all,
    });
    toast.success("Settings saved");
  };
  const backup = async () => { const r = await api.post("/backup/now"); toast.success(`Backup created at ${r.data.path}`); };

  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-bold mb-6">Settings</h1>
      <div className="grid lg:grid-cols-2 gap-6">
        <Card><CardContent className="p-5 space-y-4">
          <div>
            <h3 className="font-semibold">Razorpay Payment Keys</h3>
            <p className="text-xs text-slate-500 mt-1">Add your Razorpay API keys to auto-generate real payment links. Leave blank to use demo links.</p>
          </div>
          <div><Label>Key ID</Label><Input value={s.razorpay_key_id || ""} onChange={(e) => setS({ ...s, razorpay_key_id: e.target.value })} placeholder="rzp_live_xxxxxxxx" data-testid="settings-rzp-key-id" /></div>
          <div><Label>Key Secret</Label><Input type="password" value={s.razorpay_key_secret || ""} onChange={(e) => setS({ ...s, razorpay_key_secret: e.target.value })} placeholder="••••••••" data-testid="settings-rzp-key-secret" /></div>
          <Button onClick={save} data-testid="settings-save">Save</Button>
        </CardContent></Card>

        <Card><CardContent className="p-5 space-y-4">
          <h3 className="font-semibold">Access & Backup</h3>
          <div className="flex items-center justify-between"><Label>Reception can send WhatsApp</Label><Switch checked={!!s.reception_can_send_whatsapp} onCheckedChange={(v) => setS({ ...s, reception_can_send_whatsapp: v })} data-testid="settings-reception-wa" /></div>
          <div className="flex items-center justify-between"><Label>Counsellors can view all leads</Label><Switch checked={!!s.counsellors_view_all} onCheckedChange={(v) => setS({ ...s, counsellors_view_all: v })} data-testid="settings-view-all" /></div>
          <div className="flex gap-2 pt-2">
            <Button onClick={save} variant="secondary" data-testid="settings-save-2">Save</Button>
            <Button variant="outline" onClick={backup} data-testid="backup-now-btn">Backup Now</Button>
          </div>
        </CardContent></Card>
      </div>
    </div>
  );
}
