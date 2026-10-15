import { Dashboard } from "@/components/workspace";
import { authConfigured } from "@/lib/config";
import { user } from "@/lib/http";
export default async function Page() {
  if (!authConfigured()) return null;
  const u = await user();
  return <Dashboard name={u.name} />;
}
