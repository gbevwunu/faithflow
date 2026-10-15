import { describe, expect, it } from "vitest";
import { churchSlugFromHost } from "./host";

const ROOT = "faithflow.app";

describe("churchSlugFromHost", () => {
  it.each([
    ["newbreed.faithflow.app", "newbreed"],
    ["newbreed.faithflow.app:443", "newbreed"],
    ["grace-chapel.faithflow.app", "grace-chapel"],
    ["church2.faithflow.app", "church2"],
    ["NewBreed.FaithFlow.App", "newbreed"],
    ["newbreed.faithflow.app.", "newbreed"],
    ["newbreed.faithflow.app.:8080", "newbreed"],
    ["  newbreed.faithflow.app  ", "newbreed"],
    ["newbreed.localhost:3000", "newbreed"],
    ["newbreed.localhost", "newbreed"],
    ["NEWBREED.LOCALHOST:3000", "newbreed"],
  ])("resolves %j to %j", (host, slug) => {
    expect(churchSlugFromHost(host, ROOT)).toBe(slug);
  });

  it.each([
    ["the bare root domain", "faithflow.app"],
    ["the bare root domain with a port", "faithflow.app:3000"],
    ["the bare root domain with a trailing dot", "faithflow.app."],
    ["bare localhost", "localhost:3000"],
    ["www", "www.faithflow.app"],
    ["app", "app.faithflow.app"],
    ["admin", "admin.faithflow.app"],
    ["api", "api.faithflow.app"],
    ["reserved on localhost", "admin.localhost:3000"],
    ["a nested subdomain", "a.newbreed.faithflow.app"],
    ["an underscore", "new_breed.faithflow.app"],
    ["a leading hyphen", "-newbreed.faithflow.app"],
    ["a trailing hyphen", "newbreed-.faithflow.app"],
    ["an empty label", ".faithflow.app"],
    ["a 64-character label", `${"a".repeat(64)}.faithflow.app`],
  ])("returns null for %s", (_label, host) => {
    expect(churchSlugFromHost(host, ROOT)).toBeNull();
  });

  it.each([
    ["another domain", "newbreed.evil.com"],
    ["a lookalike domain", "newbreed.faithflow.app.evil.com"],
    ["a suffix without a dot", "newbreedfaithflow.app"],
    ["the root inside a label", "newbreed-faithflow.app"],
    ["a Vercel preview host", "faithflow-git-main-team.vercel.app"],
    ["an IP address", "127.0.0.1:3000"],
    ["an IPv6 address", "[::1]:3000"],
    ["userinfo", "evil.com@newbreed.faithflow.app"],
    ["a path", "newbreed.faithflow.app/attendance"],
    ["a non-numeric port", "newbreed.faithflow.app:abc"],
    ["two ports", "newbreed.faithflow.app:80:80"],
    ["a too-long port", "newbreed.faithflow.app:123456"],
    ["a space inside", "new breed.faithflow.app"],
    ["a double dot", "newbreed..faithflow.app"],
    ["non-ASCII characters", "nëwbreed.faithflow.app"],
    ["a punycode lookalike root", "newbreed.xn--faithflw-1za.app"],
    ["an empty host", ""],
  ])("rejects a forged or foreign host: %s", (_label, host) => {
    expect(churchSlugFromHost(host, ROOT)).toBeNull();
  });

  it("returns null for a missing host", () => {
    expect(churchSlugFromHost(null, ROOT)).toBeNull();
    expect(churchSlugFromHost(undefined, ROOT)).toBeNull();
  });

  it("still resolves localhost when ROOT_DOMAIN is unset, and nothing else", () => {
    expect(churchSlugFromHost("newbreed.localhost:3000", undefined)).toBe("newbreed");
    expect(churchSlugFromHost("newbreed.faithflow.app", undefined)).toBeNull();
    expect(churchSlugFromHost("newbreed.faithflow.app", "")).toBeNull();
  });

  it("normalizes a root domain given with capitals or a trailing dot", () => {
    expect(churchSlugFromHost("newbreed.faithflow.app", "FaithFlow.App.")).toBe("newbreed");
  });

  it("ignores an invalid root domain", () => {
    expect(churchSlugFromHost("newbreed.faithflow.app", "https://faithflow.app")).toBeNull();
    expect(churchSlugFromHost("newbreed.faithflow.app", "faithflow.app:443")).toBeNull();
  });
});
