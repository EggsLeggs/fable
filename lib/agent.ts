import OpenAI from "openai";
import { tavily } from "@tavily/core";
import {
  flushOvermind,
  init as initOvermind,
  shutdownOvermind,
} from "./overmind";
import { requestBidWithAudit } from "./thrad";
import { addDecision, getVetoedCount } from "./decisions-db";
import { createAuditEvent } from "./decision-audit";
import { Campaign, DecisionAuditEvent, Message } from "./store";
import { v4 as uuid } from "uuid";

let openaiClient: OpenAI | null = null;
function getOpenAI() {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

let tavilyClientInstance: ReturnType<typeof tavily> | null = null;
function getTavily() {
  if (!tavilyClientInstance) tavilyClientInstance = tavily({ apiKey: process.env.TAVILY_API_KEY! });
  return tavilyClientInstance;
}

type AgentDecision = {
  decision: "bid" | "skip" | "flagged";
  reasoning: string;
  confidence: number;
  flags: string[];
  suggestedCPM: number;
};

export async function runDecisionAgent(
  campaignId: string,
  messages: Message[],
  campaign: Campaign
): Promise<void> {
  initOvermind({ serviceName: "sentinel" });
  const auditLog: DecisionAuditEvent[] = [];
  const startedAt = new Date().toISOString();

  auditLog.push(
    createAuditEvent({
      timestamp: startedAt,
      actor: "system",
      service: "sentinel",
      action: "run_started",
      summary: `Agent run started for ${campaign.advertiser}`,
      status: "success",
      details: {
        campaign: campaign.name,
        advertiser: campaign.advertiser,
        maxCPM: campaign.maxCPM,
        messageCount: messages.length,
      },
    }),
    createAuditEvent({
      timestamp: startedAt,
      actor: "system",
      service: "sentinel",
      action: "context_loaded",
      summary: `Loaded ${messages.length} conversation messages`,
      status: "success",
      details: { messages },
    })
  );

  const contextSnippet = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join(" ")
    .slice(0, 120);

  // Step 1: Tavily brand safety check
  let brandSafetyContext = "No recent brand safety issues found.";
  let detectedFlags: string[] = [];
  const safetyQuery = `${campaign.advertiser} brand safety controversy ${new Date().getFullYear()}`;

  try {
    const tavilyResult = await getTavily().search(safetyQuery, { maxResults: 3, searchDepth: "basic" });
    const results = tavilyResult.results ?? [];
    if (results.length > 0) {
      brandSafetyContext = results
        .map((r: { title: string; content: string }) => `${r.title}: ${r.content.slice(0, 200)}`)
        .join("\n");
    }
    const conversationText = messages.map((m) => m.content).join(" ").toLowerCase();
    detectedFlags = campaign.blockedTopics.filter((topic) =>
      conversationText.includes(topic.toLowerCase())
    );

    auditLog.push(
      createAuditEvent({
        actor: "agent",
        service: "tavily",
        action: "brand_safety_search",
        summary: `Tavily returned ${results.length} result(s) for brand safety`,
        status: "success",
        details: {
          query: safetyQuery,
          resultCount: results.length,
          results: results.map((r: { title: string; url?: string; content: string }) => ({
            title: r.title,
            url: r.url,
            excerpt: r.content.slice(0, 300),
          })),
          brandSafetyContext,
          detectedBlockedTopics: detectedFlags,
        },
      })
    );
  } catch (err) {
    auditLog.push(
      createAuditEvent({
        actor: "agent",
        service: "tavily",
        action: "brand_safety_search",
        summary: "Tavily search failed — continued without safety context",
        status: "warning",
        details: {
          query: safetyQuery,
          error: err instanceof Error ? err.message : String(err),
        },
      })
    );
  }

  // Step 2: Veto context
  const recentVetoCount = await getVetoedCount(campaignId);
  const vetoContext =
    recentVetoCount > 0
      ? `Human operators have vetoed ${recentVetoCount} of your previous decisions this session. Exercise more caution.`
      : "No decisions have been vetoed this session.";

  auditLog.push(
    createAuditEvent({
      actor: "system",
      service: "sentinel",
      action: "veto_context",
      summary:
        recentVetoCount > 0
          ? `${recentVetoCount} prior veto(s) in session — caution injected`
          : "No vetoes this session",
      status: recentVetoCount > 0 ? "warning" : "success",
      details: { recentVetoCount, vetoContext },
    })
  );

  // Step 3: GPT-4o reasoning (auto-traced to Overmind via @overmind-lab/trace-sdk)
  const systemPrompt = `You are Sentinel, an autonomous media buying agent for ${campaign.advertiser}.

Campaign: ${campaign.name}
Goal: ${campaign.goal}
Max CPM: $${campaign.maxCPM}
Brand keywords (positive signals): ${campaign.brandKeywords.join(", ")}
Blocked topics (auto-flag triggers): ${campaign.blockedTopics.join(", ")}

${vetoContext}

Return ONLY valid JSON:
{
  "decision": "bid" | "skip" | "flagged",
  "reasoning": "2-3 sentence explanation a human operator can understand",
  "confidence": <integer 0-100>,
  "flags": ["specific concerns, empty if none"],
  "suggestedCPM": <float, recommended bid if bidding, 0 otherwise>
}

Rules:
- "bid": high user intent, brand-safe, CPM justified. Never exceed $${campaign.maxCPM}.
- "skip": low intent or poor match — not a safety concern, just not worth bidding.
- "flagged": potential brand safety issue or blocked topic detected. Always flag, never bid.`;

  const userPrompt = `Conversation:
${messages.map((m) => `[${m.role}]: ${m.content}`).join("\n")}

Brand safety check for ${campaign.advertiser}:
${brandSafetyContext}

Detected blocked topics: ${detectedFlags.length > 0 ? detectedFlags.join(", ") : "none"}

Make your decision.`;

  let agentDecision: AgentDecision = {
    decision: "skip",
    reasoning: "Agent error — defaulted to skip.",
    confidence: 0,
    flags: [],
    suggestedCPM: 0,
  };

  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      max_tokens: 512,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    const raw = response.choices[0]?.message?.content ?? "{}";
    agentDecision = JSON.parse(raw);

    auditLog.push(
      createAuditEvent({
        actor: "agent",
        service: "openai",
        action: "reasoning",
        summary: `GPT-4o decided: ${agentDecision.decision} (${agentDecision.confidence}% confidence)`,
        status: "success",
        details: {
          model: "gpt-4o",
          tracedTo: "overmind",
          usage: response.usage,
          request: {
            systemPrompt,
            userPrompt,
          },
          rawResponse: raw,
          parsed: agentDecision,
        },
      })
    );
  } catch (err) {
    auditLog.push(
      createAuditEvent({
        actor: "agent",
        service: "openai",
        action: "reasoning",
        summary: "OpenAI call failed — defaulted to skip",
        status: "error",
        details: {
          model: "gpt-4o",
          error: err instanceof Error ? err.message : String(err),
          request: { systemPrompt, userPrompt },
        },
      })
    );
  }

  auditLog.push(
    createAuditEvent({
      actor: "system",
      service: "overmind",
      action: "trace_export",
      summary: "OpenAI spans auto-captured to Overmind (PATH B OTLP)",
      status: "success",
      details: {
        serviceName: "sentinel",
        endpoint: "https://api.overmindlab.ai/api/v1/traces",
      },
    })
  );

  // Step 4: If bidding, call Thrad
  let adReturned: {
    headline: string;
    description: string;
    advertiser: string;
    price: number;
    ctaText: string;
  } | undefined;

  if (agentDecision.decision === "bid") {
    const userId = `user_${uuid().slice(0, 8)}`;
    const chatId = `chat_${uuid().slice(0, 8)}`;
    const thradAudit = await requestBidWithAudit(userId, chatId, messages);

    if (thradAudit.result) {
      adReturned = {
        headline: thradAudit.result.headline,
        description: thradAudit.result.description,
        advertiser: thradAudit.result.advertiser,
        price: thradAudit.result.price,
        ctaText: thradAudit.result.ctaText,
      };
      auditLog.push(
        createAuditEvent({
          actor: "agent",
          service: "thrad",
          action: "bid_request",
          summary: `Thrad bid won — ${adReturned.headline}`,
          status: "success",
          details: {
            httpStatus: thradAudit.httpStatus,
            endpoint: "https://ssp.thrads.ai/api/v1/bid-request",
            request: thradAudit.request,
            response: thradAudit.response,
            ad: adReturned,
          },
        })
      );
    } else {
      auditLog.push(
        createAuditEvent({
          actor: "agent",
          service: "thrad",
          action: "bid_request",
          summary: "Thrad returned no bid",
          status: "warning",
          details: {
            httpStatus: thradAudit.httpStatus,
            request: thradAudit.request,
            response: thradAudit.response,
          },
        })
      );
    }
  } else {
    auditLog.push(
      createAuditEvent({
        actor: "system",
        service: "thrad",
        action: "bid_skipped",
        summary: `Thrad not called — decision was ${agentDecision.decision}`,
        status: "skipped",
        details: { decision: agentDecision.decision },
      })
    );
  }

  auditLog.push(
    createAuditEvent({
      actor: "system",
      service: "sentinel",
      action: "decision_recorded",
      summary: `Final decision: ${agentDecision.decision}`,
      status: "success",
      details: {
        decision: agentDecision.decision,
        reasoning: agentDecision.reasoning,
        confidence: agentDecision.confidence,
        flags: [...new Set([...detectedFlags, ...(agentDecision.flags ?? [])])],
        suggestedCPM: agentDecision.suggestedCPM,
        adReturned: adReturned ?? null,
      },
    })
  );

  await addDecision(campaignId, {
    campaignName: campaign.name,
    advertiser: campaign.advertiser,
    contextSnippet,
    fullContext: messages,
    decision: agentDecision.decision,
    reasoning: agentDecision.reasoning,
    confidence: agentDecision.confidence,
    flags: [...new Set([...detectedFlags, ...(agentDecision.flags ?? [])])],
    suggestedCPM: agentDecision.suggestedCPM,
    adReturned,
    auditLog,
  });
}

/** Run agent and guarantee trace export before the HTTP handler returns. */
export async function runDecisionAgentWithTracing(
  campaignId: string,
  messages: Message[],
  campaign: Campaign
): Promise<void> {
  try {
    await runDecisionAgent(campaignId, messages, campaign);
  } finally {
    await flushOvermind();
    await shutdownOvermind();
  }
}
