/**
 * Unit tests for IwantClient using mocked fetch.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { IwantClient } from "../client";
import {
  IwantError,
  UnauthorizedError,
  ValidationError,
} from "../errors";

type MockResponseInit = {
  ok?: boolean;
  status?: number;
  body: unknown;
};

function mockResponse(init: MockResponseInit): Response {
  const status = init.status ?? (init.ok === false ? 400 : 200);
  return new Response(JSON.stringify(init.body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function mcpResult(payload: unknown) {
  return {
    jsonrpc: "2.0",
    id: 1,
    result: { content: [{ type: "text", text: JSON.stringify(payload) }] },
  };
}

function mcpError(code: number, message: string) {
  return {
    jsonrpc: "2.0",
    id: 1,
    error: { code, message },
  };
}

describe("IwantClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let client: IwantClient;

  beforeEach(() => {
    fetchMock = vi.fn();
    client = new IwantClient({
      apiKey: "iwant_ak_testkey",
      baseUrl: "https://iwant.fyi",
      fetch: fetchMock as unknown as typeof fetch,
    });
  });

  describe("construction", () => {
    it("requires an apiKey", () => {
      expect(
        () => new IwantClient({ apiKey: "" } as unknown as { apiKey: string })
      ).toThrow(IwantError);
    });

    it("trims trailing slash on baseUrl", () => {
      const c = new IwantClient({
        apiKey: "k",
        baseUrl: "https://example.com/",
        fetch: fetchMock as unknown as typeof fetch,
      });
      // We can only verify indirectly: capture the URL on a call
      fetchMock.mockResolvedValue(mockResponse({ body: mcpResult({ status: "ok" }) }));
      void c.health();
      expect(fetchMock).toHaveBeenCalled();
      const url = String(fetchMock.mock.calls[0][0]);
      expect(url).toBe("https://example.com/api/mcp");
    });
  });

  describe("MCP transport", () => {
    it("createWant sends JSON-RPC with bearer auth", async () => {
      fetchMock.mockResolvedValue(
        mockResponse({
          body: mcpResult({
            protocol_version: "1.0",
            want: { id: "w1", title: "x", price_cents: 100, price_currency: "USD" },
            matches: { matches: [], match_count: 0 },
          }),
        })
      );

      const r = await client.createWant({
        title: "torque wrench",
        price_cents: 15000,
      });

      expect(r.want.id).toBe("w1");
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe("https://iwant.fyi/api/mcp");
      const initObj = init as RequestInit;
      const headers = initObj.headers as Record<string, string>;
      expect(headers.authorization).toBe("Bearer iwant_ak_testkey");
      const body = JSON.parse(String(initObj.body));
      expect(body.method).toBe("tools/call");
      expect(body.params.name).toBe("demand.create_want");
      expect(body.params.arguments.title).toBe("torque wrench");
    });

    it("raises UnauthorizedError on JSON-RPC -32000", async () => {
      fetchMock.mockResolvedValue(mockResponse({ body: mcpError(-32000, "no key") }));
      await expect(client.createWant({ title: "x", price_cents: 1 })).rejects.toBeInstanceOf(
        UnauthorizedError
      );
    });

    it("raises ValidationError when tool returns inner error string", async () => {
      fetchMock.mockResolvedValue(
        mockResponse({ body: mcpResult({ error: "price_cents must be at least 500" }) })
      );
      await expect(client.createWant({ title: "x", price_cents: 100 })).rejects.toBeInstanceOf(
        ValidationError
      );
    });

    it("recordOutcome returns the received flag", async () => {
      fetchMock.mockResolvedValue(
        mockResponse({ body: mcpResult({ received: true, outcome_id: "o1" }) })
      );
      const r = await client.recordOutcome({
        want_id: "w1",
        match_id: "m1",
        event: "viewed",
      });
      expect(r.received).toBe(true);
      expect(r.outcome_id).toBe("o1");
    });

    it("listVerticals returns the verticals array", async () => {
      fetchMock.mockResolvedValue(
        mockResponse({
          body: mcpResult({
            protocol_version: "1.0",
            verticals: [
              { id: "tools", display_name: "Tools", description: "", supported_spec_keys: [] },
            ],
          }),
        })
      );
      const r = await client.listVerticals();
      expect(r.verticals).toHaveLength(1);
      expect(r.verticals[0].id).toBe("tools");
    });

    it("low-level callTool works for non-demand tools", async () => {
      fetchMock.mockResolvedValue(
        mockResponse({ body: mcpResult({ wants: [], total: 0, page: 1, totalPages: 0 }) })
      );
      const r = await client.callTool<{ total: number }>("browse_wants", { page: 1 });
      expect(r.total).toBe(0);
      const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
      expect(body.params.name).toBe("browse_wants");
    });
  });

  describe("HTTP transport", () => {
    let httpClient: IwantClient;

    beforeEach(() => {
      httpClient = new IwantClient({
        apiKey: "iwant_ak_testkey",
        baseUrl: "https://iwant.fyi",
        transport: "http",
        fetch: fetchMock as unknown as typeof fetch,
      });
    });

    it("createWant hits POST /api/v1/wants", async () => {
      fetchMock.mockResolvedValue(
        mockResponse({
          status: 201,
          body: {
            protocol_version: "1.0",
            want: { id: "w1", title: "x", price_cents: 100, price_currency: "USD" },
            matches: { matches: [], match_count: 0 },
          },
        })
      );
      const r = await httpClient.createWant({ title: "torque wrench", price_cents: 15000 });
      expect(r.want.id).toBe("w1");
      const url = String(fetchMock.mock.calls[0][0]);
      expect(url).toBe("https://iwant.fyi/api/v1/wants");
    });

    it("getWant hits GET /api/v1/wants/{id}", async () => {
      fetchMock.mockResolvedValue(
        mockResponse({ body: { want: { id: "w1", title: "x", price_cents: 100, price_currency: "USD" } } })
      );
      await httpClient.getWant("w1");
      const url = String(fetchMock.mock.calls[0][0]);
      expect(url).toBe("https://iwant.fyi/api/v1/wants/w1");
      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(init.method).toBe("GET");
    });

    it("health hits GET /api/v1/health", async () => {
      fetchMock.mockResolvedValue(
        mockResponse({
          body: {
            protocol_version: "1.0",
            server: "ref",
            version: "0.21",
            status: "healthy",
          },
        })
      );
      const r = await httpClient.health();
      expect(r.status).toBe("healthy");
      expect(String(fetchMock.mock.calls[0][0])).toBe("https://iwant.fyi/api/v1/health");
    });

    it("rejects unsupported tools on HTTP transport", async () => {
      await expect(httpClient.callTool("browse_wants")).rejects.toThrow(/HTTP transport/);
    });
  });
});
