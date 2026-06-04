import { v4 as uuid } from "uuid";
import type { Decision, DecisionAuditEvent } from "@/lib/store";

export function createAuditEvent(
  partial: Omit<DecisionAuditEvent, "id" | "timestamp"> & { timestamp?: string }
): DecisionAuditEvent {
  return {
    id: uuid(),
    timestamp: partial.timestamp ?? new Date().toISOString(),
    actor: partial.actor,
    service: partial.service,
    action: partial.action,
    summary: partial.summary,
    status: partial.status,
    details: partial.details,
  };
}

/** Reconstruct a timeline from stored fields when auditLog is empty (older decisions). */
export function buildLegacyAuditLog(decision: Decision): DecisionAuditEvent[] {
  const t = decision.timestamp;
  const events: DecisionAuditEvent[] = [
    createAuditEvent({
      timestamp: t,
      actor: "system",
      service: "sentinel",
      action: "decision_recorded",
      summary: `Recorded ${decision.decision} decision`,
      status: "success",
      details: {
        decision: decision.decision,
        confidence: decision.confidence,
        suggestedCPM: decision.suggestedCPM,
        flags: decision.flags,
      },
    }),
    createAuditEvent({
      timestamp: t,
      actor: "agent",
      service: "openai",
      action: "reasoning",
      summary: "GPT-4o structured decision (details not captured for this run)",
      status: "success",
      details: { reasoning: decision.reasoning, model: "gpt-4o" },
    }),
  ];

  if (decision.adReturned) {
    events.unshift(
      createAuditEvent({
        timestamp: t,
        actor: "agent",
        service: "thrad",
        action: "bid_request",
        summary: `Thrad returned ad: ${decision.adReturned.headline}`,
        status: "success",
        details: { response: decision.adReturned },
      })
    );
  }

  if (decision.humanAction && decision.humanTimestamp) {
    events.push(
      createAuditEvent({
        timestamp: decision.humanTimestamp,
        actor: "operator",
        service: "sentinel",
        action: "human_review",
        summary: `Operator ${decision.humanAction} this decision`,
        status: decision.humanAction === "vetoed" ? "warning" : "success",
        details: { action: decision.humanAction, note: decision.humanNote },
      })
    );
  }

  events.unshift(
    createAuditEvent({
      timestamp: t,
      actor: "system",
      service: "sentinel",
      action: "context_loaded",
      summary: "Conversation context received",
      status: "success",
      details: { messages: decision.fullContext },
    })
  );

  return events.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

export function getDecisionTimeline(decision: Decision): DecisionAuditEvent[] {
  const log = decision.auditLog?.length ? decision.auditLog : buildLegacyAuditLog(decision);
  return [...log].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return sec <= 1 ? "just now" : `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}
