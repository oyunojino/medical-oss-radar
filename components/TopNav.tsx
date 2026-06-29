"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "대시보드 보기" },
  { href: "/sbom", label: "SBOM 보기" },
  { href: "/vulnerabilities", label: "취약점 스캔 보기" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-1 px-6 py-3">
        <span className="mr-2 font-mono text-xs tracking-tagcode text-vital">
          MEDREG
        </span>
        {LINKS.map((link) => {
          const active = isActive(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-md px-3 py-1.5 font-mono text-xs transition-colors ${
                active
                  ? "bg-vital-soft text-vital"
                  : "text-muted hover:bg-panel hover:text-ink"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
