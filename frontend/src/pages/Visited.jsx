import { useAuth } from "../contexts/AuthContext";
import FollowupDashboard from "../components/FollowupDashboard";

export default function Visited() {
  const { user } = useAuth();
  return <FollowupDashboard admin={user?.role === "admin"} variant="visited" />;
}
