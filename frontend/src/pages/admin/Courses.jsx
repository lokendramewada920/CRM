import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
import { Switch } from "../../components/ui/switch";
import { toast } from "sonner";

export default function CoursesPage() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name:"", total_fee:0, duration:"", active:true });
  const load = () => api.get("/courses").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  const save = async () => {
    try { await api.post("/courses", { ...form, total_fee: Number(form.total_fee) }); toast.success("Course added"); setOpen(false); setForm({ name:"", total_fee:0, duration:"", active:true }); load(); }
    catch { toast.error("Failed"); }
  };
  const toggle = async (c) => { await api.patch(`/courses/${c.id}`, { ...c, active: !c.active }); load(); };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">Courses</h1>
        <Button onClick={() => setOpen(true)} data-testid="add-course-btn">Add Course</Button>
      </div>
      <Card><CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="text-left p-3">Name</th><th className="text-left p-3">Fee</th><th className="text-left p-3">Duration</th><th className="text-left p-3">Active</th></tr></thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-3">{c.name}</td><td className="p-3">₹{c.total_fee}</td><td className="p-3">{c.duration}</td>
                <td className="p-3"><Switch checked={c.active} onCheckedChange={() => toggle(c)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Course</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({...form, name:e.target.value})} data-testid="new-course-name" /></div>
            <div><Label>Total Fee (₹)</Label><Input type="number" value={form.total_fee} onChange={(e) => setForm({...form, total_fee:e.target.value})} data-testid="new-course-fee" /></div>
            <div><Label>Duration</Label><Input value={form.duration} onChange={(e) => setForm({...form, duration:e.target.value})} data-testid="new-course-duration" /></div>
          </div>
          <DialogFooter><Button onClick={save} data-testid="new-course-save">Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
