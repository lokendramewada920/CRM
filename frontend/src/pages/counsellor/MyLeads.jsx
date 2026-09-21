import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Clock, Phone, MessageCircle } from "lucide-react";

function offerLeft(iso) {
  const diff = new Date(iso) - new Date();
  if (diff <= 0) return "Expired";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}h ${m}m left`;
}

export default function MyLeads() {
  const [leads, setLeads] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("today");

  const load = () => { api.get("/leads").then((r) => setLeads(r.data)); api.get("/followups/mine").then((r) => setFollowups(r.data)); };
  useEffect(() => { load(); }, []);

  const today = new Date().toISOString().slice(0, 10);
  const shown = leads.filter((l) => {
    if (q && !`${l.name} ${l.phone} ${l.email||""}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (tab === "today") return (l.visit_date || "").startsWith(today);
    if (tab === "open") return !["Registered", "Lost"].includes(l.status);
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl md:text-3xl font-bold">My Leads</h1>
        <div className="text-sm text-slate-500">{leads.length} total</div>
      </div>
      <p className="text-slate-500 mb-6">Today's visits and open leads assigned to you</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        {["today","open","all"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            data-testid={`tab-${t}`}
            className={`p-4 rounded-lg text-left border transition ${tab===t?"border-teal-600 bg-teal-50":"border-slate-200 bg-white"}`}
          >
            <div className="text-xs uppercase tracking-wide text-slate-500">{t === "today" ? "Today's Visits" : t === "open" ? "Open (not closed)" : "All Leads"}</div>
            <div className="text-2xl font-bold mt-1">
              {t === "today" ? leads.filter((l) => (l.visit_date||"").startsWith(today)).length
                : t === "open" ? leads.filter((l) => !["Registered","Lost"].includes(l.status)).length
                : leads.length}
            </div>
          </button>
        ))}
      </div>

      {followups.length > 0 && (
        <Card className="mb-6 border-amber-300 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 font-semibold text-amber-900 mb-2"><Clock className="w-4 h-4" /> Pending Follow-ups ({followups.length})</div>
            <ul className="text-sm space-y-1">
              {followups.slice(0, 5).map((f) => (
                <li key={f.id} className="flex justify-between">
                  <Link to={`/leads/${f.lead_id}`} className="text-teal-800 underline">Lead {f.lead_id.slice(0,8)}</Link>
                  <span className="text-amber-900">Due {new Date(f.due_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Input placeholder="Search name, phone, email" value={q} onChange={(e) => setQ(e.target.value)} className="mb-4 max-w-md" data-testid="leads-search-input" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {shown.map((l) => (
          <Link to={`/leads/${l.id}`} key={l.id} data-testid={`lead-card-${l.id}`}>
            <Card className="hover:shadow-md transition">
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-lg">{l.name}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3" /> {l.phone}</div>
                  </div>
                  <Badge className={`status-${l.status}`}>{l.status}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="offer-chip px-2 py-1 rounded">Offer: {offerLeft(l.offer_expires_at)}</span>
                  <span className="text-slate-500">{new Date(l.visit_date).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {shown.length === 0 && <div className="text-slate-400 text-sm py-8 text-center col-span-full">No leads to show.</div>}
      </div>
    </div>
  );
}
