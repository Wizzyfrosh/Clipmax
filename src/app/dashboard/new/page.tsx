import { NewProject } from "@/components/workspace";
import { storageConfigured } from "@/lib/config";
export const dynamic = "force-dynamic";

export default function Page() {
  return <NewProject storageReady={storageConfigured()} />;
}
