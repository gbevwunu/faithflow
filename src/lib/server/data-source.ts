import "server-only";

import type { ChurchConfig } from "@/lib/config";
import { createMockDataSource, type DataSource } from "@/lib/data";

// Kept on globalThis so the in-memory mock survives module reloads in development.
const store = globalThis as typeof globalThis & {
  __faithflowMockDataSources?: Map<string, DataSource>;
};

/** The data source for a church, chosen by its config. */
export function getDataSource(config: ChurchConfig): DataSource {
  switch (config.dataSource.type) {
    case "mock": {
      store.__faithflowMockDataSources ??= new Map();
      let source = store.__faithflowMockDataSources.get(config.slug);
      if (!source) {
        source = createMockDataSource();
        store.__faithflowMockDataSources.set(config.slug, source);
      }
      return source;
    }
    case "google-sheets":
      throw new Error("The Google Sheets data source is not implemented yet");
  }
}
