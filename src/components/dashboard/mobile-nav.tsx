"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { apiSend } from "@/lib/client/api";
import { BrandLogo } from "@/components/shared/brand-logo";
import { Button } from "@/components/shared/ui";

const PRIMARY = [
  { href: "/home", label: "Home", short: "Home" },
  { href: "/activities", label: "My Activities", short: "Runs" },
  { href: "/coach", label: "Coach", short: "Coach" },
  { href: "/journey", label: "My Journey", short: "Journey" },
] as const;

const MORE = [
  { href: "/performance", label: "Performance" },
  { href: "/recovery", label: "Recovery" },
  { href: "/goals-races", label: "Goals & Races" },
  { href: "/data-quality", label: "Data Quality" },
  { href: "/settings", label: "Settings & Garmin" },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const titleId = useId();
  const moreActive = MORE.some((item) => isActive(pathname, item.href));

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [moreOpen]);

  async function logout() {
    await apiSend("/api/auth/logout", "POST");
    setMoreOpen(false);
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface)]/92 backdrop-blur-md md:hidden">
        <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <Link href="/home" aria-label="STRIDE home" className="min-h-11 min-w-11">
            <BrandLogo variant="mark" className="h-9 w-9" />
          </Link>
          <p className="text-sm font-semibold tracking-tight text-[var(--text)]">
            STRIDE
          </p>
          <button
            type="button"
            className="pressable min-h-11 min-w-11 rounded-[var(--radius-control)] border border-[var(--border)] text-xs font-semibold text-[var(--muted)]"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
          >
            More
          </button>
        </div>
      </header>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-md md:hidden"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
        aria-label="Primary"
      >
        <div className="grid grid-cols-5 gap-1 px-2 pt-2">
          {PRIMARY.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "pressable flex min-h-12 flex-col items-center justify-center rounded-[var(--radius-control)] px-1 text-[11px] font-semibold leading-tight",
                  active
                    ? "bg-[var(--accent)] text-[#07140F]"
                    : "text-[var(--muted)]"
                )}
              >
                <span>{item.short}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "pressable flex min-h-12 flex-col items-center justify-center rounded-[var(--radius-control)] px-1 text-[11px] font-semibold leading-tight",
              moreActive || moreOpen
                ? "bg-[var(--accent)] text-[#07140F]"
                : "text-[var(--muted)]"
            )}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
          >
            More
          </button>
        </div>
      </nav>

      {moreOpen ? (
        <div className="fixed inset-0 z-40 md:hidden" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-black/55"
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-[1.5rem] border border-[var(--border)] bg-[var(--surface)] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl"
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-[var(--border)]" />
            <h2 id={titleId} className="text-lg font-bold tracking-tight">
              More
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Performance, recovery, goals, and Garmin settings.
            </p>
            <ul className="mt-4 space-y-2">
              {MORE.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "pressable flex min-h-12 items-center rounded-[var(--radius-control)] px-4 text-sm font-semibold",
                        active
                          ? "bg-[var(--accent)] text-[#07140F]"
                          : "bg-[var(--surface-raised)] text-[var(--text)]"
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4">
              <Button variant="ghost" className="w-full" onClick={logout}>
                Sign out
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
