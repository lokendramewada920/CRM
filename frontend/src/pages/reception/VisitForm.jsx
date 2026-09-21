import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import { Checkbox } from "../../components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { JOIN_TIMELINES } from "../../lib/statuses";

const SOURCES = ["Instagram", "Google Search", "Friend Referral", "Walk-in", "Newspaper", "Other"];

export default function VisitForm() {
  const [courses, setCourses] = useState([]);
  const [counsellors, setCounsellors] = useState([]);
  const [form, setForm] = useState({
    name: "", phone: "", email: "", city: "", qualification: "",
    course_id: "", source: "", batch_preference: "",
    join_timeline: "", remarks: "", consent: false,
  });
  const [dup, setDup] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedLead, setSavedLead] = useState(null);

  useEffect(() => {
    api.get("/courses?active_only=true").then((r) => setCourses(r.data));
    api.get("/counsellors").then((r) => setCounsellors(r.data));
  }, []);

  useEffect(() => {
    const p = form.phone.trim();
    if (p.length >= 10) {
      api.get(`/leads/duplicate?phone=${encodeURIComponent(p)}`).then((r) => setDup(r.data.exists ? r.data.lead : null)).catch(() => {});
    } else setDup(null);
  }, [form.phone]);

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.consent) { toast.error("Consent is required"); return; }
    if (!form.course_id) { toast.error("Select a course"); return; }
    setSaving(true);
    try {
      const payload = { ...form, email: form.email || null };
      const r = await api.post("/leads", payload);
      setSavedLead(r.data);
      toast.success("Visit saved — lead created");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const assignedName = useMemo(() => {
    if (!savedLead) return "";
    const c = counsellors.find((x) => x.id === savedLead.assigned_counsellor_id);
    return c ? c.name : "Auto-assigned";
  }, [savedLead, counsellors]);

  if (savedLead) {
    return (
      <div className="max-w-2xl mx-auto py-10">
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold">Thank you, {savedLead.name}!</h1>
            <p className="text-slate-500 mt-2">Your visit has been recorded.</p>
            <div className="mt-6 p-4 bg-slate-50 rounded-lg">
              <div className="text-xs text-slate-500 uppercase tracking-wide">Assigned Counsellor</div>
              <div className="text-lg font-semibold mt-1">{assignedName}</div>
              <div className="text-xs text-slate-500 mt-2">They will contact you shortly.</div>
            </div>
            <Button className="mt-6" onClick={() => { setSavedLead(null); setForm({ name:"", phone:"", email:"", city:"", qualification:"", course_id:"", source:"", batch_preference:"", join_timeline:"", remarks:"", consent:false }); }} data-testid="visit-form-new-btn">
              Register Another Visit
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold mb-1">Student Visit Form</h1>
      <p className="text-slate-500 mb-6">Fill in the details of the visiting student</p>
      <Card>
        <CardContent className="p-6">
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label>Full Name *</Label>
              <Input required value={form.name} onChange={(e) => upd("name", e.target.value)} data-testid="visit-form-name-input" />
            </div>
            <div>
              <Label>Phone (WhatsApp) *</Label>
              <Input required inputMode="tel" value={form.phone} onChange={(e) => upd("phone", e.target.value)} placeholder="10-digit mobile" data-testid="visit-form-phone-input" />
              {dup && (
                <div className="flex items-start gap-2 mt-2 p-2 rounded bg-amber-50 border border-amber-300 text-amber-800 text-xs" data-testid="duplicate-warning">
                  <AlertTriangle className="w-4 h-4 mt-0.5" />
                  <div>Duplicate: <b>{dup.name}</b> already exists (status: {dup.status})</div>
                </div>
              )}
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => upd("email", e.target.value)} data-testid="visit-form-email-input" />
            </div>
            <div>
              <Label>City</Label>
              <Input value={form.city} onChange={(e) => upd("city", e.target.value)} data-testid="visit-form-city-input" />
            </div>
            <div>
              <Label>Qualification / Occupation</Label>
              <Input value={form.qualification} onChange={(e) => upd("qualification", e.target.value)} data-testid="visit-form-qual-input" />
            </div>
            <div>
              <Label>Course Interested *</Label>
              <Select value={form.course_id} onValueChange={(v) => upd("course_id", v)}>
                <SelectTrigger data-testid="visit-form-course-select"><SelectValue placeholder="Select a course" /></SelectTrigger>
                <SelectContent>
                  {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>How did they hear about us?</Label>
              <Select value={form.source} onValueChange={(v) => upd("source", v)}>
                <SelectTrigger data-testid="visit-form-source-select"><SelectValue placeholder="Select source" /></SelectTrigger>
                <SelectContent>
                  {SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Preferred Batch Timing</Label>
              <Input value={form.batch_preference} onChange={(e) => upd("batch_preference", e.target.value)} placeholder="e.g. Weekend / Evening" data-testid="visit-form-batch-input" />
            </div>
            <div>
              <Label>When do they want to join?</Label>
              <Select value={form.join_timeline} onValueChange={(v) => upd("join_timeline", v)}>
                <SelectTrigger data-testid="visit-form-join-select"><SelectValue placeholder="Select timeline" /></SelectTrigger>
                <SelectContent>
                  {JOIN_TIMELINES.map((j) => <SelectItem key={j} value={j}>{j}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Remarks</Label>
              <Textarea value={form.remarks} onChange={(e) => upd("remarks", e.target.value)} rows={3} data-testid="visit-form-remarks-input" />
            </div>
            <div className="md:col-span-2 flex items-start gap-3 p-3 rounded bg-slate-50">
              <Checkbox id="consent" checked={form.consent} onCheckedChange={(v) => upd("consent", !!v)} data-testid="visit-form-consent-checkbox" />
              <Label htmlFor="consent" className="text-sm font-normal cursor-pointer">
                I consent to Arts of Finance storing my contact details and reaching out via phone/WhatsApp regarding my enquiry.
              </Label>
            </div>
            <div className="md:col-span-2">
              <Button type="submit" size="lg" className="w-full text-base" disabled={saving} data-testid="visit-form-submit-btn">
                {saving ? "Saving…" : "Register Visit"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
