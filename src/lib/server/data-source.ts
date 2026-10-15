import "server-only";

import type { ChurchConfig, GoogleSheetsDataSourceConfig } from "@/lib/config";
import { createMockDataSource, type DataSource } from "@/lib/data";
import { getGoogleAccessToken } from "./google-auth";
import { createSheetsClient, type SheetsClient } from "./sheets/client";
import { createGoogleSheetsDataSource } from "./sheets/google-sheets-data-source";

export interface DataSourceEnv {
  NODE_ENV?: string;
  VERCEL_ENV?: string;
  DATA_SOURCE_OVERRIDE?: string;
}

export class DataSourceConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataSourceConfigError";
  }
}

/**
 * Which kind of data source to use. Local development and tests use the mock. Deployments
 * (NODE_ENV=production, including Vercel previews) use the church's configured source.
 * DATA_SOURCE_OVERRIDE=mock forces the mock and DATA_SOURCE_OVERRIDE=google-sheets forces
 * Sheets locally; any override is refused on a production deployment.
 */
export function resolveDataSourceKind(
  configured: ChurchConfig["dataSource"]["type"],
  env: DataSourceEnv = process.env,
): "mock" | "google-sheets" {
  const override = env.DATA_SOURCE_OVERRIDE?.trim();
  if (override) {
    if (env.VERCEL_ENV === "production") {
      throw new DataSourceConfigError(
        "DATA_SOURCE_OVERRIDE is set on a production deployment. Remove it.",
      );
    }
    if (override !== "mock" && override !== "google-sheets") {
      throw new DataSourceConfigError('DATA_SOURCE_OVERRIDE must be "mock" or "google-sheets".');
    }
    return override;
  }
  return env.NODE_ENV === "production" ? configured : "mock";
}

/** A Sheets API client for a church's spreadsheet, whose ID comes from the environment. */
export function getSheetsClient(
  dataSource: GoogleSheetsDataSourceConfig,
  env: Record<string, string | undefined> = process.env,
): { client: SheetsClient; spreadsheetId: string } {
  const spreadsheetId = env[dataSource.spreadsheetIdEnv]?.trim();
  if (!spreadsheetId) {
    throw new DataSourceConfigError(`${dataSource.spreadsheetIdEnv} is not set.`);
  }
  return {
    spreadsheetId,
    client: createSheetsClient({ spreadsheetId, getAccessToken: getGoogleAccessToken }),
  };
}

// Kept on globalThis so the in-memory mock survives module reloads in development.
const store = globalThis as typeof globalThis & {
  __faithflowDataSources?: Map<string, DataSource>;
};

/** The data source for a church, chosen by its config and the environment. */
export function getDataSource(config: ChurchConfig): DataSource {
  const kind = resolveDataSourceKind(config.dataSource.type);
  const key = `${kind}:${config.slug}`;
  store.__faithflowDataSources ??= new Map();
  let source = store.__faithflowDataSources.get(key);
  if (!source) {
    if (kind === "mock" || config.dataSource.type !== "google-sheets") {
      source = createMockDataSource();
    } else {
      const { client, spreadsheetId } = getSheetsClient(config.dataSource);
      source = createGoogleSheetsDataSource({
        client,
        layout: config.dataSource,
        lockKey: spreadsheetId,
      });
    }
    store.__faithflowDataSources.set(key, source);
  }
  return source;
}
