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
    const payload = {
      registration_amount: Number(s.registration_amount),
      discount_percent: Number(s.discount_percent),
      offer_hours: s.offer_hours === "" || s.offer_hours === null ? null : Number(s.offer_hours),
      reception_can_send_whatsapp: !!s.reception_can_send_whatsapp,
      counsellors_view_all: !!s.counsellors_view_all,
    };
    await api.patch("/settings", payload);
    toast.success("Settings saved");
  };
  const backup = async () => { const r = await api.post("/backup/now"); toast.success(`Backup at ${r.data.path}`); };

  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-bold mb-6">Settings</h1>
      <div className="grid lg:grid-cols-2 gap-6">
        <Card><CardContent className="p-5 space-y-4">
          <h3 className="font-semibold">Offer & Registration</h3>
          <div><Label>Registration Amount (₹)</Label><Input type="number" value={s.registration_amount} onChange={(e) => setS({...s, registration_amount:e.target.value})} data-testid="settings-reg-amount" /></div>
          <div><Label>Discount %</Label><Input type="number" value={s.discount_percent} onChange={(e) => setS({...s, discount_percent:e.target.value})} data-testid="settings-discount" /></div>
          <div><Label>Offer Hours (blank = expires 23:59 same day)</Label><Input type="number" value={s.offer_hours ?? ""} onChange={(e) => setS({...s, offer_hours:e.target.value})} data-testid="settings-offer-hours" /></div>
          <Button onClick={save} data-testid="settings-save">Save</Button>
        </CardContent></Card>
        <Card><CardContent className="p-5 space-y-4">
          <h3 className="font-semibold">Access Toggles</h3>
          <div className="flex items-center justify-between"><Label>Reception can send WhatsApp</Label><Switch checked={!!s.reception_can_send_whatsapp} onCheckedChange={(v) => setS({...s, reception_can_send_whatsapp:v})} data-testid="settings-reception-wa" /></div>
          <div className="flex items-center justify-between"><Label>Counsellors view all leads</Label><Switch checked={!!s.counsellors_view_all} onCheckedChange={(v) => setS({...s, counsellors_view_all:v})} data-testid="settings-view-all" /></div>
          <Button variant="outline" onClick={backup} data-testid="backup-now-btn">Backup Now</Button>
        </CardContent></Card>
      </div>
    </div>
  );
}
