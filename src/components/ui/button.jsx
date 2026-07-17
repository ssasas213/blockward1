import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-b from-primary to-primary/90 text-primary-foreground shadow-button hover:from-primary hover:to-primary hover:-translate-y-0.5 hover:shadow-glow active:translate-y-0",
        destructive:
          "bg-gradient-to-b from-destructive to-destructive/90 text-destructive-foreground shadow-sm hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0",
        outline:
          "border border-border bg-secondary/50 text-foreground backdrop-blur-sm hover:bg-hover hover:border-primary/40 hover:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground border border-border shadow-sm hover:bg-hover hover:border-primary/30",
        ghost: "hover:bg-hover hover:text-foreground text-muted-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        success: "bg-gradient-to-b from-success to-success/90 text-success-foreground shadow-sm hover:-translate-y-0.5 hover:shadow-glow active:translate-y-0",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-11 rounded-lg px-8 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    (<Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props} />)
  );
})
Button.displayName = "Button"

export { Button, buttonVariants }