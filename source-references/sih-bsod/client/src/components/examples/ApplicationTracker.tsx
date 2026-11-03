import { ApplicationTracker } from "../ApplicationTracker";
import { ThemeProvider } from "../ThemeProvider";

export default function ApplicationTrackerExample() {
  return (
    <ThemeProvider>
      <div className="p-8 bg-background">
        <ApplicationTracker />
      </div>
    </ThemeProvider>
  );
}
