import { redirect } from "next/navigation";
import { user, HttpError } from "@/lib/http";
import { authConfigured } from "@/lib/config";
import { Shell } from "@/components/workspace";
import Link from "next/link";
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!authConfigured())
    return (
      <main className="setup-page">
        <h1>Your studio is almost ready.</h1>
        <p>
          Account services need to be configured before you can access private
          projects.
        </p>
        <Link href="/" className="button">
          Back to Clipmax
        </Link>
      </main>
    );
  let current;
  try {
    current = await user();
  } catch (e) {
    if (e instanceof HttpError) redirect("/sign-in");
    throw e;
  }
  return (
    <Shell
      name={current.name}
      admin={(process.env.ADMIN_EMAILS ?? "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .includes(current.email.toLowerCase())}
    >
      {children}
    </Shell>
  );
}
