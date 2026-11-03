import { IndiaMap } from "../IndiaMap";
import { ThemeProvider } from "../ThemeProvider";

export default function IndiaMapExample() {
  return (
    <ThemeProvider>
      <div className="p-8 bg-background min-h-[500px]">
        <IndiaMap />
      </div>
    </ThemeProvider>
  );
}
