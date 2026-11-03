import { AdminDashboard } from "../AdminDashboard";
import { ThemeProvider } from "../ThemeProvider";

export default function AdminDashboardExample() {
  return (
    <ThemeProvider>
      <div className="p-8 bg-background">
        <AdminDashboard />
      </div>
    </ThemeProvider>
  );
}
