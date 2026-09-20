import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Card, CardContent } from "../../components/ui/card";

export default function AuditPage() {
  const [items, setItems] = useState([]);
  useEffect(() => { api.get("/audit").then((r) => setItems(r.data)); }, []);
  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-bold mb-6">Audit Log</h1>
      <Card><CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="text-left p-3">Time</th><th className="text-left p-3">Actor</th><th className="text-left p-3">Action</th><th className="text-left p-3">Entity</th><th className="text-left p-3">Meta</th></tr></thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="p-3 text-xs">{new Date(a.created_at).toLocaleString()}</td>
                <td className="p-3 text-xs">{a.actor_role}</td>
                <td className="p-3"><code className="text-xs">{a.action}</code></td>
                <td className="p-3 text-xs">{a.entity}:{(a.entity_id||"").slice(0,8)}</td>
                <td className="p-3 text-xs text-slate-500 max-w-md truncate">{JSON.stringify(a.meta)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}
