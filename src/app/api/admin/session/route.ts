import {
  ADMIN_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  checkPassword,
  issueToken,
} from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* 404 rather than 401 on every failure, so an unauthenticated caller cannot
   tell a wrong password from a route that does not exist. */
const NOT_FOUND = () => new Response(null, { status: 404 });

function clearCookie(response: Response): Response {
  response.headers.append(
    "set-cookie",
    `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure`,
  );
  return response;
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NOT_FOUND();
  }

  /* Sign-out works without JavaScript, so it is a form post rather than a
     fetch, and it does not need the password. */
  if (form.get("action") === "sign-out") {
    return clearCookie(new Response(null, { status: 303, headers: { location: "/" } }));
  }

  if (!checkPassword(form.get("password"))) return NOT_FOUND();

  const token = issueToken();
  if (!token) return NOT_FOUND();

  const response = new Response(null, {
    status: 303,
    headers: { location: "/admin/analytics" },
  });
  response.headers.append(
    "set-cookie",
    `${ADMIN_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}; Secure`,
  );
  return response;
}

export async function DELETE() {
  return clearCookie(new Response(null, { status: 204 }));
}
