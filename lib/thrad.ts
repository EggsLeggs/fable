import { Message } from "./store";

const THRAD_API = "https://ssp.thrads.ai/api/v1/bid-request";

export type ThradBidResult = {
  headline: string;
  description: string;
  advertiser: string;
  price: number;
  ctaText: string;
  bidId: string;
} | null;

export type ThradBidAudit = {
  result: ThradBidResult;
  httpStatus: number;
  request: Record<string, unknown>;
  response: unknown;
};

export async function requestBidWithAudit(
  userId: string,
  chatId: string,
  messages: Message[]
): Promise<ThradBidAudit> {
  const request = {
    userId,
    chatId,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
      timestamp: new Date().toISOString(),
    })),
    request_type: "contextual",
    ad_formats: ["sponsored_message"],
    config: { ad_offset: 0, max_frequency: 0 },
  };

  try {
    const res = await fetch(THRAD_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "thrad-api-key": process.env.THRAD_PUBLISHER_ID!,
        "X-User-Country": "GB",
        "X-User-Device": "desktop",
        "X-User-Timezone": "Europe/London",
        "X-Forwarded-For": "1.2.3.4",
        "User-Agent": "Sentinel/1.0",
      },
      body: JSON.stringify(request),
    });
    const data = await res.json();
    if (!data?.data?.bid) {
      return { result: null, httpStatus: res.status, request, response: data };
    }
    const bid = data.data.bid;
    return {
      result: {
        headline: bid.headline,
        description: bid.description ?? "",
        advertiser: bid.advertiser,
        price: bid.price,
        ctaText: bid.cta_text ?? "Learn More",
        bidId: bid.bidId,
      },
      httpStatus: res.status,
      request,
      response: data,
    };
  } catch (err) {
    return {
      result: null,
      httpStatus: 0,
      request,
      response: { error: err instanceof Error ? err.message : String(err) },
    };
  }
}

/** @deprecated Use requestBidWithAudit for new code paths */
export async function requestBid(
  userId: string,
  chatId: string,
  messages: Message[]
): Promise<ThradBidResult> {
  const { result } = await requestBidWithAudit(userId, chatId, messages);
  return result;
}
