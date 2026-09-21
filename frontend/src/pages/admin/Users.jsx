import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
import { Switch } from "../../components/ui/switch";
import { toast } from "sonner";

export default function UsersPage() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name:"", email:"", password:"", role:"counsellor", phone:"" });

  const load = () => api.get("/users").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  const create = async () => {
    try { await api.post("/users", form); toast.success("User created"); setOpen(false); setForm({ name:"", email:"", password:"", role:"counsellor", phone:"" }); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };
  const toggleActive = async (u) => { await api.patch(`/users/${u.id}`, { active: !u.active }); load(); };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">Users</h1>
        <Button onClick={() => setOpen(true)} data-testid="add-user-btn">Add User</Button>
      </div>
      <Card><CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="text-left p-3">Name</th><th className="text-left p-3">Email</th><th className="text-left p-3">Role</th><th className="text-left p-3">Active</th></tr></thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="p-3">{u.name}</td><td className="p-3">{u.email}</td><td className="p-3 capitalize">{u.role}</td>
                <td className="p-3"><Switch checked={u.active} onCheckedChange={() => toggleActive(u)} data-testid={`user-active-${u.id}`} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add User</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({...form, name:e.target.value})} data-testid="new-user-name" /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({...form, email:e.target.value})} data-testid="new-user-email" /></div>
            <div><Label>Password</Label><Input type="password" value={form.password} onChange={(e) => setForm({...form, password:e.target.value})} data-testid="new-user-password" /></div>
            <div><Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({...form, role:v})}>
                <SelectTrigger data-testid="new-user-role"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="admin">Admin</SelectItem><SelectItem value="counsellor">Counsellor</SelectItem><SelectItem value="reception">Reception</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({...form, phone:e.target.value})} /></div>
          </div>
          <DialogFooter><Button onClick={create} data-testid="new-user-save">Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
