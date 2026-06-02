import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("shimmer-dark rounded-md", className)}
      {...props}
    />
  );
}

export { Skeleton };
