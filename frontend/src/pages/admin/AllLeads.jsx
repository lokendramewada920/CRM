import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { API_URL } from "../../lib/config";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../contexts/AuthContext";

const STATUSES = ["All","New","Contacted","Interested","Registered","Lost"];

export default function AllLeads() {
  const { has } = useAuth();
  const [leads, setLeads] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const load = () => api.get("/leads").then((r) => setLeads(r.data));
  useEffect(() => { load(); }, []);

  const shown = leads.filter((l) =>
    (status === "All" || l.status === status) &&
    (!q || `${l.name} ${l.phone} ${l.email||""}`.toLowerCase().includes(q.toLowerCase()))
  );

  const del = async (id) => {
    if (!window.confirm("Move this lead to trash?")) return;
    await api.delete(`/leads/${id}`);
    toast.success("Moved to trash");
    load();
  };

  const csv = async () => {
    const t = localStorage.getItem("aof_token");
    const r = await fetch(`${API_URL}/leads/export/csv`, { headers: { Authorization: `Bearer ${t}` } });
    const blob = await r.blob();
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "leads.csv"; a.click();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <h1 className="text-2xl md:text-3xl font-bold">All Leads</h1>
        <Button variant="outline" onClick={csv} data-testid="leads-csv-btn"><Download className="w-4 h-4 mr-2" />CSV</Button>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" data-testid="all-leads-search" />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40" data-testid="all-leads-status-filter"><SelectValue /></SelectTrigger>
          <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <Card><CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr><th className="text-left p-3">Name</th><th className="text-left p-3">Phone</th><th className="text-left p-3">Status</th><th className="text-left p-3">Visit</th><th className="text-right p-3">Actions</th></tr>
          </thead>
          <tbody>
            {shown.map((l) => (
              <tr key={l.id} className="border-t hover:bg-slate-50">
                <td className="p-3"><Link to={`/leads/${l.id}`} className="text-teal-700 hover:underline" data-testid={`row-lead-${l.id}`}>{l.name}</Link></td>
                <td className="p-3">{l.phone}</td>
                <td className="p-3"><Badge className={`status-${l.status}`}>{l.status}</Badge></td>
                <td className="p-3">{new Date(l.visit_date).toLocaleDateString()}</td>
                <td className="p-3 text-right">{has("lead.delete") && <Button size="sm" variant="ghost" onClick={() => del(l.id)} data-testid={`delete-lead-${l.id}`}><Trash2 className="w-4 h-4" /></Button>}</td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-400">No leads.</td></tr>}
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}
