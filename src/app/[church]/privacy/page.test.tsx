import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/server/request-context";
import PrivacyPage, { generateMetadata } from "./page";

// A plain request with no cookies, on a host that is not a church subdomain.
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "faithflow.app" }),
  cookies: async () => ({ get: () => undefined }),
}));

// Any redirect or 404 ends the render, as it would in Next.js.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`redirect to ${to}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("not found");
  }),
}));

// Nobody is signed in. The page must not ask; a page that did would redirect to sign-in.
vi.mock("@/lib/server/request-context", () => ({
  getSession: vi.fn(async () => null),
  getNow: vi.fn(async () => new Date()),
}));

const props = (church: string) => ({
  params: Promise.resolve({ church }),
  searchParams: Promise.resolve({}),
});

// Production, where every app page requires a real session.
beforeEach(() => {
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("ROOT_DOMAIN", "faithflow.app");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("privacy page", () => {
  it("renders without a session", async () => {
    const html = renderToStaticMarkup(await PrivacyPage(props("newbreed")));

    expect(redirect).not.toHaveBeenCalled();
    expect(getSession).not.toHaveBeenCalled();
    expect(html).toContain("The NewBreed Church");
    expect(html).toContain("GB Tech");
    expect(html).toContain("Google Sheets");
    expect(html).toContain("replying STOP");
    expect(html).toContain("Last updated November 16, 2026");
    expect(html).toContain('href="/newbreed/sign-in"');
  });

  it("shows the church's configured contact email", async () => {
    const html = renderToStaticMarkup(await PrivacyPage(props("newbreed")));
    const { privacyContactEmail } = (await import("@/lib/config")).getChurchConfig("newbreed");
    expect(html).toContain(`mailto:${privacyContactEmail}`);
  });

  it("titles the page for the church", async () => {
    expect(await generateMetadata(props("newbreed"))).toEqual({
      title: "Privacy · The NewBreed Church",
    });
  });

  it("answers 404 for an unknown church", async () => {
    await expect(PrivacyPage(props("nosuchchurch"))).rejects.toThrow("not found");
    expect(notFound).toHaveBeenCalledOnce();
  });
});
