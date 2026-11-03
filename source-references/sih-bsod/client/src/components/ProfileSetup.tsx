import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, ArrowLeft, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ProfileSetupProps {
  onComplete?: (data: ProfileData) => void;
}

interface ProfileData {
  name: string;
  email: string;
  phone: string;
  education: string;
  field: string;
  skills: string[];
  experience: string;
  preferences: {
    location: string;
    domain: string;
    duration: string;
  };
}

const STEPS = ["Personal Info", "Education", "Skills", "Preferences"];

const SKILLS = [
  "python", "sql", "ml", "cloud", "frontend", "backend", "networking", "java", "excel", "analysis", "presentation", "communication", "financial_modeling", "design", "manufacturing", "pcb_design", "autocad", "cad_modelling", "surveying", "construction_management", "writing", "seo", "social_media"
];

export function ProfileSetup({ onComplete }: ProfileSetupProps) {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<ProfileData>({
    name: "",
    email: "",
    phone: "",
    education: "",
    field: "",
    skills: [],
    experience: "",
    preferences: {
      location: "",
      domain: "",
      duration: "",
    },
  });

  const progress = ((step + 1) / STEPS.length) * 100;

  const addSkill = (skill: string) => {
    if (formData.skills.length < 6 && !formData.skills.includes(skill)) {
      setFormData(prev => ({
        ...prev,
        skills: [...prev.skills, skill]
      }));
    }
  };

  const removeSkill = (skill: string) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.filter(s => s !== skill)
    }));
  };

  const handleSubmit = () => {
    console.log("Profile data:", formData);
    onComplete?.(formData);
  };

  const availableSkills = SKILLS.filter(skill => !formData.skills.includes(skill));

  return (
    <Card className="w-full max-w-2xl mx-auto" data-testid="profile-setup">
      <CardHeader>
        <div className="flex items-center justify-between mb-4">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                i <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-12 md:w-24 h-0.5 mx-2 ${i < step ? "bg-primary" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>
        <CardTitle>{STEPS[step]}</CardTitle>
        <Progress value={progress} className="h-1 mt-2" />
      </CardHeader>
      <CardContent>
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            {step === 0 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter your full name"
                    data-testid="input-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="your.email@example.com"
                    data-testid="input-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+91 9999999999"
                    data-testid="input-phone"
                  />
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="education">Highest Qualification</Label>
                  <Select
                    value={formData.education}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, education: value }))}
                  >
                    <SelectTrigger data-testid="select-education">
                      <SelectValue placeholder="Select your qualification" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Grade 10">Grade 10</SelectItem>
                      <SelectItem value="Grade 12">Grade 12</SelectItem>
                      <SelectItem value="Undergraduate">Undergraduate</SelectItem>
                      <SelectItem value="ITI">ITI</SelectItem>
                      <SelectItem value="Diploma">Diploma</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="field">Field of Study</Label>
                  <Select
                    value={formData.field}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, field: value }))}
                  >
                    <SelectTrigger data-testid="select-field">
                      <SelectValue placeholder="Select your field" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="engineering">Engineering</SelectItem>
                      <SelectItem value="science">Science</SelectItem>
                      <SelectItem value="commerce">Commerce</SelectItem>
                      <SelectItem value="arts">Arts</SelectItem>
                      <SelectItem value="medical">Medical</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="experience">Previous Experience (if any)</Label>
                  <Textarea
                    id="experience"
                    value={formData.experience}
                    onChange={(e) => setFormData(prev => ({ ...prev, experience: e.target.value }))}
                    placeholder="Describe any relevant experience..."
                    data-testid="textarea-experience"
                  />
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="space-y-2">
                  <Label>Select Skills</Label>
                  <Select
                    onValueChange={(value) => addSkill(value)}
                    disabled={formData.skills.length >= 6}
                  >
                    <SelectTrigger data-testid="select-skills">
                      <SelectValue placeholder={formData.skills.length >= 6 ? "Maximum 6 skills selected" : "Select a skill"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSkills.map((skill) => (
                        <SelectItem key={skill} value={skill}>
                          {skill}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap gap-2 min-h-[100px] p-4 bg-muted/50 rounded-lg">
                  {formData.skills.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Select your skills above</p>
                  ) : (
                    formData.skills.map((skill) => (
                      <Badge key={skill} variant="secondary" className="gap-1" data-testid={`badge-skill-${skill}`}>
                        {skill}
                        <button onClick={() => removeSkill(skill)} className="ml-1 hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  You can select up to 6 skills. Selected: {formData.skills.length}/6
                </p>
              </>
            )}

            {step === 3 && (
              <>
                <div className="space-y-2">
                  <Label>Preferred Location</Label>
                  <Select
                    value={formData.preferences.location}
                    onValueChange={(value) => setFormData(prev => ({ 
                      ...prev, 
                      preferences: { ...prev.preferences, location: value }
                    }))}
                  >
                    <SelectTrigger data-testid="select-location">
                      <SelectValue placeholder="Select preferred location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="delhi">Delhi NCR</SelectItem>
                      <SelectItem value="mumbai">Mumbai</SelectItem>
                      <SelectItem value="bangalore">Bangalore</SelectItem>
                      <SelectItem value="hyderabad">Hyderabad</SelectItem>
                      <SelectItem value="chennai">Chennai</SelectItem>
                      <SelectItem value="pune">Pune</SelectItem>
                      <SelectItem value="remote">Remote</SelectItem>
                      <SelectItem value="any">Any Location</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Preferred Domain</Label>
                  <Select
                    value={formData.preferences.domain}
                    onValueChange={(value) => setFormData(prev => ({ 
                      ...prev, 
                      preferences: { ...prev.preferences, domain: value }
                    }))}
                  >
                    <SelectTrigger data-testid="select-domain">
                      <SelectValue placeholder="Select preferred domain" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="it">IT & Software</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                      <SelectItem value="finance">Finance</SelectItem>
                      <SelectItem value="hr">Human Resources</SelectItem>
                      <SelectItem value="operations">Operations</SelectItem>
                      <SelectItem value="design">Design</SelectItem>
                      <SelectItem value="research">Research</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Preferred Duration</Label>
                  <Select
                    value={formData.preferences.duration}
                    onValueChange={(value) => setFormData(prev => ({ 
                      ...prev, 
                      preferences: { ...prev.preferences, duration: value }
                    }))}
                  >
                    <SelectTrigger data-testid="select-duration">
                      <SelectValue placeholder="Select preferred duration" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 Months</SelectItem>
                      <SelectItem value="6">6 Months</SelectItem>
                      <SelectItem value="12">12 Months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="flex justify-between mt-8">
          <Button
            variant="outline"
            onClick={() => setStep(prev => prev - 1)}
            disabled={step === 0}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep(prev => prev + 1)} data-testid="button-next">
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} data-testid="button-complete">
              Complete Profile
              <Check className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

