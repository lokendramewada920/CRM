import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "./ui/button";
import { LogOut, LayoutDashboard, Users, BookOpen, MessageSquare, Settings, CreditCard, Shield, ScrollText, Trash2, UserPlus, ListChecks, UserCheck } from "lucide-react";

const NAV = {
  reception: [
    { to: "/reception", label: "New Visit", icon: UserPlus },
  ],
  counsellor: [
    { to: "/my-leads", label: "My Leads", icon: ListChecks },
    { to: "/visited", label: "Visited", icon: UserCheck },
  ],
  admin: [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { to: "/visited", label: "Visited", icon: UserCheck },
    { to: "/admin/leads", label: "All Leads", icon: ListChecks },
    { to: "/admin/payments", label: "Payments", icon: CreditCard },
    { to: "/admin/courses", label: "Courses", icon: BookOpen },
    { to: "/admin/templates", label: "Templates", icon: MessageSquare },
    { to: "/admin/users", label: "Users", icon: Users },
    { to: "/admin/permissions", label: "Permissions", icon: Shield },
    { to: "/admin/settings", label: "Settings", icon: Settings },
    { to: "/admin/audit", label: "Audit Log", icon: ScrollText },
    { to: "/admin/trash", label: "Trash", icon: Trash2 },
  ],
};

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const items = NAV[user?.role] || [];

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <aside className="md:w-64 aof-brand-gradient text-white md:min-h-screen p-5 flex md:flex-col gap-2 flex-wrap md:flex-nowrap sticky top-0 z-30">
        <div className="w-full md:mb-6">
          <Link to="/" className="block" data-testid="brand-home-link">
            <div className="text-lg font-bold tracking-tight" style={{ fontFamily: "Outfit" }}>Arts of Finance</div>
            <div className="text-xs text-slate-300">Admissions LMS</div>
          </Link>
        </div>
        <nav className="flex md:flex-col flex-row flex-wrap gap-1 md:gap-1 w-full">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end
              data-testid={`nav-${it.label.toLowerCase().replace(/\s+/g, "-")}`}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                  isActive ? "bg-white/15 text-white" : "text-slate-300 hover:bg-white/10"
                }`
              }
            >
              <it.icon className="w-4 h-4" />
              {it.label}
            </NavLink>
          ))}
        </nav>
        <div className="md:mt-auto w-full pt-4 border-t border-white/10">
          <div className="text-sm truncate">{user?.name}</div>
          <div className="text-xs text-slate-400 capitalize">{user?.role}</div>
          <Button size="sm" variant="secondary" onClick={logout} className="mt-2 w-full" data-testid="logout-btn">
            <LogOut className="w-3.5 h-3.5 mr-2" /> Logout
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
