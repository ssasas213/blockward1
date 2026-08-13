import React from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const SIZES = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-lg",
  "2xl": "h-20 w-20 text-xl",
};

function getInitials(name) {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Deterministic purple/pink gradient variant so the same person always gets the same gradient.
const GRADIENTS = [
  "from-[#8B5CF6] to-[#EC4899]",
  "from-[#7C3AED] to-[#8B5CF6]",
  "from-[#9333EA] to-[#EC4899]",
  "from-[#6366F1] to-[#A855F7]",
  "from-[#A855F7] to-[#F472B6]",
];

function gradientFor(name) {
  if (!name) return GRADIENTS[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

export default function InitialsAvatar({ name, src, size = "md", className, ring = false }) {
  const sizeCls = SIZES[size] || SIZES.md;
  return (
    <Avatar className={cn(sizeCls, ring && "ring-2 ring-primary/30 ring-offset-2 ring-offset-background", className)}>
      {src ? <AvatarImage src={src} alt={name || ""} /> : null}
      <AvatarFallback
        className={cn(
          "bg-gradient-to-br text-white font-semibold tracking-wide",
          gradientFor(name),
          !src && "rounded-full"
        )}
      >
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

export { getInitials, gradientFor };