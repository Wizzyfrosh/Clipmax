import { getAuth } from "@/lib/auth";
import { failure } from "@/lib/http";
export async function GET(req: Request) {
  try {
    return await getAuth().handler(req);
  } catch (e) {
    return failure(e);
  }
}
export const POST = GET;
