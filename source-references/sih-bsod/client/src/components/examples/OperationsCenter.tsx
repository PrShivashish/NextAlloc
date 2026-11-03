import { OperationsCenter } from "../OperationsCenter";
import { ThemeProvider } from "../ThemeProvider";

export default function OperationsCenterExample() {
  return (
    <ThemeProvider>
      <div className="p-8 bg-background">
        <OperationsCenter />
      </div>
    </ThemeProvider>
  );
}
