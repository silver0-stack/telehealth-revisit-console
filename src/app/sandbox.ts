import { cookies } from "next/headers";
import { z } from "zod";

// Each visitor of the public demo works in their own sandbox, named by a random id in a cookie (D33).
// Pages only read it. A visitor without the cookie sees an empty sandbox (the starting state); the
// cookie is created by the first server action that writes something.
const SANDBOX_COOKIE = "demo-sandbox";
const SandboxIdSchema = z.uuid();

// Reads for a visitor who has not written anything yet. Never used for a write (see writableSandbox).
const EMPTY_SANDBOX = "empty";

export async function readSandbox(): Promise<string> {
  const parsed = SandboxIdSchema.safeParse((await cookies()).get(SANDBOX_COOKIE)?.value);
  return parsed.success ? parsed.data : EMPTY_SANDBOX;
}

/** Server actions only: the visitor's sandbox, created on their first write. */
export async function writableSandbox(): Promise<string> {
  const current = await readSandbox();
  return current === EMPTY_SANDBOX ? startNewSandbox() : current;
}

/** Server actions only: moves the visitor to a new, empty sandbox. Nothing is deleted. */
export async function startNewSandbox(): Promise<string> {
  const id = crypto.randomUUID();
  (await cookies()).set(SANDBOX_COOKIE, id, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
  });
  return id;
}
