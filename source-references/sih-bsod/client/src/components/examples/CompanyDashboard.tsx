import { CompanyDashboard } from "../CompanyDashboard";
import { ThemeProvider } from "../ThemeProvider";

export default function CompanyDashboardExample() {
  return (
    <ThemeProvider>
      <div className="p-8 bg-background">
        <CompanyDashboard />
      </div>
    </ThemeProvider>
  );
}
