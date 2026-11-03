import { NotificationTicker } from "../NotificationTicker";
import { ThemeProvider } from "../ThemeProvider";

export default function NotificationTickerExample() {
  return (
    <ThemeProvider>
      <div className="h-32 relative">
        <NotificationTicker />
      </div>
    </ThemeProvider>
  );
}
