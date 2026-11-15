/**
 * middleware.ts
 * ------------------------------------------------------------------
 * Lindungi rute admin & API tulis dari akses tanpa login.
 *
 * - /mlebu-le/dashboard            -> butuh cookie admin valid
 * - /api/memories (GET/POST)       -> butuh admin
 * - /api/memories/[id] (PUT/DELETE)-> butuh admin
 *
 * Rute publik: /, /for/[slug], /api/validate-code,
 * /api/memories/by-slug/[slug], /api/admin/login, /api/admin/logout.
 * ------------------------------------------------------------------ */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken, ADMIN_COOKIE } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Halaman dashboard butuh login.
  if (pathname === "/mlebu-le/dashboard") {
    const token = req.cookies.get(ADMIN_COOKIE)?.value;
    const user = await verifyToken(token);
    if (!user) {
      const url = req.nextUrl.clone();
      url.pathname = "/mlebu-le";
      url.searchParams.set("next", "/mlebu-le/dashboard");
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // API tulis / list (admin only). by-slug & validate-code tetap publik.
  if (
    pathname === "/api/memories" ||
    /^\/api\/memories\/[^/]+$/.test(pathname)
  ) {
    const token = req.cookies.get(ADMIN_COOKIE)?.value;
    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const res = NextResponse.next();
    res.headers.set("x-admin-user", user);
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/mlebu-le/dashboard", "/api/memories", "/api/memories/:id"],
};
