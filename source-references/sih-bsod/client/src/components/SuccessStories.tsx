import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Star, Quote } from "lucide-react";
import { motion } from "framer-motion";

interface Story {
  id: number;
  name: string;
  role: string;
  company: string;
  testimonial: string;
  rating: number;
}

export function SuccessStories() {
  // todo: remove mock functionality - replace with real testimonials
  const stories: Story[] = [
    {
      id: 1,
      name: "Priya Sharma",
      role: "Software Engineer Intern",
      company: "TechCorp India",
      testimonial: "The AI matching system found me the perfect internship that aligned with my skills and career goals. I received an offer within 2 weeks!",
      rating: 5,
    },
    {
      id: 2,
      name: "Rahul Verma",
      role: "Marketing Intern",
      company: "BrandFirst Solutions",
      testimonial: "An amazing platform that truly understands student aspirations. The application process was seamless and transparent.",
      rating: 5,
    },
    {
      id: 3,
      name: "Ananya Patel",
      role: "Data Analyst Intern",
      company: "DataDriven Co.",
      testimonial: "From registration to onboarding, everything was handled professionally. The government oversight gave me confidence in the process.",
      rating: 4,
    },
  ];

  return (
    <section id="gallery-section" className="py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-bold mb-4">Success Stories</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Hear from students who found their dream internships through our AI-powered matching platform
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {stories.map((story, index) => (
            <motion.div
              key={story.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="h-full hover-elevate" data-testid={`card-story-${story.id}`}>
                <CardContent className="p-6">
                  <Quote className="h-8 w-8 text-primary/30 mb-4" />
                  <p className="text-muted-foreground mb-6 italic">
                    "{story.testimonial}"
                  </p>
                  <div className="flex items-center gap-4">
                    <Avatar>
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {story.name.split(" ").map(n => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">{story.name}</p>
                      <p className="text-sm text-muted-foreground">{story.role}</p>
                      <p className="text-xs text-primary">{story.company}</p>
                    </div>
                  </div>
                  <div className="flex gap-0.5 mt-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${i < story.rating ? "text-yellow-500 fill-yellow-500" : "text-muted"}`}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
