import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";

export default function TrashPage() {
  const [items, setItems] = useState([]);
  const load = () => api.get("/trash/leads").then((r) => setItems(r.data));
  useEffect(load, []);
  const restore = async (id) => { await api.post(`/leads/${id}/restore`); toast.success("Restored"); load(); };
  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-bold mb-6">Trash</h1>
      <Card><CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="text-left p-3">Name</th><th className="text-left p-3">Phone</th><th className="text-left p-3">Deleted at</th><th></th></tr></thead>
          <tbody>
            {items.map((l) => (
              <tr key={l.id} className="border-t"><td className="p-3">{l.name}</td><td className="p-3">{l.phone}</td><td className="p-3">{new Date(l.deleted_at).toLocaleString()}</td>
                <td className="p-3 text-right"><Button size="sm" onClick={() => restore(l.id)} data-testid={`restore-${l.id}`}>Restore</Button></td></tr>
            ))}
            {items.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate-400">Empty.</td></tr>}
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}
