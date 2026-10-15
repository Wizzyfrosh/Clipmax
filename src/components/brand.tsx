import { Scissors } from "lucide-react";
import Link from "next/link";
export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link
      href="/"
      className={`brand ${light ? "light" : ""}`}
      aria-label="Clipmax home"
    >
      <span className="brand-icon">
        <Scissors size={22} />
      </span>
      clipmax<span className="brand-dot">.</span>
    </Link>
  );
}
