import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const runEscalationBatch = vi.hoisted(() => vi.fn(async () => ({ success: true, escalated: 0 })));
vi.mock("@/actions/feedback", () => ({ runEscalationBatch }));

const { GET } = await import("@/app/api/cron/escalate/route");

const call = (auth) =>
  GET(new Request("http://localhost:3000/api/cron/escalate", { headers: auth ? { authorization: auth } : {} }));

describe("GET /api/cron/escalate", () => {
  beforeEach(() => runEscalationBatch.mockClear());
  afterEach(() => vi.unstubAllEnvs());

  it("runs the escalation batch with the right secret", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    const res = await call("Bearer s3cret");
    expect(res.status).toBe(200);
    expect(runEscalationBatch).toHaveBeenCalledOnce();
  });

  it("rejects a wrong secret", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect((await call("Bearer nope")).status).toBe(401);
    expect(runEscalationBatch).not.toHaveBeenCalled();
  });

  it("rejects every call when no CRON_SECRET is configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await call()).status).toBe(401);
    expect((await call("Bearer ")).status).toBe(401);
    expect(runEscalationBatch).not.toHaveBeenCalled();
  });
});
