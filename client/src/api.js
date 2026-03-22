const AUTH_TOKEN_KEY = "eb_lms_token";
const RAW_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

function normalizeApiBaseUrl(value) {
  if (!value) return "";
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

const API_BASE_URL = normalizeApiBaseUrl(RAW_API_BASE_URL);

function buildApiUrl(path) {
  if (!API_BASE_URL) {
    return path;
  }

  if (/^https?:\/\//.test(path)) {
    return path;
  }

  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function getToken() {
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

function buildHeaders(extraHeaders = {}) {
  const token = getToken();

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders
  };
}

async function parseResponse(response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || `Request failed: ${response.status}`);
  }

  return payload;
}

export function setAuthToken(token) {
  if (token) {
    window.localStorage.setItem(AUTH_TOKEN_KEY, token);
    return;
  }

  window.localStorage.removeItem(AUTH_TOKEN_KEY);
}

export async function fetchJson(path, options = {}) {
  const response = await fetch(buildApiUrl(path), {
    ...options,
    headers: buildHeaders(options.headers)
  });

  return parseResponse(response);
}

export async function postJson(path, body) {
  const response = await fetch(buildApiUrl(path), {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(body)
  });

  return parseResponse(response);
}

export function getSessionId() {
  const key = "eb_session_id";
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const generated = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.sessionStorage.setItem(key, generated);
  return generated;
}

export async function logEvent(eventType, context = {}) {
  return postJson("/api/events", { eventType, context });
}

export async function fetchSkillTimeline(skillId) {
  return fetchJson(`/api/student/skills/timeline?skillId=${encodeURIComponent(skillId)}`);
}

export async function fetchNextSkill(skillId) {
  return fetchJson(`/api/student/skills/next?skillId=${encodeURIComponent(skillId)}`);
}

export async function fetchPrerequisiteDiagnostics(skillId) {
  return fetchJson(`/api/student/skills/prerequisites?skillId=${encodeURIComponent(skillId)}`);
}
