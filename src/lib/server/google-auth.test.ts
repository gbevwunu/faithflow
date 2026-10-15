import { describe, expect, it } from "vitest";
import {
  GoogleAuthConfigError,
  SHEETS_SCOPE,
  buildExternalAccountOptions,
  readGoogleAuthEnv,
} from "./google-auth";

const env = {
  GCP_PROJECT_NUMBER: "123456789012",
  GCP_SERVICE_ACCOUNT_EMAIL: "faithflow-sheets@faithflow-prod.iam.gserviceaccount.com",
  GCP_WORKLOAD_IDENTITY_POOL_ID: "vercel",
  GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID: "vercel-oidc",
};

describe("readGoogleAuthEnv", () => {
  it("accepts a complete configuration", () => {
    expect(readGoogleAuthEnv(env)).toEqual(env);
  });

  it("names every missing variable", () => {
    const error = (() => {
      try {
        readGoogleAuthEnv({});
      } catch (e) {
        return e as Error;
      }
    })();
    expect(error).toBeInstanceOf(GoogleAuthConfigError);
    for (const name of Object.keys(env)) expect(error?.message).toContain(`${name} is not set`);
  });

  it("rejects malformed values without echoing them", () => {
    expect(() =>
      readGoogleAuthEnv({ ...env, GCP_SERVICE_ACCOUNT_EMAIL: "someone@evil.example" }),
    ).toThrow(/GCP_SERVICE_ACCOUNT_EMAIL must be a service account email/);
    try {
      readGoogleAuthEnv({ ...env, GCP_PROJECT_NUMBER: "my-project" });
    } catch (e) {
      expect((e as Error).message).not.toContain("my-project");
    }
  });
});

describe("buildExternalAccountOptions", () => {
  it("exchanges the Vercel OIDC token and impersonates the service account with the Sheets scope only", () => {
    const supplier = { getSubjectToken: async () => "oidc-token" };
    const options = buildExternalAccountOptions(env, supplier);
    expect(options).toMatchObject({
      type: "external_account",
      audience:
        "//iam.googleapis.com/projects/123456789012/locations/global/workloadIdentityPools/vercel/providers/vercel-oidc",
      subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
      token_url: "https://sts.googleapis.com/v1/token",
      service_account_impersonation_url:
        "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/faithflow-sheets@faithflow-prod.iam.gserviceaccount.com:generateAccessToken",
      scopes: [SHEETS_SCOPE],
    });
    expect(SHEETS_SCOPE).toBe("https://www.googleapis.com/auth/spreadsheets");
    expect(options.subject_token_supplier).toBe(supplier);
    expect(JSON.stringify(options)).not.toMatch(/private_key|credential_source/);
  });
});
