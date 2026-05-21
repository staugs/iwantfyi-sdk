/**
 * IwantClient -- typed TypeScript client for iwant.fyi's
 * iwant.fyi demand-side protocol v1.0 reference implementation.
 *
 * Default transport is MCP over HTTP. Set `transport: "http"` to use
 * the HTTP fallback (§9) directly instead.
 */

import type {
  CreateWantInput,
  CreateWantResponse,
  MatchResponse,
  Want,
  RecordOutcomeInput,
  RecordOutcomeResponse,
  ListVerticalsResponse,
  ListConstraintsResponse,
  HealthResponse,
} from "./types.js";
import { errorFromCode, IwantError } from "./errors.js";

export interface IwantClientOptions {
  /** API key obtained from iwant.fyi (format: iwant_ak_...) */
  apiKey: string;
  /** Base URL of the implementation. Default: https://iwant.fyi */
  baseUrl?: string;
  /** Transport: "mcp" (default, JSON-RPC over HTTP) or "http" (REST fallback per spec §9) */
  transport?: "mcp" | "http";
  /** Optional fetch implementation (e.g. for testing) */
  fetch?: typeof fetch;
  /** Request timeout in milliseconds. Default: 30000 */
  timeoutMs?: number;
}

export class IwantClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly transport: "mcp" | "http";
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private rpcId = 0;

  constructor(options: IwantClientOptions) {
    if (!options.apiKey) throw new IwantError("apiKey is required");
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? "https://iwant.fyi").replace(/\/$/, "");
    this.transport = options.transport ?? "mcp";
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 30000;
  }

  // ===== High-level methods =====

  /**
   * Create a Want and run matching. Per iwant.fyi demand-side protocol §8.1, demand.create_want.
   */
  async createWant(input: CreateWantInput): Promise<CreateWantResponse> {
    return this.invokeTool<CreateWantResponse>("demand.create_want", input as unknown as Record<string, unknown>);
  }

  /**
   * Run matching against existing supply without persisting a Want. §8.1, demand.search.
   */
  async search(input: Partial<CreateWantInput> & { title: string }): Promise<MatchResponse & { protocol_version: string }> {
    return this.invokeTool<MatchResponse & { protocol_version: string }>("demand.search", input as unknown as Record<string, unknown>);
  }

  /**
   * Retrieve a Want by ID. §8.1, demand.get_want.
   */
  async getWant(wantId: string): Promise<{ want: Want; matches?: MatchResponse | null }> {
    return this.invokeTool("demand.get_want", { want_id: wantId });
  }

  /**
   * Report an outcome event. §8.1, demand.record_outcome.
   * Required for attribution back to the originating agent.
   */
  async recordOutcome(input: RecordOutcomeInput): Promise<RecordOutcomeResponse> {
    return this.invokeTool<RecordOutcomeResponse>("demand.record_outcome", input as unknown as Record<string, unknown>);
  }

  /**
   * Discover supported verticals. §8.2, demand.list_verticals.
   */
  async listVerticals(): Promise<ListVerticalsResponse> {
    return this.invokeTool<ListVerticalsResponse>("demand.list_verticals", {});
  }

  /**
   * Discover supported constraint vocabulary. §8.2, demand.list_constraints.
   */
  async listConstraints(): Promise<ListConstraintsResponse> {
    return this.invokeTool<ListConstraintsResponse>("demand.list_constraints", {});
  }

  /**
   * Liveness check. §8.2, demand.health.
   */
  async health(): Promise<HealthResponse> {
    return this.invokeTool<HealthResponse>("demand.health", {});
  }

  // ===== Low-level escape hatch =====

  /**
   * Call any MCP tool by name. Use this for tools beyond the iwant.fyi demand-side protocol
   * surface (e.g., iwant.fyi's legacy browse_wants, search_listings, etc.).
   */
  async callTool<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    return this.invokeTool<T>(name, args);
  }

  // ===== Internals =====

  private async invokeTool<T>(name: string, args: Record<string, unknown>): Promise<T> {
    if (this.transport === "http") {
      return this.httpInvoke<T>(name, args);
    }
    return this.mcpInvoke<T>(name, args);
  }

  private async mcpInvoke<T>(method: string, args: Record<string, unknown>): Promise<T> {
    const url = `${this.baseUrl}/api/mcp`;
    const id = ++this.rpcId;
    const body = JSON.stringify({
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: { name: method, arguments: args },
    });

    const res = await this.fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body,
    });

    let parsed: { result?: { content?: Array<{ text?: string }> }; error?: { code: number; message: string; data?: unknown } };
    try {
      parsed = (await res.json()) as typeof parsed;
    } catch {
      throw new IwantError(`Invalid JSON response (status ${res.status})`);
    }

    if (parsed.error) {
      throw errorFromCode(parsed.error.code, parsed.error.message, parsed.error.data);
    }

    const text = parsed.result?.content?.[0]?.text;
    if (!text) throw new IwantError("Empty response from MCP server");

    let inner: unknown;
    try {
      inner = JSON.parse(text);
    } catch {
      throw new IwantError("Tool returned non-JSON content");
    }

    // Tools may return { error: "..." } in their payload for validation errors
    if (inner && typeof inner === "object" && "error" in inner && typeof (inner as { error: unknown }).error === "string") {
      throw errorFromCode(-32602, (inner as { error: string }).error);
    }

    return inner as T;
  }

  private async httpInvoke<T>(method: string, args: Record<string, unknown>): Promise<T> {
    const map = HTTP_ROUTE_MAP[method];
    if (!map) {
      throw new IwantError(`HTTP transport does not support tool: ${method}. Use transport: "mcp" or callTool() via MCP.`);
    }

    const url = map.path(this.baseUrl, args);
    const init: RequestInit = {
      method: map.method,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
    };
    if (map.method !== "GET") {
      init.body = JSON.stringify(map.body ? map.body(args) : args);
    }

    const res = await this.fetchWithTimeout(url, init);
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new IwantError(`HTTP ${res.status}: invalid JSON response`);
    }

    if (!res.ok) {
      const err = (body as { error?: { code: number; message: string; data?: unknown } }).error;
      if (err) throw errorFromCode(err.code, err.message, err.data);
      throw new IwantError(`HTTP ${res.status}`);
    }
    return body as T;
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchImpl(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }
}

interface HttpRouteMap {
  method: "GET" | "POST";
  path: (baseUrl: string, args: Record<string, unknown>) => string;
  body?: (args: Record<string, unknown>) => Record<string, unknown>;
}

const HTTP_ROUTE_MAP: Record<string, HttpRouteMap> = {
  "demand.create_want": {
    method: "POST",
    path: (b) => `${b}/api/v1/wants`,
  },
  "demand.search": {
    method: "POST",
    path: (b) => `${b}/api/v1/search`,
  },
  "demand.get_want": {
    method: "GET",
    path: (b, args) => `${b}/api/v1/wants/${encodeURIComponent(String(args.want_id))}`,
  },
  "demand.record_outcome": {
    method: "POST",
    path: (b) => `${b}/api/v1/outcomes`,
  },
  "demand.list_verticals": {
    method: "GET",
    path: (b) => `${b}/api/v1/verticals`,
  },
  "demand.list_constraints": {
    method: "GET",
    path: (b) => `${b}/api/v1/constraints`,
  },
  "demand.health": {
    method: "GET",
    path: (b) => `${b}/api/v1/health`,
  },
};
