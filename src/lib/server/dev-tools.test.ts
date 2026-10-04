import { describe, expect, it } from "vitest";
import { DevToolsInProductionError, devToolsEnabled } from "./dev-tools";

describe("devToolsEnabled", () => {
  it("is on in local development", () => {
    expect(devToolsEnabled({ NODE_ENV: "development" })).toBe(true);
  });

  it("is off in production and test unless explicitly requested", () => {
    expect(devToolsEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(devToolsEnabled({ NODE_ENV: "test" })).toBe(false);
    expect(devToolsEnabled({ NODE_ENV: "production", DEV_FAKE_SESSION: "1" })).toBe(false);
  });

  it("is on when DEV_FAKE_SESSION=true outside a production deployment", () => {
    expect(devToolsEnabled({ NODE_ENV: "production", DEV_FAKE_SESSION: "true" })).toBe(true);
    expect(
      devToolsEnabled({ NODE_ENV: "production", DEV_FAKE_SESSION: "true", VERCEL_ENV: "preview" }),
    ).toBe(true);
  });

  it("refuses to run on a production deployment", () => {
    expect(() =>
      devToolsEnabled({
        NODE_ENV: "production",
        DEV_FAKE_SESSION: "true",
        VERCEL_ENV: "production",
      }),
    ).toThrow(DevToolsInProductionError);
  });

  it("stays off on a production deployment when not requested", () => {
    expect(devToolsEnabled({ NODE_ENV: "production", VERCEL_ENV: "production" })).toBe(false);
  });
});
