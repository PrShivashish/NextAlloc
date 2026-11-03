import { SwipeCard } from "../SwipeCard";
import { ThemeProvider } from "../ThemeProvider";

export default function SwipeCardExample() {
  return (
    <ThemeProvider>
      <div className="p-8 bg-background min-h-[700px]">
        <SwipeCard onSwipe={(internship, direction) => console.log(`Swiped ${direction}:`, internship.title)} />
      </div>
    </ThemeProvider>
  );
}
