"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Home, Key, LineChart, LayoutGrid, Building2, LogOut, Menu, CalendarDays, Plus } from "lucide-react";
import { Logo } from "@/components/logo";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { DashboardSession } from "@/lib/dashboard/session";

export function DashboardHeader({ session }: { session: DashboardSession }) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const canViewProperties =
    session.permissions.includes("view_properties") || session.permissions.includes("manage_properties");
  const canViewBookingRegister = session.permissions.includes("manage_booking_register");

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-border bg-card">
      <div className="site-container flex h-16 items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Mobile Navigation Drawer */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden h-9 w-9 rounded-xl" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] p-0 flex flex-col justify-between">
              <div>
                <SheetHeader className="p-5 border-b border-border text-left">
                  <SheetTitle>
                    <Logo variant="dark" />
                  </SheetTitle>
                </SheetHeader>
                <div className="p-3">
                  <div className="mb-3 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-500/20">
                    <p className="text-xs font-bold text-emerald-900 dark:text-emerald-300">{session.username}</p>
                    <p className="text-[11px] text-muted-foreground">{session.roleLabel}</p>
                  </div>
                  <nav className="flex flex-col gap-1">
                    <Link
                      href="/"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-foreground/90 hover:bg-muted"
                    >
                      <Home className="h-4 w-4 text-emerald-800 dark:text-emerald-400" /> Home
                    </Link>
                    {canViewProperties && (
                      <Link
                        href="/dashboard/properties"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-foreground/90 hover:bg-muted"
                      >
                        <Building2 className="h-4 w-4 text-emerald-800 dark:text-emerald-400" /> Properties
                      </Link>
                    )}
                    {canViewBookingRegister && <Link href="/dashboard/bookings" onClick={() => setMobileOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-muted">Bookings & Settlements</Link>}
                    <Link
                      href={`/dashboard/${session.roleSlug}`}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-foreground/90 hover:bg-muted"
                    >
                      <LayoutGrid className="h-4 w-4 text-emerald-800 dark:text-emerald-400" /> Workspace
                    </Link>
                    {session.role === "super_admin" && (
                      <Link
                        href="/dashboard"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-foreground/90 hover:bg-muted"
                      >
                        <LayoutGrid className="h-4 w-4 text-emerald-800 dark:text-emerald-400" /> Platform Overview
                      </Link>
                    )}
                    <Link
                      href="/property-management"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-foreground/90 hover:bg-muted"
                    >
                      <Key className="h-4 w-4 text-emerald-800 dark:text-emerald-400" /> Owner Program
                    </Link>
                    <Link
                      href="/investor-program"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-foreground/90 hover:bg-muted"
                    >
                      <LineChart className="h-4 w-4 text-emerald-800 dark:text-emerald-400" /> Investor Program
                    </Link>
                  </nav>
                </div>
              </div>

              <div className="p-4 border-t border-border bg-card">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="w-full rounded-xl text-destructive hover:bg-destructive/10 border-destructive/30"
                >
                  <LogOut className="h-4 w-4 mr-2" /> Logout
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          <Link href="/">
            <Logo />
          </Link>
        </div>

        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          <Link href="/" className="flex items-center gap-1.5 hover:text-primary">
            <Home className="h-3.5 w-3.5" /> Home
          </Link>
          {canViewProperties && (
            <Link href="/dashboard/properties" className="flex items-center gap-1.5 hover:text-primary">
              <Building2 className="h-3.5 w-3.5" /> Properties
            </Link>
          )}
          <Link href="/property-management" className="flex items-center gap-1.5 hover:text-primary">
            <Key className="h-3.5 w-3.5" /> Owner Program
          </Link>
          <Link href="/investor-program" className="flex items-center gap-1.5 hover:text-primary">
            <LineChart className="h-3.5 w-3.5" /> Investor Program
          </Link>
          {session.role === "super_admin" || session.role === "tech_admin" ? (
            <>
              <Link href="/dashboard" className="flex items-center gap-1.5 hover:text-primary">
                <LayoutGrid className="h-3.5 w-3.5" /> Overview
              </Link>
              <Link href={`/dashboard/${session.roleSlug}`} className="flex items-center gap-1.5 hover:text-primary">
                <LayoutGrid className="h-3.5 w-3.5" /> Workspace
              </Link>
            </>
          ) : (
            <Link href={`/dashboard/${session.roleSlug}`} className="flex items-center gap-1.5 text-primary">
              <LayoutGrid className="h-3.5 w-3.5" /> Dashboard
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3">
          <span className="hidden text-xs font-medium text-muted-foreground sm:block">{session.roleLabel}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-muted-foreground hover:text-destructive"
          >
            <LogOut className="h-3.5 w-3.5" /> Logout
          </button>
        </div>
      </div>
      {canViewBookingRegister && (
        <div className="border-t border-border bg-muted/30">
          <nav aria-label="Booking shortcuts" className="site-container flex flex-wrap items-center gap-3 py-3">
            <Button asChild variant="blue-accent" className="rounded-md">
              <Link href="/dashboard/bookings">
                <CalendarDays className="h-4 w-4" />
                Bookings & Settlements
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-md">
              <Link href="/dashboard/bookings/new">
                <Plus className="h-4 w-4" />
                Add booking
              </Link>
            </Button>
            <span className="hidden text-xs text-muted-foreground lg:block">Guest details, charges and payment tracking</span>
          </nav>
        </div>
      )}
    </header>
  );
}
