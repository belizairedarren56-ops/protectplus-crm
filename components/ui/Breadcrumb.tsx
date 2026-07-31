import Link from "next/link";
import { Fragment } from "react";

type Crumb = { label: string; href?: string };

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav className="flex items-center gap-2 text-sm text-gray-500">
      {items.map((item, index) => (
        <Fragment key={item.label}>
          {index > 0 && <span className="text-gray-700">/</span>}

          {item.href ? (
            <Link href={item.href} className="transition hover:text-yellow-400">
              {item.label}
            </Link>
          ) : (
            <span className="text-gray-300">{item.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
