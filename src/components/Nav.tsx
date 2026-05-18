import Link from "next/link";

const links = [
  { href: "/", label: "雷达" },
  { href: "/sources", label: "信息源" },
  { href: "/logs", label: "监测日志" },
];

export function Nav() {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold text-zinc-950">
          科技选题雷达
        </Link>
        <nav className="flex items-center gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
