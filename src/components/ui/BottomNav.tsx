"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function BottomNav({ church }: { church: string }) {
  const pathname = usePathname();
  const items = [
    { href: `/${church}/attendance`, label: "Attendance" },
    { href: `/${church}/newcomers`, label: "Newcomers" },
  ];

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid h-[61px] max-w-[430px] grid-cols-2">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href} className="flex">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex flex-1 items-center justify-center text-[13px] font-medium focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-primary ${
                  active ? "text-primary" : "text-muted"
                }`}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute top-2.5 h-[3px] w-6 rounded-full bg-primary"
                  />
                )}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
