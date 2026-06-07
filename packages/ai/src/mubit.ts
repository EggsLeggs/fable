const DEFAULT_MUBIT_ENDPOINT = "https://api.mubit.ai";

interface MubitIngestItem {
  intent: "lesson" | "fact" | "trace";
  content: string;
  lesson_scope?: "global" | "session";
  metadata?: Record<string, unknown>;
}

interface MubitContextResponse {
  context?: string;
}

export class MubitClient {
  private apiKey: string;
  private base: string;

  constructor(apiKey: string, base?: string) {
    this.apiKey = apiKey;
    this.base = base ?? process.env.MUBIT_ENDPOINT ?? DEFAULT_MUBIT_ENDPOINT;
  }

  async ingest(agentId: string, items: MubitIngestItem[]): Promise<void> {
    try {
      const res = await fetch(`${this.base}/v2/control/ingest`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ agent_id: agentId, items }),
      });
      if (!res.ok) {
        console.error(`Mubit ingest error: ${res.status}`);
      }
    } catch (err) {
      console.error("Mubit ingest failed:", err);
    }
  }

  async getContext(agentId: string, query: string): Promise<string> {
    try {
      const res = await fetch(`${this.base}/v2/control/context`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ agent_id: agentId, query, budget: "mid" }),
      });
      if (!res.ok) {
        console.error(`Mubit context error: ${res.status}`);
        return "";
      }
      const data = (await res.json()) as MubitContextResponse;
      return data.context ?? "";
    } catch (err) {
      console.error("Mubit context failed:", err);
      return "";
    }
  }
}

export function createMubitClient(): MubitClient | null {
  const apiKey = process.env.MUBIT_API_KEY?.trim();
  if (!apiKey) return null;
  return new MubitClient(apiKey);
}

export function mubitAgentId(projectId: string, targetLocale: string): string {
  return `fable-mt-${projectId}-${targetLocale}`;
}
