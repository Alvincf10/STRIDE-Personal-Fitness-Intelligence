import { cn } from "@/lib/utils/cn";

type BrandLogoProps = {
  className?: string;
  /** Compact mark + wordmark for sidebar/header */
  variant?: "lockup" | "mark" | "wordmark";
};

export function BrandLogo({
  className,
  variant = "lockup",
}: BrandLogoProps) {
  if (variant === "mark") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/stride-favicon.svg"
        alt="STRIDE"
        width={40}
        height={40}
        className={cn("h-10 w-10", className)}
      />
    );
  }

  if (variant === "wordmark") {
    return (
      <span
        className={cn(
          "text-2xl font-extrabold italic tracking-tight text-[var(--accent)]",
          className
        )}
      >
        STRIDE
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/stride-navbar.svg"
      alt="STRIDE"
      width={168}
      height={38}
      className={cn("h-9 w-auto", className)}
    />
  );
}
