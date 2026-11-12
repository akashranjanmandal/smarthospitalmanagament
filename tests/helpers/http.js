// Helpers for calling Next.js route handlers directly.
export function jsonRequest(url, body, { method = "POST", headers = {} } = {}) {
  return new Request(`http://localhost:3000${url}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function readJson(response) {
  return { status: response.status, body: await response.json() };
}
