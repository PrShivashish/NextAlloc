import { QRAuth } from "../QRAuth";
import { ThemeProvider } from "../ThemeProvider";

export default function QRAuthExample() {
  return (
    <ThemeProvider>
      <div className="p-8 bg-background min-h-[500px] flex items-center justify-center">
        <QRAuth onAuthenticated={() => console.log("User authenticated")} />
      </div>
    </ThemeProvider>
  );
}
