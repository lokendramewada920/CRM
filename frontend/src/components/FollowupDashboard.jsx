import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Checkbox } from "./ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { toast } from "sonner";
import { Phone, MessageCircle, Plus, CalendarClock, CalendarCheck2, AlertTriangle, CircleHelp, Users2 } from "lucide-react";

const STATUSES = ["New", "Contacted", "Interested", "Registered", "Lost"];
const SOURCES = ["Instagram", "Google Search", "Friend Referral", "Walk-in", "Newspaper", "Other"];

const EMPTY_ADD = {
  name: "", phone: "", email: "", city: "", qualification: "",
  course_id: "", source: "", batch_preference: "", assigned_counsellor_id: "", remarks: "", consent: false,
};

export default function FollowupDashboard({ admin = false }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [courses, setCourses] = useState([]);
  const [counsellors, setCounsellors] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [filter, setFilter] = useState("all");

  // Add-update dialog
  const [updLead, setUpdLead] = useState(null);
  const [uDiscussed, setUDiscussed] = useState("");
  const [uStatus, setUStatus] = useState("Contacted");
  const [uDate, setUDate] = useState("");
  const [uTime, setUTime] = useState("");
  const [uLost, setULost] = useState("");
  const [savingU, setSavingU] = useState(false);

  // WhatsApp dialog
  const [waLead, setWaLead] = useState(null);
  const [tplId, setTplId] = useState("");
  const [preview, setPreview] = useState(null);

  // Manual add dialog
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_ADD);
  const [savingAdd, setSavingAdd] = useState(false);

  const load = useCallback(() => {
    const qs = admin && filter !== "all" ? `?counsellor_id=${filter}` : "";
    api.get(`/dashboard/followups${qs}`).then((r) => setData(r.data)).catch(() => {});
  }, [admin, filter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get("/courses?active_only=true").then((r) => setCourses(r.data)).catch(() => {});
    api.get("/templates").then((r) => {
      setTemplates(r.data);
      const d = r.data.find((t) => t.is_default) || r.data[0];
      if (d) setTplId(d.id);
    }).catch(() => {});
    api.get("/counsellors").then((r) => setCounsellors(r.data)).catch(() => {});
  }, []);

  const courseName = (cid) => courses.find((c) => c.id === cid)?.name || "—";

  // ---- Add update ----
  const uClosing = ["Registered", "Lost"].includes(uStatus);
  const openUpdate = (l) => {
    setUpdLead(l); setUDiscussed(""); setUStatus(l.status || "Contacted");
    setUDate(l.next_followup_date || ""); setUTime(l.next_followup_time || ""); setULost("");
  };
  const saveUpdate = async () => {
    if (!uDiscussed.trim()) { toast.error("Please describe what was discussed"); return; }
    if (!uClosing && !uDate) { toast.error("Next follow-up date is required"); return; }
    if (uStatus === "Lost" && !uLost.trim()) { toast.error("Please provide a reason for Lost"); return; }
    setSavingU(true);
    try {
      await api.post(`/leads/${updLead.id}/updates`, {
        discussed: uDiscussed, status: uStatus,
        next_followup_date: uClosing ? null : uDate,
        next_followup_time: uClosing ? null : (uTime || null),
        lost_reason: uStatus === "Lost" ? uLost : null,
      });
      toast.success("Follow-up update saved");
      setUpdLead(null); load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to save update");
    } finally { setSavingU(false); }
  };

  // ---- WhatsApp ----
  const openWa = async (l) => {
    setWaLead(l); setPreview(null);
    try {
      const r = await api.get(`/leads/${l.id}/preview-message${tplId ? `?template_id=${tplId}` : ""}`);
      setPreview(r.data);
    } catch (e) { toast.error(e.response?.data?.detail || "Could not build message"); }
  };
  const regenWa = async (tid) => {
    setTplId(tid);
    const r = await api.get(`/leads/${waLead.id}/preview-message?template_id=${tid}`);
    setPreview(r.data);
  };
  const sendWa = async () => {
    if (!preview) return;
    await api.post("/message-log", { lead_id: waLead.id, template_id: preview.template_id, rendered_body: preview.body, channel: "whatsapp" });
    window.open(preview.whatsapp_link, "_blank");
    setWaLead(null); load();
    toast.success("Message logged. WhatsApp opened in a new tab.");
  };

  // ---- Manual add ----
  const updAdd = (k, v) => setAddForm((f) => ({ ...f, [k]: v }));
  const submitAdd = async () => {
    if (!addForm.name.trim() || !addForm.phone.trim()) { toast.error("Name and phone are required"); return; }
    if (!addForm.course_id) { toast.error("Please select a course"); return; }
    if (!addForm.consent) { toast.error("Consent is required"); return; }
    setSavingAdd(true);
    try {
      await api.post("/leads", { ...addForm, assigned_counsellor_id: addForm.assigned_counsellor_id || null });
      toast.success("Enquiry added");
      setShowAdd(false); setAddForm(EMPTY_ADD); load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to add enquiry");
    } finally { setSavingAdd(false); }
  };

  const counts = data?.counts || {};

  const Row = ({ l }) => (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border bg-white" data-testid={`fu-row-${l.id}`}>
      <div className="min-w-0">
        <Link to={`/leads/${l.id}`} className="font-semibold hover:underline" data-testid={`fu-name-${l.id}`}>{l.name}</Link>
        <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
          <span>{l.phone}</span>
          <span>· {courseName(l.course_id)}</span>
          <Badge className={`status-${l.status}`}>{l.status}</Badge>
          {admin && l.assigned_counsellor_name && <span>· {l.assigned_counsellor_name}</span>}
        </div>
        {l.last_discussion && <div className="text-xs text-slate-600 mt-1 italic line-clamp-1">“{l.last_discussion}”</div>}
        {l.next_followup_date && <div className="text-xs text-teal-700 mt-0.5">Next: {l.next_followup_date}{l.next_followup_time ? ` · ${l.next_followup_time}` : ""}</div>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <a href={`tel:${l.phone}`} className="inline-flex items-center justify-center h-8 w-8 rounded-md border hover:bg-slate-50" title="Call" data-testid={`fu-call-${l.id}`}><Phone className="w-3.5 h-3.5" /></a>
        <Button size="sm" variant="outline" className="h-8 wa-btn" onClick={() => openWa(l)} title="WhatsApp" data-testid={`fu-wa-${l.id}`}><MessageCircle className="w-3.5 h-3.5" /></Button>
        <Button size="sm" className="h-8" onClick={() => openUpdate(l)} data-testid={`fu-addupdate-${l.id}`}>Add Update</Button>
      </div>
    </div>
  );

  const Section = ({ title, hindi, items, tone, icon: Icon, testid }) => (
    <Card className={tone === "red" ? "border-rose-300 bg-rose-50/40" : ""} data-testid={testid}>
      <CardContent className="p-4">
        <div className={`flex items-center gap-2 font-semibold mb-3 ${tone === "red" ? "text-rose-700" : "text-slate-800"}`}>
          <Icon className="w-4 h-4" />
          <span>{title} {hindi && <span className="text-slate-400 font-normal text-sm">· {hindi}</span>} ({items.length})</span>
        </div>
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {items.length === 0 && <div className="text-xs text-slate-400 py-2">Kuch nahi — sab clear ✅</div>}
          {items.map((l) => <Row key={l.id} l={l} />)}
        </div>
      </CardContent>
    </Card>
  );

  if (!data) return <div className="text-slate-500">Loading…</div>;

  return (
    <div>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{admin ? "Follow-up Dashboard" : "My Dashboard"}</h1>
          <p className="text-slate-500 text-sm mt-1">Aaj / Kal ke follow-ups aur saari visited enquiries ek jagah</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {admin && (
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-48" data-testid="fu-counsellor-filter"><SelectValue placeholder="All counsellors" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All counsellors</SelectItem>
                {counsellors.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Button onClick={() => setShowAdd(true)} data-testid="manual-add-lead-btn"><Plus className="w-4 h-4 mr-2" /> Add Lead Manually</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Section title="Aaj ke Follow-ups" hindi="Today" items={data.today} icon={CalendarCheck2} testid="section-today" />
        <Section title="Kal ke Follow-ups" hindi="Tomorrow" items={data.tomorrow} icon={CalendarClock} testid="section-tomorrow" />
        <Section title="Overdue Follow-ups" hindi="Chhoot gaye" items={data.overdue} tone="red" icon={AlertTriangle} testid="section-overdue" />
        <Section title="No Follow-up Date Set" hindi="Date nahi" items={data.no_date} icon={CircleHelp} testid="section-nodate" />
      </div>

      <Section title="Visited / All Enquiries" hindi="Aa chuke / manually added" items={data.visited} icon={Users2} testid="section-visited" />

      {/* Add Update dialog */}
      <Dialog open={!!updLead} onOpenChange={(o) => !o && setUpdLead(null)}>
        <DialogContent data-testid="fu-update-dialog">
          <DialogHeader><DialogTitle>Add Follow-up Update {updLead ? `· ${updLead.name}` : ""}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>What was discussed *</Label>
              <Textarea rows={2} value={uDiscussed} onChange={(e) => setUDiscussed(e.target.value)} data-testid="fu-dialog-discussed" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={uStatus} onValueChange={setUStatus}>
                  <SelectTrigger data-testid="fu-dialog-status"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {!uClosing && (
                <>
                  <div><Label>Next date *</Label><Input type="date" value={uDate} onChange={(e) => setUDate(e.target.value)} data-testid="fu-dialog-date" /></div>
                  <div><Label>Time</Label><Input type="time" value={uTime} onChange={(e) => setUTime(e.target.value)} data-testid="fu-dialog-time" /></div>
                </>
              )}
            </div>
            {uStatus === "Lost" && <div><Label>Reason for Lost *</Label><Input value={uLost} onChange={(e) => setULost(e.target.value)} data-testid="fu-dialog-lost" /></div>}
          </div>
          <DialogFooter><Button onClick={saveUpdate} disabled={savingU} data-testid="fu-dialog-save">{savingU ? "Saving…" : "Save Update"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* WhatsApp dialog */}
      <Dialog open={!!waLead} onOpenChange={(o) => !o && setWaLead(null)}>
        <DialogContent data-testid="fu-wa-dialog">
          <DialogHeader><DialogTitle>WhatsApp Message {waLead ? `· ${waLead.name}` : ""}</DialogTitle></DialogHeader>
          <div>
            <Label>Template</Label>
            <Select value={tplId} onValueChange={regenWa}>
              <SelectTrigger data-testid="fu-wa-template"><SelectValue /></SelectTrigger>
              <SelectContent>{templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
            {preview && <div className="mt-3 p-3 bg-emerald-50 rounded whitespace-pre-wrap text-sm" data-testid="fu-wa-preview">{preview.body}</div>}
          </div>
          <DialogFooter><Button className="wa-btn" onClick={sendWa} disabled={!preview} data-testid="fu-wa-send">Open WhatsApp</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual add dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-2xl" data-testid="manual-add-dialog">
          <DialogHeader><DialogTitle>Add Lead Manually</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2"><Label>Full Name *</Label><Input value={addForm.name} onChange={(e) => updAdd("name", e.target.value)} data-testid="add-name" /></div>
            <div><Label>Phone (WhatsApp) *</Label><Input value={addForm.phone} onChange={(e) => updAdd("phone", e.target.value)} placeholder="10-digit mobile" data-testid="add-phone" /></div>
            <div><Label>Email</Label><Input type="email" value={addForm.email} onChange={(e) => updAdd("email", e.target.value)} data-testid="add-email" /></div>
            <div><Label>City</Label><Input value={addForm.city} onChange={(e) => updAdd("city", e.target.value)} data-testid="add-city" /></div>
            <div><Label>Qualification</Label><Input value={addForm.qualification} onChange={(e) => updAdd("qualification", e.target.value)} data-testid="add-qual" /></div>
            <div>
              <Label>Course *</Label>
              <Select value={addForm.course_id} onValueChange={(v) => updAdd("course_id", v)}>
                <SelectTrigger data-testid="add-course"><SelectValue placeholder="Select a course" /></SelectTrigger>
                <SelectContent>{courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Source</Label>
              <Select value={addForm.source} onValueChange={(v) => updAdd("source", v)}>
                <SelectTrigger data-testid="add-source"><SelectValue placeholder="How did they hear?" /></SelectTrigger>
                <SelectContent>{SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Preferred Batch</Label><Input value={addForm.batch_preference} onChange={(e) => updAdd("batch_preference", e.target.value)} placeholder="Weekend / Evening" data-testid="add-batch" /></div>
            {admin && (
              <div>
                <Label>Assign to Counsellor</Label>
                <Select value={addForm.assigned_counsellor_id || "auto"} onValueChange={(v) => updAdd("assigned_counsellor_id", v === "auto" ? "" : v)}>
                  <SelectTrigger data-testid="add-counsellor"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (Round-robin)</SelectItem>
                    {counsellors.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="md:col-span-2 flex items-start gap-3 p-3 rounded bg-slate-50">
              <Checkbox id="add-consent" checked={addForm.consent} onCheckedChange={(v) => updAdd("consent", !!v)} data-testid="add-consent" />
              <Label htmlFor="add-consent" className="text-sm font-normal cursor-pointer">Student consents to being contacted via phone/WhatsApp regarding this enquiry.</Label>
            </div>
          </div>
          <DialogFooter><Button onClick={submitAdd} disabled={savingAdd} data-testid="add-submit">{savingAdd ? "Adding…" : "Add Enquiry"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
