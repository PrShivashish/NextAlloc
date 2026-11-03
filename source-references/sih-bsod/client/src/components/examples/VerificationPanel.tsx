import { VerificationPanel } from "../VerificationPanel";
import { ThemeProvider } from "../ThemeProvider";

export default function VerificationPanelExample() {
  return (
    <ThemeProvider>
      <div className="p-8 bg-background">
        <VerificationPanel />
      </div>
    </ThemeProvider>
  );
}
