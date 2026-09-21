import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
import { toast } from "sonner";
import { MessageCircle, CreditCard, ChevronLeft, RefreshCw, FileText, Trash2 } from "lucide-react";

const STATUSES = ["New","Contacted","Interested","Registered","Lost"];

export default function LeadDetail() {
  const { id } = useParams();
  const { user, has } = useAuth();
  const [lead, setLead] = useState(null);
  const [courses, setCourses] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [tplId, setTplId] = useState("");
  const [preview, setPreview] = useState(null);
  const [showWa, setShowWa] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [showFu, setShowFu] = useState(false);
  const [fuDue, setFuDue] = useState("");
  const [fuNote, setFuNote] = useState("");
  const [uDiscussed, setUDiscussed] = useState("");
  const [uStatus, setUStatus] = useState("Contacted");
  const [uDate, setUDate] = useState("");
  const [uTime, setUTime] = useState("");
  const [uLost, setULost] = useState("");
  const [savingU, setSavingU] = useState(false);

  const load = () => api.get(`/leads/${id}`).then((r) => setLead(r.data));

  useEffect(() => {
    load();
    api.get("/courses").then((r) => setCourses(r.data));
    api.get("/templates").then((r) => { setTemplates(r.data); const d = r.data.find((t)=>t.is_default) || r.data[0]; if (d) setTplId(d.id); });
  }, [id]);

  const doPreview = async () => {
    const r = await api.get(`/leads/${id}/preview-message${tplId?`?template_id=${tplId}`:""}`);
    setPreview(r.data);
    setShowWa(true);
  };

  const openWhatsApp = async () => {
    if (!preview) return;
    await api.post("/message-log", { lead_id: id, template_id: preview.template_id, rendered_body: preview.body, channel: "whatsapp" });
    window.open(preview.whatsapp_link, "_blank");
    setShowWa(false);
    load();
    toast.success("Message logged. WhatsApp opened in new tab.");
  };

  const changeStatus = async (status) => {
    await api.patch(`/leads/${id}`, { status });
    toast.success("Status updated");
    load();
  };

  const changeCourse = async (course_id) => {
    await api.patch(`/leads/${id}`, { course_id });
    toast.success("Course updated");
    load();
  };

  const createPayment = async () => {
    try {
      await api.post("/payments/create-link", { lead_id: id });
      toast.success("Payment link created");
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    }
  };

  const checkPayment = async (pid) => {
    await api.post(`/payments/${pid}/check`);
    toast.success("Refreshed status");
    load();
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    await api.post(`/leads/${id}/notes`, { text: noteText });
    setNoteText(""); setShowNote(false); load();
    toast.success("Note added");
  };

  const addFollowUp = async () => {
    if (!fuDue) return;
    await api.post(`/leads/${id}/followups`, { due_at: new Date(fuDue).toISOString(), note: fuNote });
    setFuDue(""); setFuNote(""); setShowFu(false); load();
    toast.success("Follow-up scheduled");
  };

  const uClosing = ["Registered", "Lost"].includes(uStatus);
  const addUpdate = async () => {
    if (!uDiscussed.trim()) { toast.error("Please describe what was discussed"); return; }
    if (!uClosing && !uDate) { toast.error("Next follow-up date is required"); return; }
    if (uStatus === "Lost" && !uLost.trim()) { toast.error("Please provide a reason for Lost"); return; }
    setSavingU(true);
    try {
      await api.post(`/leads/${id}/updates`, {
        discussed: uDiscussed, status: uStatus,
        next_followup_date: uClosing ? null : uDate,
        next_followup_time: uClosing ? null : (uTime || null),
        lost_reason: uStatus === "Lost" ? uLost : null,
      });
      setUDiscussed(""); setUDate(""); setUTime(""); setULost("");
      toast.success("Follow-up update saved");
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to save update");
    } finally { setSavingU(false); }
  };

  const deleteUpdate = async (uid) => {
    if (!window.confirm("Delete this follow-up update?")) return;
    await api.delete(`/updates/${uid}`);
    toast.success("Update deleted");
    load();
  };

  if (!lead) return <div className="p-10 text-slate-500">Loading...</div>;
  const course = courses.find((c) => c.id === lead.course_id);

  return (
    <div>
      <Link to={user.role === "admin" ? "/admin/leads" : "/my-leads"} className="text-sm text-slate-500 flex items-center gap-1 mb-3"><ChevronLeft className="w-4 h-4" /> Back</Link>
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{lead.name}</h1>
          <div className="text-slate-500 text-sm">{lead.phone} · {lead.email || "—"} · {lead.city || "—"}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="wa-btn" onClick={doPreview} data-testid="whatsapp-btn"><MessageCircle className="w-4 h-4 mr-2" /> Send WhatsApp</Button>
          {has("payment.create") && <Button variant="outline" onClick={createPayment} data-testid="create-payment-link-btn"><CreditCard className="w-4 h-4 mr-2" /> Create Payment Link</Button>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label>Status</Label>
                <Select value={lead.status} onValueChange={changeStatus}>
                  <SelectTrigger data-testid="lead-status-select"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Course</Label>
                <Select value={lead.course_id} onValueChange={changeCourse}>
                  <SelectTrigger data-testid="lead-course-select"><SelectValue /></SelectTrigger>
                  <SelectContent>{courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Offer Expires</Label>
                <div className="text-sm mt-2 offer-chip px-2 py-1 rounded inline-block">{new Date(lead.offer_expires_at).toLocaleString()}</div>
              </div>
            </div>

            <div className="pt-3 border-t">
              <h3 className="font-semibold mb-3">Add Follow-up Update</h3>
              <div className="space-y-3 p-3 rounded-lg bg-teal-50/60 border border-teal-100">
                <div>
                  <Label>What was discussed *</Label>
                  <Textarea rows={2} value={uDiscussed} onChange={(e) => setUDiscussed(e.target.value)} placeholder="e.g. Discussed fee & weekend batch, will call back" data-testid="fu-update-discussed-input" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label>Lead status</Label>
                    <Select value={uStatus} onValueChange={setUStatus}>
                      <SelectTrigger data-testid="fu-update-status-select"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {!uClosing && (
                    <>
                      <div>
                        <Label>Next follow-up date *</Label>
                        <Input type="date" value={uDate} onChange={(e) => setUDate(e.target.value)} data-testid="fu-update-date-input" />
                      </div>
                      <div>
                        <Label>Time (optional)</Label>
                        <Input type="time" value={uTime} onChange={(e) => setUTime(e.target.value)} data-testid="fu-update-time-input" />
                      </div>
                    </>
                  )}
                </div>
                {uStatus === "Lost" && (
                  <div>
                    <Label>Reason for marking Lost *</Label>
                    <Input value={uLost} onChange={(e) => setULost(e.target.value)} placeholder="e.g. Joined another institute" data-testid="fu-update-lost-input" />
                  </div>
                )}
                <Button onClick={addUpdate} disabled={savingU} data-testid="fu-update-save-btn">{savingU ? "Saving…" : "Save Update"}</Button>
              </div>
            </div>

            <div className="pt-3 border-t">
              <h3 className="font-semibold mb-2">Follow-up Timeline ({lead.updates?.length || 0})</h3>
              <div className="space-y-2" data-testid="fu-timeline">
                {(lead.updates || []).map((u) => (
                  <div key={u.id} className="p-3 bg-slate-50 rounded text-sm" data-testid={`fu-update-${u.id}`}>
                    <div className="flex justify-between items-start gap-2">
                      <div className="text-xs text-slate-500">{u.author_name} · {new Date(u.created_at).toLocaleString()}</div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className={`status-${u.status}`}>{u.status}</Badge>
                        {user.role === "admin" && <Button size="sm" variant="ghost" className="h-6 px-1" onClick={() => deleteUpdate(u.id)} data-testid={`fu-update-delete-${u.id}`}><Trash2 className="w-3.5 h-3.5" /></Button>}
                      </div>
                    </div>
                    <div className="mt-1">{u.discussed}</div>
                    {u.lost_reason && <div className="mt-1 text-xs text-rose-600">Lost reason: {u.lost_reason}</div>}
                    {u.next_followup_date && <div className="mt-1 text-xs text-teal-700 font-medium">Next follow-up: {u.next_followup_date}{u.next_followup_time ? ` at ${u.next_followup_time}` : ""}</div>}
                  </div>
                ))}
                {(!lead.updates || lead.updates.length === 0) && <div className="text-xs text-slate-400">No follow-up updates yet.</div>}
              </div>
            </div>

            <div className="pt-3 border-t">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Notes</h3>
                <Button size="sm" variant="outline" onClick={() => setShowNote(true)} data-testid="add-note-btn">Add Note</Button>
              </div>
              <div className="space-y-2">
                {lead.notes.map((n) => (
                  <div key={n.id} className="p-3 bg-slate-50 rounded text-sm">
                    <div className="text-xs text-slate-500 mb-1">{n.author_name} · {new Date(n.created_at).toLocaleString()}</div>
                    {n.text}
                  </div>
                ))}
                {lead.notes.length === 0 && <div className="text-xs text-slate-400">No notes yet.</div>}
              </div>
            </div>

            <div className="pt-3 border-t">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Follow-ups</h3>
                <Button size="sm" variant="outline" onClick={() => setShowFu(true)} data-testid="add-followup-btn">Schedule</Button>
              </div>
              <div className="space-y-2">
                {lead.followups.map((f) => (
                  <div key={f.id} className="p-3 bg-slate-50 rounded text-sm flex justify-between">
                    <div>
                      <div className="font-medium">{new Date(f.due_at).toLocaleString()}</div>
                      <div className="text-xs text-slate-500">{f.note}</div>
                    </div>
                    <Badge variant={f.completed?"secondary":"default"}>{f.completed?"Done":"Pending"}</Badge>
                  </div>
                ))}
                {lead.followups.length === 0 && <div className="text-xs text-slate-400">No follow-ups scheduled.</div>}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-5">
              <h3 className="font-semibold mb-2">Payments</h3>
              {lead.payments.length === 0 && <div className="text-xs text-slate-400">No payment yet.</div>}
              {lead.payments.map((p) => (
                <div key={p.id} className="border-b py-2 last:border-0 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">₹{p.amount}</span>
                    <Badge className={p.status === "paid" ? "bg-emerald-600" : "bg-slate-400"}>{p.status}</Badge>
                  </div>
                  <a href={p.short_url} target="_blank" rel="noreferrer" className="text-xs text-teal-700 underline break-all">{p.short_url}</a>
                  <div className="flex gap-2 mt-1">
                    <Button size="sm" variant="ghost" onClick={() => checkPayment(p.id)} data-testid={`check-payment-${p.id}`}><RefreshCw className="w-3 h-3 mr-1" /> Check</Button>
                  </div>
                </div>
              ))}
              {lead.receipts.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <div className="text-xs uppercase text-slate-500 mb-2">Receipts</div>
                  {lead.receipts.map((r) => (
                    <a key={r.id} href={`${process.env.REACT_APP_BACKEND_URL}/api/receipts/${r.id}/pdf`} target="_blank" rel="noreferrer" className="block text-sm text-teal-700 underline flex items-center gap-1"><FileText className="w-3 h-3" />{r.receipt_number}</a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <h3 className="font-semibold mb-2">Message History</h3>
              {lead.messages.length === 0 && <div className="text-xs text-slate-400">No messages sent.</div>}
              <div className="space-y-2 text-xs">
                {lead.messages.slice(0, 5).map((m) => (
                  <div key={m.id} className="p-2 bg-slate-50 rounded">
                    <div className="text-slate-500">{m.sender_name} · {new Date(m.created_at).toLocaleString()}</div>
                    <div className="mt-1 line-clamp-3">{m.rendered_body}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showWa} onOpenChange={setShowWa}>
        <DialogContent data-testid="whatsapp-preview-modal">
          <DialogHeader><DialogTitle>WhatsApp Message Preview</DialogTitle></DialogHeader>
          <div>
            <Label>Template</Label>
            <Select value={tplId} onValueChange={(v) => { setTplId(v); }}>
              <SelectTrigger data-testid="template-picker-select"><SelectValue /></SelectTrigger>
              <SelectContent>{templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={doPreview} className="mt-2">Regenerate</Button>
            {preview && <div className="mt-3 p-3 bg-emerald-50 rounded whitespace-pre-wrap text-sm">{preview.body}</div>}
          </div>
          <DialogFooter>
            <Button className="wa-btn" onClick={openWhatsApp} data-testid="send-whatsapp-confirm-btn">Open WhatsApp</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNote} onOpenChange={setShowNote}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Note</DialogTitle></DialogHeader>
          <Textarea rows={4} value={noteText} onChange={(e) => setNoteText(e.target.value)} data-testid="note-text-input" />
          <DialogFooter><Button onClick={addNote} data-testid="note-save-btn">Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showFu} onOpenChange={setShowFu}>
        <DialogContent>
          <DialogHeader><DialogTitle>Schedule Follow-up</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Due Date/Time</Label><Input type="datetime-local" value={fuDue} onChange={(e) => setFuDue(e.target.value)} data-testid="fu-due-input" /></div>
            <div><Label>Note</Label><Input value={fuNote} onChange={(e) => setFuNote(e.target.value)} /></div>
          </div>
          <DialogFooter><Button onClick={addFollowUp} data-testid="fu-save-btn">Schedule</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
