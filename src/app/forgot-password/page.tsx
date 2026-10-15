import { AuthForm } from "@/components/auth-form";
import { authConfigured } from "@/lib/config";
export const dynamic = "force-dynamic";
export default function Page() {
  return <AuthForm mode="forgot-password" configured={authConfigured()} />;
}
