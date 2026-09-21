import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../components/ui/dialog";
import { Switch } from "../../components/ui/switch";
import { toast } from "sonner";

const EMPTY = { id: null, name: "", total_fee: 0, duration: "", active: true };

export default function CoursesPage() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const load = () => api.get("/courses").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(EMPTY); setOpen(true); };
  const openEdit = (c) => { setForm({ id: c.id, name: c.name, total_fee: c.total_fee, duration: c.duration, active: c.active }); setOpen(true); };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Course name is required"); return; }
    const payload = { name: form.name, total_fee: Number(form.total_fee), duration: form.duration, active: !!form.active };
    try {
      if (form.id) await api.patch(`/courses/${form.id}`, payload);
      else await api.post("/courses", payload);
      toast.success(form.id ? "Course updated" : "Course added");
      setOpen(false); setForm(EMPTY); load();
    } catch { toast.error("Failed to save"); }
  };
  const toggle = async (c) => { await api.patch(`/courses/${c.id}`, { name: c.name, total_fee: c.total_fee, duration: c.duration, active: !c.active }); load(); };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">Courses</h1>
        <Button onClick={openNew} data-testid="add-course-btn">Add Course</Button>
      </div>
      <Card><CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="text-left p-3">Name</th><th className="text-left p-3">Fee</th><th className="text-left p-3">Duration</th><th className="text-left p-3">Active</th><th className="text-right p-3">Actions</th></tr></thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-3">{c.name}</td><td className="p-3">₹{c.total_fee}</td><td className="p-3">{c.duration}</td>
                <td className="p-3"><Switch checked={c.active} onCheckedChange={() => toggle(c)} data-testid={`course-active-${c.id}`} /></td>
                <td className="p-3 text-right"><Button size="sm" variant="outline" onClick={() => openEdit(c)} data-testid={`edit-course-${c.id}`}>Edit</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form.id ? "Edit Course" : "Add Course"}</DialogTitle><DialogDescription>Course details shown in forms and receipts.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="course-name-input" /></div>
            <div><Label>Total Fee (₹)</Label><Input type="number" value={form.total_fee} onChange={(e) => setForm({ ...form, total_fee: e.target.value })} data-testid="course-fee-input" /></div>
            <div><Label>Duration</Label><Input value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="e.g. 3 months" data-testid="course-duration-input" /></div>
          </div>
          <DialogFooter><Button onClick={save} data-testid="course-save-btn">Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
