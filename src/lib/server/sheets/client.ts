import "server-only";

export type CellValue = string | number | boolean | null;

/** Minimal fetch shape so tests can inject a fake HTTP layer. */
export type HttpFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export class SheetsApiError extends Error {
  constructor(
    readonly status: number,
    readonly operation: string,
  ) {
    super(`Google Sheets ${operation} failed with HTTP ${status}`);
    this.name = "SheetsApiError";
  }
}

export interface SheetsClient {
  getTitle(): Promise<string>;
  /** Reads several ranges in one request, column by column. Missing trailing cells are absent. */
  batchGetColumns(ranges: string[]): Promise<CellValue[][]>;
  /** Reads several rows (such as header rows) in one request. */
  batchGetRows(ranges: string[]): Promise<CellValue[][]>;
  /** Writes one cell. RAW: stored exactly as given, never parsed as a formula or number. */
  updateCell(range: string, value: CellValue): Promise<void>;
  /** Appends rows to a tab's table. RAW. Null leaves a cell untouched. */
  appendRows(range: string, rows: CellValue[][]): Promise<void>;
}

const API = "https://sheets.googleapis.com/v4/spreadsheets";

export function createSheetsClient(options: {
  spreadsheetId: string;
  getAccessToken: () => Promise<string>;
  fetch?: HttpFetch;
}): SheetsClient {
  const http: HttpFetch = options.fetch ?? ((url, init) => fetch(url, init));
  const base = `${API}/${encodeURIComponent(options.spreadsheetId)}`;

  async function call(
    operation: string,
    method: string,
    url: string,
    body?: unknown,
  ): Promise<unknown> {
    const token = await options.getAccessToken();
    const response = await http(url, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) throw new SheetsApiError(response.status, operation);
    return response.json();
  }

  async function batchGet(ranges: string[], majorDimension: "ROWS" | "COLUMNS") {
    const params = new URLSearchParams({
      majorDimension,
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    });
    for (const range of ranges) params.append("ranges", range);
    const data = (await call("read", "GET", `${base}/values:batchGet?${params}`)) as {
      valueRanges?: { values?: CellValue[][] }[];
    };
    return ranges.map((_, i) => data.valueRanges?.[i]?.values?.[0] ?? []);
  }

  return {
    async getTitle() {
      const data = (await call("title read", "GET", `${base}?fields=properties.title`)) as {
        properties?: { title?: string };
      };
      return data.properties?.title ?? "";
    },
    batchGetColumns: (ranges) => batchGet(ranges, "COLUMNS"),
    batchGetRows: (ranges) => batchGet(ranges, "ROWS"),
    async updateCell(range, value) {
      await call(
        "update",
        "PUT",
        `${base}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
        { range, majorDimension: "ROWS", values: [[value]] },
      );
    },
    async appendRows(range, rows) {
      await call(
        "append",
        "POST",
        `${base}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
        { range, majorDimension: "ROWS", values: rows },
      );
    },
  };
}
