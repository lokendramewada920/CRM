import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { toast } from "sonner";

export default function PermissionsPage() {
  const [catalog, setCatalog] = useState([]);
  const [roles, setRoles] = useState([]);
  const [edits, setEdits] = useState({});

  useEffect(() => {
    api.get("/permissions/catalog").then((r) => setCatalog(r.data.permissions));
    api.get("/roles").then((r) => { setRoles(r.data); const m = {}; r.data.forEach((x) => m[x.name] = new Set(x.permissions)); setEdits(m); });
  }, []);

  const toggle = (role, perm) => {
    setEdits((e) => {
      const cp = { ...e };
      const s = new Set(cp[role]);
      s.has(perm) ? s.delete(perm) : s.add(perm);
      cp[role] = s;
      return cp;
    });
  };

  const save = async (role) => {
    await api.put(`/roles/${role}`, { permissions: Array.from(edits[role]) });
    toast.success(`Saved ${role}`);
  };

  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-bold mb-2">Permission Matrix</h1>
      <p className="text-slate-500 mb-6">Toggle permissions per role. Changes take effect on next request.</p>
      <Card><CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr><th className="text-left p-3 sticky left-0 bg-slate-50">Permission</th>
              {roles.map((r) => <th key={r.name} className="p-3 text-center capitalize">{r.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {catalog.map((p) => (
              <tr key={p} className="border-t">
                <td className="p-3 sticky left-0 bg-white font-mono text-xs">{p}</td>
                {roles.map((r) => (
                  <td key={r.name} className="p-3 text-center">
                    <Checkbox checked={edits[r.name]?.has(p) || false} onCheckedChange={() => toggle(r.name, p)} data-testid={`perm-${r.name}-${p}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent></Card>
      <div className="mt-4 flex gap-2 flex-wrap">
        {roles.map((r) => <Button key={r.name} onClick={() => save(r.name)} data-testid={`save-role-${r.name}`}>Save {r.name}</Button>)}
      </div>
    </div>
  );
}
