import { useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Label } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";
import { toast } from "sonner";

const VARS = ["student_name","course_name","course_fee","discounted_fee","discount_percent","registration_amount","offer_valid_till","counsellor_name","payment_link"];

export default function TemplatesPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ name:"", body:"", is_default:false });
  const bodyRef = useRef(null);
  const [editId, setEditId] = useState(null);

  const load = () => api.get("/templates").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  const insertVar = (v) => {
    const ta = bodyRef.current;
    const chip = "{" + v + "}";
    if (!ta) { setForm((f) => ({ ...f, body: f.body + chip })); return; }
    const start = ta.selectionStart, end = ta.selectionEnd;
    const next = form.body.slice(0, start) + chip + form.body.slice(end);
    setForm((f) => ({ ...f, body: next }));
    setTimeout(() => { ta.focus(); ta.selectionEnd = start + chip.length; }, 0);
  };

  const save = async () => {
    try {
      if (editId) await api.patch(`/templates/${editId}`, form);
      else await api.post("/templates", form);
      toast.success("Saved"); setForm({ name:"", body:"", is_default:false }); setEditId(null); load();
    } catch { toast.error("Failed"); }
  };
  const edit = (t) => { setForm({ name:t.name, body:t.body, is_default:t.is_default }); setEditId(t.id); };
  const del = async (id) => { if (!window.confirm("Delete?")) return; await api.delete(`/templates/${id}`); load(); };

  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-bold mb-6">Message Templates</h1>
      <div className="grid lg:grid-cols-2 gap-6">
        <Card><CardContent className="p-5 space-y-4">
          <h3 className="font-semibold">{editId ? "Edit" : "New"} Template</h3>
          <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({...form, name:e.target.value})} data-testid="tpl-name" /></div>
          <div>
            <Label>Body</Label>
            <div className="flex flex-wrap gap-1 mb-2">
              {VARS.map((v) => <button key={v} type="button" onClick={() => insertVar(v)} className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded" data-testid={`tpl-var-${v}`}>{`{${v}}`}</button>)}
            </div>
            <Textarea ref={bodyRef} rows={7} value={form.body} onChange={(e) => setForm({...form, body:e.target.value})} data-testid="tpl-body" />
          </div>
          <div className="flex items-center gap-2"><Switch checked={form.is_default} onCheckedChange={(v) => setForm({...form, is_default:v})} data-testid="tpl-default" /><Label>Default template</Label></div>
          <div className="flex gap-2">
            <Button onClick={save} data-testid="tpl-save">Save</Button>
            {editId && <Button variant="outline" onClick={() => { setEditId(null); setForm({ name:"", body:"", is_default:false }); }}>Cancel</Button>}
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <h3 className="font-semibold mb-3">All Templates</h3>
          <div className="space-y-3">
            {items.map((t) => (
              <div key={t.id} className="p-3 border rounded">
                <div className="flex justify-between items-center"><div className="font-medium">{t.name} {t.is_default && <span className="text-xs bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded ml-1">default</span>}</div>
                  <div className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => edit(t)}>Edit</Button><Button size="sm" variant="ghost" onClick={() => del(t.id)}>Del</Button></div>
                </div>
                <div className="text-xs text-slate-500 mt-1 whitespace-pre-wrap">{t.body}</div>
              </div>
            ))}
          </div>
        </CardContent></Card>
      </div>
    </div>
  );
}
