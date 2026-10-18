import { SettingsView } from "@/components/workspace";
import { user } from "@/lib/http";
import { authConfigured } from "@/lib/config";
export default async function Page() {
  if (!authConfigured()) return null;
  const u = await user();
  return <SettingsView email={u.email} />;
}
