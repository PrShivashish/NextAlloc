import { EligibilityChecker } from "../EligibilityChecker";
import { ThemeProvider } from "../ThemeProvider";

export default function EligibilityCheckerExample() {
  return (
    <ThemeProvider>
      <div className="p-8 bg-background min-h-[400px] flex items-center justify-center">
        <EligibilityChecker onComplete={() => console.log("Eligibility check complete")} />
      </div>
    </ThemeProvider>
  );
}
