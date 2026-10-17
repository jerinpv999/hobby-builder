/* Calls to the Hobby Builder server. Cookies carry the login session, so there is no token to keep. */
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function call(method, url, body, opts = {}) {
  let res;
  try {
    res = await fetch("/api" + url, {
      method,
      credentials: "same-origin",
      headers: body !== undefined ? { "Content-Type": "application/json" } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
      keepalive: !!opts.keepalive,
    });
  } catch {
    throw new ApiError("Can't reach the server. Check your connection.", 0);
  }
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* no body */
  }
  if (!res.ok) throw new ApiError((json && json.error) || `Server error (${res.status})`, res.status);
  return json;
}

export const api = {
  me: () => call("GET", "/auth/me").then((r) => r.user),
  register: (name, email, password) => call("POST", "/auth/register", { name, email, password }).then((r) => r.user),
  login: (email, password) => call("POST", "/auth/login", { email, password }).then((r) => r.user),
  logout: () => call("POST", "/auth/logout", {}),
  list: () => call("GET", "/workspaces").then((r) => r.workspaces),
  get: (id) => call("GET", `/workspaces/${id}`).then((r) => r.workspace),
  create: (name, data) => call("POST", "/workspaces", { name, ...(data ? { data } : {}) }).then((r) => r.workspace),
  save: (id, data, opts) => call("PUT", `/workspaces/${id}`, { data }, opts).then((r) => r.workspace),
  rename: (id, name) => call("PUT", `/workspaces/${id}`, { name }).then((r) => r.workspace),
  duplicate: (id) => call("POST", `/workspaces/${id}/duplicate`, {}).then((r) => r.workspace),
  remove: (id) => call("DELETE", `/workspaces/${id}`),
};
