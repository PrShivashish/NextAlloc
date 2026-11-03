import { ProfileSetup } from "../ProfileSetup";
import { ThemeProvider } from "../ThemeProvider";

export default function ProfileSetupExample() {
  return (
    <ThemeProvider>
      <div className="p-8 bg-background min-h-[600px]">
        <ProfileSetup onComplete={(data) => console.log("Profile complete:", data)} />
      </div>
    </ThemeProvider>
  );
}
