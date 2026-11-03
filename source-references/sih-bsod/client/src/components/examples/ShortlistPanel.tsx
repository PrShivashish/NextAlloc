import { ShortlistPanel } from "../ShortlistPanel";
import { ThemeProvider } from "../ThemeProvider";

export default function ShortlistPanelExample() {
  return (
    <ThemeProvider>
      <div className="p-8 bg-background">
        <ShortlistPanel />
      </div>
    </ThemeProvider>
  );
}
