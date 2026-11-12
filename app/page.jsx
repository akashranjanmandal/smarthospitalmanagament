import { redirect } from "next/navigation";
import { getAuthPayload } from "@/lib/auth/jwt";

// No public landing page: the site opens at sign-in (proxy.js does this first; this is the fallback).
export default async function Home() {
  redirect((await getAuthPayload()) ? "/dashboard" : "/sign-in");
}
