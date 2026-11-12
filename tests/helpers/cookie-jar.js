// In-memory stand-in for next/headers cookies(), so server actions see a "logged in" user.
const jar = new Map();

const cookieStore = {
  get: (name) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
  set: (name, value) => {
    if (typeof name === "object") jar.set(name.name, name.value);
    else jar.set(name, value);
  },
  delete: (name) => jar.delete(name),
  has: (name) => jar.has(name),
  getAll: () => [...jar].map(([name, value]) => ({ name, value })),
};

export const nextHeadersMock = {
  cookies: async () => cookieStore,
  headers: async () => new Headers(),
};

export function clearCookies() {
  jar.clear();
}

export function getCookie(name) {
  return jar.get(name);
}

export async function loginAs(user) {
  const { signToken } = await import("@/lib/auth/jwt");
  const token = await signToken({ userId: user.id, email: user.email, role: user.role, profileComplete: true });
  jar.set("shds-auth-token", token);
}

export function logout() {
  jar.clear();
}
