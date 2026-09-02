import * as React from "react";
import * as TogglePrimitive from "@radix-ui/react-toggle";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const toggleVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-[color,background-color,transform] duration-150 tap-press hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:pointer-events-none disabled:opacity-40 data-[state=on]:bg-accent/15 data-[state=on]:text-accent [&_svg]:size-4",
  {
    variants: {
      size: {
        default: "h-9 px-2.5",
        sm: "h-8 px-2",
        icon: "size-9",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: { size: "default" },
  },
);

export const Toggle = React.forwardRef<
  React.ComponentRef<typeof TogglePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> &
    VariantProps<typeof toggleVariants>
>(({ className, size, ...props }, ref) => (
  <TogglePrimitive.Root
    ref={ref}
    className={cn(toggleVariants({ size, className }))}
    {...props}
  />
));
Toggle.displayName = "Toggle";
