import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { API_URL } from "../../lib/config";
import { RefreshCw, FileText } from "lucide-react";
import { toast } from "sonner";

export default function PaymentsPage() {
  const [items, setItems] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const load = () => { api.get("/payments").then((r) => setItems(r.data)); api.get("/receipts").then((r) => setReceipts(r.data)); };
  useEffect(load, []);
  const pollNow = async () => { const r = await api.post("/payments/poll-now"); toast.success(`Updated: ${r.data.updated}`); load(); };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">Payments</h1>
        <Button variant="outline" onClick={pollNow} data-testid="poll-now-btn"><RefreshCw className="w-4 h-4 mr-2" />Poll now</Button>
      </div>
      <Card className="mb-6"><CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="text-left p-3">Lead</th><th className="text-left p-3">Amount</th><th className="text-left p-3">Status</th><th className="text-left p-3">Link</th><th className="text-left p-3">Created</th></tr></thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-3 text-xs">{p.lead_id.slice(0,8)}</td>
                <td className="p-3">₹{p.amount}</td>
                <td className="p-3"><Badge className={p.status==="paid"?"bg-emerald-600":"bg-slate-400"}>{p.status}</Badge></td>
                <td className="p-3"><a href={p.short_url} target="_blank" rel="noreferrer" className="text-teal-700 underline break-all">Open</a></td>
                <td className="p-3">{new Date(p.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-400">No payments yet.</td></tr>}
          </tbody>
        </table>
      </CardContent></Card>

      <h3 className="font-semibold mb-2">Receipts</h3>
      <Card><CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="text-left p-3">Receipt #</th><th className="text-left p-3">Student</th><th className="text-left p-3">Course</th><th className="text-left p-3">Paid</th><th className="text-left p-3">Date</th><th></th></tr></thead>
          <tbody>
            {receipts.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3">{r.receipt_number}</td><td className="p-3">{r.student_name}</td><td className="p-3">{r.course_name}</td>
                <td className="p-3">₹{r.amount_paid}</td><td className="p-3">{new Date(r.date_iso).toLocaleDateString()}</td>
                <td className="p-3"><a href={`${API_URL}/receipts/${r.id}/pdf`} target="_blank" rel="noreferrer" className="text-teal-700 underline flex items-center gap-1"><FileText className="w-3 h-3" /> PDF</a></td>
              </tr>
            ))}
            {receipts.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-400">No receipts yet.</td></tr>}
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}
