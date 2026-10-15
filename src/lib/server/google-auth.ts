import "server-only";

import { getVercelOidcToken } from "@vercel/oidc";
import { ExternalAccountClient, type BaseExternalAccountClientOptions } from "google-auth-library";
import type { SubjectTokenSupplier } from "google-auth-library";
import { z } from "zod";

/** The only scope requested: read and write Google Sheets. */
export const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

const googleAuthEnvSchema = z.object({
  GCP_PROJECT_NUMBER: z.string().regex(/^\d+$/, "must be the numeric project number"),
  GCP_SERVICE_ACCOUNT_EMAIL: z
    .string()
    .regex(/^[a-z0-9-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com$/, "must be a service account email"),
  GCP_WORKLOAD_IDENTITY_POOL_ID: z.string().regex(/^[a-z0-9-]+$/, "must be a pool ID"),
  GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID: z.string().regex(/^[a-z0-9-]+$/, "must be a provider ID"),
});

export type GoogleAuthEnv = z.infer<typeof googleAuthEnvSchema>;

export class GoogleAuthConfigError extends Error {
  constructor(problems: string[]) {
    super(`Google Sheets authentication is not configured: ${problems.join("; ")}`);
    this.name = "GoogleAuthConfigError";
  }
}

/** Reads and validates the Workload Identity Federation settings. Values never appear in errors. */
export function readGoogleAuthEnv(
  env: Record<string, string | undefined> = process.env,
): GoogleAuthEnv {
  const result = googleAuthEnvSchema.safeParse(env);
  if (!result.success) {
    throw new GoogleAuthConfigError(
      result.error.issues.map((issue) =>
        env[String(issue.path[0])]
          ? `${String(issue.path[0])} ${issue.message}`
          : `${String(issue.path[0])} is not set`,
      ),
    );
  }
  return result.data;
}

/**
 * Options for a keyless external account client: the Vercel OIDC token is exchanged at Google's
 * Security Token Service, then used to impersonate the service account. URLs are built only
 * from validated values and always point at googleapis.com.
 */
export function buildExternalAccountOptions(
  env: GoogleAuthEnv,
  subjectTokenSupplier: SubjectTokenSupplier,
): BaseExternalAccountClientOptions & { subject_token_supplier: SubjectTokenSupplier } {
  return {
    type: "external_account",
    audience:
      `//iam.googleapis.com/projects/${env.GCP_PROJECT_NUMBER}/locations/global/` +
      `workloadIdentityPools/${env.GCP_WORKLOAD_IDENTITY_POOL_ID}/providers/${env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID}`,
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
    token_url: "https://sts.googleapis.com/v1/token",
    service_account_impersonation_url:
      `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/` +
      `${env.GCP_SERVICE_ACCOUNT_EMAIL}:generateAccessToken`,
    subject_token_supplier: subjectTokenSupplier,
    scopes: [SHEETS_SCOPE],
  };
}

const vercelOidcSupplier: SubjectTokenSupplier = {
  getSubjectToken: () => getVercelOidcToken(),
};

let client: ReturnType<typeof ExternalAccountClient.fromJSON> | undefined;

/** A short-lived Google access token for the Sheets API. No keys or key files are involved. */
export async function getGoogleAccessToken(): Promise<string> {
  client ??= ExternalAccountClient.fromJSON(
    buildExternalAccountOptions(readGoogleAuthEnv(), vercelOidcSupplier),
  );
  if (!client)
    throw new GoogleAuthConfigError(["the external account client could not be created"]);
  const { token } = await client.getAccessToken();
  if (!token) throw new GoogleAuthConfigError(["no access token was returned"]);
  return token;
}
