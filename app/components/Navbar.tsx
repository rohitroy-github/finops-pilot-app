"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [isSignedIn, setIsSignedIn] = useState(false);
  const brandLabel = pathname === "/agent/dashboard" ? "Agent Dashboard" : "Finops Pilot";

  const navItemClass =
    "cursor-pointer whitespace-nowrap text-xs font-semibold tracking-wide opacity-90 transition-opacity hover:opacity-100";

  useEffect(() => {
    const status = window.localStorage.getItem("finops-auth-status");
    setIsSignedIn(status === "signed-in");
  }, [pathname]);

  const handleSignOut = () => {
    window.localStorage.removeItem("finops-auth-status");
    window.localStorage.removeItem("finops-auth-username");
    setIsSignedIn(false);
    router.push("/auth/log-in");
  };

  return (
    <header className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4 sm:px-6">
      <nav className="pointer-events-auto grid min-h-12 w-full max-w-6xl grid-cols-[1fr_auto_1fr] items-center rounded-2xl border border-black/70 bg-black/90 px-4 py-3 text-white shadow-lg shadow-black/30 backdrop-blur-md sm:px-6">
        <Link
          href="/"
          className="cursor-pointer justify-self-start whitespace-nowrap text-sm font-semibold tracking-wide sm:text-base"
        >
          {brandLabel}
        </Link>

        <div className="flex items-center gap-6 justify-self-center whitespace-nowrap">
          <Link
            href="/"
            className={navItemClass}
          >
            Home
          </Link>
          <Link
            href="/usecases"
            className={navItemClass}
          >
            Usecases
          </Link>
          <Link
            href="/auth/log-in"
            className={navItemClass}
          >
            Console
          </Link>
        </div>

        <div className="justify-self-end whitespace-nowrap">
          {isSignedIn ? (
            <span
              role="button"
              tabIndex={0}
              onClick={handleSignOut}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleSignOut();
                }
              }}
              className={navItemClass}
            >
              Sign Out
            </span>
          ) : (
            <Link
              href="/auth/log-in"
              className={navItemClass}
            >
              Sign In
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
