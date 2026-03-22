import { ActivityEvent, MasteryAuditLog } from "./models.js";

export function getSessionId(request) {
  const incoming = request?.headers?.["x-session-id"];
  if (typeof incoming === "string" && incoming.trim()) return incoming.trim();
  const subject = request?.auth?.sub ? String(request.auth.sub) : "anonymous";
  return `${subject}-${Date.now()}`;
}

export async function logActivityEvent(payload) {
  try {
    return await ActivityEvent.create({
      ...payload,
      occurredAt: payload.occurredAt || new Date()
    });
  } catch (error) {
    // Logging should never block the primary request path.
    console.error("Failed to persist activity event", error.message);
    return null;
  }
}

export async function logMasteryChange(payload) {
  try {
    return await MasteryAuditLog.create({
      ...payload,
      changedAt: payload.changedAt || new Date()
    });
  } catch (error) {
    console.error("Failed to persist mastery audit", error.message);
    return null;
  }
}
