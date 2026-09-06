'use client';

import { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin, Users, Calendar, Wallet, ArrowRight, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface IntakeData {
  origin: string;
  destination: string;
  travelers: string;
  duration: string;
  budgetStyle: string;
}

interface IntakeWizardProps {
  onComplete: (data: IntakeData) => void;
}

export function IntakeWizard({ onComplete }: IntakeWizardProps) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<IntakeData>({
    origin: '',
    destination: '',
    travelers: '',
    duration: '',
    budgetStyle: '',
  });

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
    else onComplete(data);
  };

  const isStepValid = () => {
    if (step === 1) return data.origin.trim() !== '' && data.destination.trim() !== '';
    if (step === 2) return data.travelers.trim() !== '' && data.duration.trim() !== '';
    if (step === 3) return data.budgetStyle !== '';
    return false;
  };

  return (
    <Card className="w-full max-w-md mx-auto shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500 border-primary/20">
      <CardHeader className="bg-muted/30 border-b pb-4">
        <div className="flex items-center justify-between mb-2">
          <CardTitle className="text-lg text-primary flex items-center gap-2">
            Let's plan your trip
          </CardTitle>
          <span className="text-xs font-medium text-muted-foreground bg-background px-2 py-1 rounded-full border">
            Step {step} of 3
          </span>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-500 ease-in-out" 
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>
      </CardHeader>
      
      <CardContent className="pt-6 pb-2 min-h-[220px] flex flex-col justify-center">
        {step === 1 && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                Starting from which city?
              </label>
              <Input 
                autoFocus
                placeholder="e.g. New York, London, Tokyo..." 
                value={data.origin}
                onChange={(e) => setData({ ...data, origin: e.target.value })}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                Where to go?
              </label>
              <Input 
                placeholder="e.g. Paris, Bali, Kyoto..." 
                value={data.destination}
                onChange={(e) => setData({ ...data, destination: e.target.value })}
                className="h-11"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                How many persons are coming with you?
              </label>
              <Input 
                autoFocus
                type="number"
                min="1"
                placeholder="e.g. 2" 
                value={data.travelers}
                onChange={(e) => setData({ ...data, travelers: e.target.value })}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                How many days trip?
              </label>
              <Input 
                type="number"
                min="1"
                placeholder="e.g. 7" 
                value={data.duration}
                onChange={(e) => setData({ ...data, duration: e.target.value })}
                className="h-11"
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div className="space-y-3">
              <label className="text-sm font-medium flex items-center gap-2 mb-2">
                <Wallet className="w-4 h-4 text-primary" />
                How should the trip be?
              </label>
              <div className="grid gap-3">
                {['Luxury', 'Medium', 'Budget Friendly'].map((style) => (
                  <Button
                    key={style}
                    variant={data.budgetStyle === style ? 'default' : 'outline'}
                    className={cn(
                      "h-12 justify-start font-medium transition-all duration-200",
                      data.budgetStyle === style ? "shadow-md" : "hover:border-primary/50"
                    )}
                    onClick={() => setData({ ...data, budgetStyle: style })}
                  >
                    <div className="flex items-center w-full">
                      {style}
                      {data.budgetStyle === style && (
                        <CheckCircle2 className="w-4 h-4 ml-auto" />
                      )}
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-2 pb-6 border-t bg-muted/10 mt-4 flex justify-between">
        {step > 1 ? (
          <Button variant="ghost" onClick={() => setStep(step - 1)}>
            Back
          </Button>
        ) : (
          <div /> // Spacer
        )}
        <Button 
          onClick={handleNext} 
          disabled={!isStepValid()}
          className="min-w-[120px] shadow-sm"
        >
          {step === 3 ? 'Start Planning' : 'Next'}
          {step < 3 && <ArrowRight className="w-4 h-4 ml-2" />}
        </Button>
      </CardFooter>
    </Card>
  );
}
