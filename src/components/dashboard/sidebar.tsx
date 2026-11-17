"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { apiSend } from "@/lib/client/api";
import { BrandLogo } from "@/components/shared/brand-logo";
import { Button } from "@/components/shared/ui";
import { MobileNav } from "@/components/dashboard/mobile-nav";

const NAV = [
  { href: "/home", label: "Home" },
  { href: "/activities", label: "My Activities" },
  { href: "/performance", label: "Performance" },
  { href: "/recovery", label: "Recovery" },
  { href: "/coach", label: "Coach" },
  { href: "/goals-races", label: "Goals & Races" },
  { href: "/journey", label: "My Journey" },
  { href: "/data-quality", label: "Data Quality" },
  { href: "/settings", label: "Settings & Garmin" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await apiSend("/api/auth/logout", "POST");
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <aside className="hidden w-64 shrink-0 border-r border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-sm md:flex md:flex-col">
        <div className="px-5 py-6">
          <Link href="/home" className="block" aria-label="STRIDE home">
            <BrandLogo />
          </Link>
          <p className="mt-2 text-xs text-[var(--muted)]">
            Fitness intelligence
          </p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 pb-4" aria-label="Primary">
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "pressable rounded-[var(--radius-control)] px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "bg-[var(--accent)] text-[#07140F]"
                    : "text-[var(--muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text)]"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3">
          <Button variant="ghost" className="w-full" onClick={logout}>
            Sign out
          </Button>
        </div>
      </aside>

      <MobileNav />
    </>
  );
}
