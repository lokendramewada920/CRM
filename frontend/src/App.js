import { Toaster } from "@/components/ui/sonner";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Login from "./pages/Login";
import Layout from "./components/Layout";
import ReceptionVisit from "./pages/reception/VisitForm";
import CounsellorLeads from "./pages/counsellor/MyLeads";
import Visited from "./pages/Visited";
import LeadDetail from "./pages/counsellor/LeadDetail";
import AdminDashboard from "./pages/admin/Dashboard";
import AllLeads from "./pages/admin/AllLeads";
import UsersPage from "./pages/admin/Users";
import CoursesPage from "./pages/admin/Courses";
import TemplatesPage from "./pages/admin/Templates";
import SettingsPage from "./pages/admin/Settings";
import PaymentsPage from "./pages/admin/Payments";
import PermissionsPage from "./pages/admin/Permissions";
import AuditPage from "./pages/admin/Audit";
import TrashPage from "./pages/admin/Trash";
import "@/index.css";

function Protected({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RoleHome() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "reception") return <Navigate to="/reception" replace />;
  if (user.role === "counsellor") return <Navigate to="/my-leads" replace />;
  return <Navigate to="/admin" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RoleHome />} />
          <Route element={<Protected><Layout /></Protected>}>
            <Route path="/reception" element={<ReceptionVisit />} />
            <Route path="/my-leads" element={<CounsellorLeads />} />
            <Route path="/visited" element={<Visited />} />
            <Route path="/leads/:id" element={<LeadDetail />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/leads" element={<AllLeads />} />
            <Route path="/admin/users" element={<UsersPage />} />
            <Route path="/admin/courses" element={<CoursesPage />} />
            <Route path="/admin/templates" element={<TemplatesPage />} />
            <Route path="/admin/settings" element={<SettingsPage />} />
            <Route path="/admin/payments" element={<PaymentsPage />} />
            <Route path="/admin/permissions" element={<PermissionsPage />} />
            <Route path="/admin/audit" element={<AuditPage />} />
            <Route path="/admin/trash" element={<TrashPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
