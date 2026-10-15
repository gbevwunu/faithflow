import { describe, expect, it } from "vitest";
import { getChurchConfig } from "@/lib/config";
import { DataSourceConfigError, getSheetsClient, resolveDataSourceKind } from "./data-source";

describe("resolveDataSourceKind", () => {
  it("uses the mock in local development and tests", () => {
    expect(resolveDataSourceKind("google-sheets", { NODE_ENV: "development" })).toBe("mock");
    expect(resolveDataSourceKind("google-sheets", { NODE_ENV: "test" })).toBe("mock");
  });

  it("uses the configured source on deployments, previews included", () => {
    expect(resolveDataSourceKind("google-sheets", { NODE_ENV: "production" })).toBe(
      "google-sheets",
    );
    expect(
      resolveDataSourceKind("google-sheets", { NODE_ENV: "production", VERCEL_ENV: "preview" }),
    ).toBe("google-sheets");
    expect(resolveDataSourceKind("mock", { NODE_ENV: "production" })).toBe("mock");
  });

  it("honours DATA_SOURCE_OVERRIDE outside production", () => {
    expect(
      resolveDataSourceKind("google-sheets", {
        NODE_ENV: "production",
        VERCEL_ENV: "preview",
        DATA_SOURCE_OVERRIDE: "mock",
      }),
    ).toBe("mock");
    expect(
      resolveDataSourceKind("google-sheets", {
        NODE_ENV: "development",
        DATA_SOURCE_OVERRIDE: "google-sheets",
      }),
    ).toBe("google-sheets");
  });

  it("refuses DATA_SOURCE_OVERRIDE on a production deployment", () => {
    for (const value of ["mock", "google-sheets"]) {
      expect(() =>
        resolveDataSourceKind("google-sheets", {
          NODE_ENV: "production",
          VERCEL_ENV: "production",
          DATA_SOURCE_OVERRIDE: value,
        }),
      ).toThrow(DataSourceConfigError);
    }
  });

  it("refuses an unknown override value", () => {
    expect(() =>
      resolveDataSourceKind("google-sheets", {
        NODE_ENV: "development",
        DATA_SOURCE_OVERRIDE: "csv",
      }),
    ).toThrow(/must be "mock" or "google-sheets"/);
  });
});

describe("getSheetsClient", () => {
  const config = getChurchConfig("newbreed");
  if (config.dataSource.type !== "google-sheets") throw new Error("expected google-sheets config");
  const dataSource = config.dataSource;

  it("reads the spreadsheet ID from the environment variable named in config", () => {
    expect(getSheetsClient(dataSource, { NEWBREED_SPREADSHEET_ID: "abc123" }).spreadsheetId).toBe(
      "abc123",
    );
  });

  it("fails clearly, naming only the variable, when it is not set", () => {
    expect(() => getSheetsClient(dataSource, {})).toThrow("NEWBREED_SPREADSHEET_ID is not set.");
  });
});
