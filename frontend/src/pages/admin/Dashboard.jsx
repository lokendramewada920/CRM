import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Card, CardContent } from "../../components/ui/card";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import FollowupDashboard from "../../components/FollowupDashboard";

function Kpi({ label, value, sub }) {
  return (
    <Card><CardContent className="p-5">
      <div className="text-xs uppercase text-slate-500 tracking-wide">{label}</div>
      <div className="text-3xl font-bold mt-1" style={{ fontFamily: "Outfit" }}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </CardContent></Card>
  );
}

export default function AdminDashboard() {
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/reports/dashboard").then((r) => setD(r.data)); }, []);

  return (
    <div className="space-y-10">
      <FollowupDashboard admin={true} />

      <div>
        <h2 className="text-xl font-bold mb-1">Reports & Performance</h2>
        <p className="text-slate-500 mb-6 text-sm">Overview of visits, conversion & revenue</p>
        {!d ? <div className="text-slate-500">Loading…</div> : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Kpi label="Visits Today" value={d.visits_today} />
              <Kpi label="Visits (7 days)" value={d.visits_week} />
              <Kpi label="Visits (30 days)" value={d.visits_month} />
              <Kpi label="Conversion" value={`${d.conversion_pct}%`} sub={`${d.registered}/${d.total_leads}`} />
            </div>

            <Card className="mb-6">
              <CardContent className="p-5">
                <div className="flex items-baseline justify-between mb-4">
                  <h3 className="font-semibold">Revenue (registered payments)</h3>
                  <div className="text-2xl font-bold text-emerald-700">₹{d.revenue.toLocaleString()}</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <h3 className="font-semibold mb-4">Counsellor Performance</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={d.counsellors}>
                    <XAxis dataKey="name" tickLine={false} />
                    <YAxis tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="leads" fill="#0D9488" radius={[4,4,0,0]} />
                    <Bar dataKey="registered" fill="#0F172A" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
                <table className="w-full mt-4 text-sm">
                  <thead><tr className="text-slate-500 text-xs uppercase"><th className="text-left py-2">Counsellor</th><th>Leads</th><th>Registered</th><th>Conversion</th></tr></thead>
                  <tbody>
                    {d.counsellors.map((c) => (
                      <tr key={c.id} className="border-t"><td className="py-2">{c.name}</td><td className="text-center">{c.leads}</td><td className="text-center">{c.registered}</td><td className="text-center">{c.conversion}%</td></tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

