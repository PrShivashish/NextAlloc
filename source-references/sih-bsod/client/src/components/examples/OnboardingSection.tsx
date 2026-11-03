import { OnboardingSection } from "../OnboardingSection";
import { ThemeProvider } from "../ThemeProvider";

export default function OnboardingSectionExample() {
  return (
    <ThemeProvider>
      <div className="p-8 bg-background">
        <OnboardingSection />
      </div>
    </ThemeProvider>
  );
}
