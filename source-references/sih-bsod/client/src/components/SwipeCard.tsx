import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Building2, Clock, IndianRupee, X, Heart, Undo2, Star } from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";

interface Internship {
  id: number;
  title: string;
  company: string;
  location: string;
  duration: string;
  stipend: string;
  skills: string[];
  matchScore: number;
  description: string;
}

interface SwipeCardProps {
  onSwipe?: (internship: Internship, direction: "left" | "right") => void;
}

export function SwipeCard({ onSwipe }: SwipeCardProps) {
  // todo: remove mock functionality - replace with real internship data
  const [internships, setInternships] = useState<Internship[]>([
    {
      id: 1,
      title: "Software Developer Intern",
      company: "TechCorp India",
      location: "Bangalore",
      duration: "6 months",
      stipend: "25,000/month",
      skills: ["Python", "React", "SQL"],
      matchScore: 95,
      description: "Work on cutting-edge AI projects with our engineering team."
    },
    {
      id: 2,
      title: "Data Science Intern",
      company: "Analytics Pro",
      location: "Mumbai",
      duration: "6 months",
      stipend: "20,000/month",
      skills: ["Python", "ML", "Statistics"],
      matchScore: 88,
      description: "Analyze large datasets and build predictive models."
    },
    {
      id: 3,
      title: "Product Management Intern",
      company: "StartupX",
      location: "Delhi NCR",
      duration: "3 months",
      stipend: "15,000/month",
      skills: ["Communication", "Analytics", "Agile"],
      matchScore: 82,
      description: "Learn product development from ideation to launch."
    },
  ]);

  const [swipedCards, setSwipedCards] = useState<Internship[]>([]);
  const [exitDirection, setExitDirection] = useState<"left" | "right" | null>(null);

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const likeOpacity = useTransform(x, [0, 100], [0, 1]);
  const nopeOpacity = useTransform(x, [-100, 0], [1, 0]);

  const currentCard = internships[internships.length - 1];

  const handleSwipe = (direction: "left" | "right") => {
    if (!currentCard) return;
    
    setExitDirection(direction);
    setTimeout(() => {
      setSwipedCards(prev => [...prev, currentCard]);
      setInternships(prev => prev.slice(0, -1));
      setExitDirection(null);
      onSwipe?.(currentCard, direction);
    }, 200);
  };

  const handleUndo = () => {
    if (swipedCards.length > 0) {
      const lastSwiped = swipedCards[swipedCards.length - 1];
      setSwipedCards(prev => prev.slice(0, -1));
      setInternships(prev => [...prev, lastSwiped]);
    }
  };

  const handleDragEnd = (_: any, info: { offset: { x: number } }) => {
    if (info.offset.x > 100) {
      handleSwipe("right");
    } else if (info.offset.x < -100) {
      handleSwipe("left");
    }
  };

  return (
    <div className="w-full max-w-md mx-auto" data-testid="swipe-card-container">
      <div className="relative h-[500px]">
        <AnimatePresence>
          {internships.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center text-center p-8"
            >
              <Star className="h-16 w-16 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">All caught up!</h3>
              <p className="text-muted-foreground mb-4">
                You've reviewed all available internships. Check back later for more matches.
              </p>
              <Button variant="outline" onClick={handleUndo} disabled={swipedCards.length === 0}>
                <Undo2 className="h-4 w-4 mr-2" />
                Review Previous
              </Button>
            </motion.div>
          ) : (
            internships.slice(-3).map((internship, index) => {
              const isTop = index === internships.slice(-3).length - 1;
              
              return (
                <motion.div
                  key={internship.id}
                  className="absolute inset-0"
                  style={{
                    zIndex: index,
                    scale: 1 - (internships.slice(-3).length - 1 - index) * 0.05,
                    y: (internships.slice(-3).length - 1 - index) * 10,
                    ...(isTop ? { x, rotate } : {})
                  }}
                  drag={isTop ? "x" : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  onDragEnd={isTop ? handleDragEnd : undefined}
                  animate={isTop && exitDirection ? {
                    x: exitDirection === "right" ? 500 : -500,
                    opacity: 0,
                    transition: { duration: 0.2 }
                  } : {}}
                  data-testid={`card-internship-${internship.id}`}
                >
                  <Card className="h-full p-6 cursor-grab active:cursor-grabbing overflow-hidden">
                    {isTop && (
                      <>
                        <motion.div
                          className="absolute top-8 right-8 bg-green-500 text-white px-4 py-2 rounded-lg font-bold text-xl rotate-12"
                          style={{ opacity: likeOpacity }}
                        >
                          INTERESTED
                        </motion.div>
                        <motion.div
                          className="absolute top-8 left-8 bg-red-500 text-white px-4 py-2 rounded-lg font-bold text-xl -rotate-12"
                          style={{ opacity: nopeOpacity }}
                        >
                          PASS
                        </motion.div>
                      </>
                    )}

                    <div className="h-full flex flex-col">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-xl font-bold">{internship.title}</h3>
                          <div className="flex items-center gap-2 text-muted-foreground mt-1">
                            <Building2 className="h-4 w-4" />
                            <span>{internship.company}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 bg-primary/10 text-primary px-3 py-1 rounded-full">
                          <Star className="h-4 w-4 fill-current" />
                          <span className="font-semibold">{internship.matchScore}%</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span>{internship.location}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>{internship.duration}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm col-span-2">
                          <IndianRupee className="h-4 w-4 text-muted-foreground" />
                          <span>{internship.stipend}</span>
                        </div>
                      </div>

                      <p className="text-sm text-muted-foreground mb-4 flex-1">
                        {internship.description}
                      </p>

                      <div className="flex flex-wrap gap-2">
                        {internship.skills.map((skill) => (
                          <Badge key={skill} variant="secondary">{skill}</Badge>
                        ))}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {internships.length > 0 && (
        <div className="flex justify-center gap-4 mt-6">
          <Button
            size="lg"
            variant="outline"
            className="h-14 w-14 rounded-full border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 dark:border-red-900 dark:hover:bg-red-950"
            onClick={() => handleSwipe("left")}
            data-testid="button-pass"
          >
            <X className="h-6 w-6" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="h-10 w-10 rounded-full"
            onClick={handleUndo}
            disabled={swipedCards.length === 0}
            data-testid="button-undo"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            size="lg"
            className="h-14 w-14 rounded-full bg-green-500 hover:bg-green-600 text-white"
            onClick={() => handleSwipe("right")}
            data-testid="button-interested"
          >
            <Heart className="h-6 w-6" />
          </Button>
        </div>
      )}
    </div>
  );
}
