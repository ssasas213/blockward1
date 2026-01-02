import React from 'react';
import { Check } from 'lucide-react';
import { cn } from "@/lib/utils";

const steps = [
  { id: 1, name: 'Select Student' },
  { id: 2, name: 'Choose Award' },
  { id: 3, name: 'Review & Issue' }
];

export default function IssueStepper({ currentStep }) {
  return (
    <div className="w-full py-6">
      <div className="flex items-center justify-between max-w-2xl mx-auto">
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center flex-1">
              <div
                className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center font-semibold transition-all",
                  currentStep > step.id
                    ? "bg-green-500 text-white"
                    : currentStep === step.id
                    ? "bg-violet-600 text-white ring-4 ring-violet-100"
                    : "bg-slate-200 text-slate-500"
                )}
              >
                {currentStep > step.id ? (
                  <Check className="h-5 w-5" />
                ) : (
                  step.id
                )}
              </div>
              <p
                className={cn(
                  "text-sm mt-2 font-medium",
                  currentStep >= step.id ? "text-slate-900" : "text-slate-400"
                )}
              >
                {step.name}
              </p>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "h-0.5 flex-1 mx-4 mt-[-20px] transition-all",
                  currentStep > step.id ? "bg-green-500" : "bg-slate-200"
                )}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}