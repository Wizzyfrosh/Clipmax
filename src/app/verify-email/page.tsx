import { VerifyEmailForm } from "@/components/verify-email-form";
import { authConfigured } from "@/lib/config";

export const dynamic = "force-dynamic";
export default function Page() {
  return <VerifyEmailForm configured={authConfigured()} />;
}
