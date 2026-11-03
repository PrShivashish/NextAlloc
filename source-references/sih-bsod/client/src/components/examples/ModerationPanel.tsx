import { ModerationPanel } from "../ModerationPanel";
import { ThemeProvider } from "../ThemeProvider";

export default function ModerationPanelExample() {
  return (
    <ThemeProvider>
      <div className="p-8 bg-background">
        <ModerationPanel />
      </div>
    </ThemeProvider>
  );
}
