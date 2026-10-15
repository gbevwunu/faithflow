import type { CellValue, HttpFetch } from "../client";

/** One recorded API request, with its ranges decoded. */
export interface RecordedRequest {
  method: string;
  url: string;
  ranges: string[];
  valueInputOption: string | null;
  body: unknown;
}

type Grid = CellValue[][];

function parseRange(range: string): { tab: string; ref: string } {
  const match = /^'((?:[^']|'')*)'!(.+)$/.exec(range);
  if (!match) throw new Error(`Fake Sheets API: unquoted or invalid range ${range}`);
  return { tab: (match[1] ?? "").replace(/''/g, "'"), ref: match[2] ?? "" };
}

function columnIndex(letters: string): number {
  return [...letters].reduce((n, c) => n * 26 + (c.charCodeAt(0) - 64), 0) - 1;
}

const isEmpty = (v: CellValue | undefined) => v === null || v === undefined || v === "";

/**
 * An in-memory spreadsheet answering the few Sheets v4 calls the app makes. It records every
 * request and every cell it serves, so tests can prove what was and was not read.
 */
export function createFakeSheetsApi(initial: { title: string; tabs: Record<string, Grid> }) {
  const tabs = new Map(
    Object.entries(initial.tabs).map(([name, grid]) => [name, grid.map((r) => [...r])]),
  );
  const requests: RecordedRequest[] = [];
  const servedCells: CellValue[] = [];

  const grid = (tab: string) => {
    const g = tabs.get(tab);
    if (!g) throw new Error(`Fake Sheets API: no tab ${tab}`);
    return g;
  };

  function read(range: string): CellValue[] {
    const { tab, ref } = parseRange(range);
    const g = grid(tab);
    const row = /^(\d+):(\d+)$/.exec(ref);
    if (row) {
      const values = [...(g[Number(row[1]) - 1] ?? [])];
      while (values.length && isEmpty(values[values.length - 1])) values.pop();
      return values;
    }
    const column = /^([A-Z]+)(\d+):([A-Z]+)$/.exec(ref);
    if (column) {
      const c = columnIndex(column[1] ?? "A");
      const values = g.slice(Number(column[2]) - 1).map((r) => r[c] ?? "");
      while (values.length && isEmpty(values[values.length - 1])) values.pop();
      return values;
    }
    throw new Error(`Fake Sheets API: unsupported read range ${range}`);
  }

  const fetch: HttpFetch = async (url, init) => {
    const parsed = new URL(url);
    const path = decodeURIComponent(parsed.pathname.replace(/^\/v4\/spreadsheets\/[^/]+/, ""));
    const body = init.body ? JSON.parse(init.body) : undefined;
    const ranges = parsed.searchParams.getAll("ranges");
    const respond = (data: unknown) => ({ ok: true, status: 200, json: async () => data });

    if (init.method === "GET" && path === "") {
      requests.push({ method: "GET", url, ranges: [], valueInputOption: null, body });
      return respond({ properties: { title: initial.title } });
    }
    if (init.method === "GET" && path === "/values:batchGet") {
      requests.push({ method: "GET", url, ranges, valueInputOption: null, body });
      return respond({
        valueRanges: ranges.map((range) => {
          const values = read(range);
          servedCells.push(...values);
          return values.length ? { range, values: [values] } : { range };
        }),
      });
    }
    const update = /^\/values\/(.+)$/.exec(path);
    const option = parsed.searchParams.get("valueInputOption");
    if (init.method === "PUT" && update) {
      const range = update[1] ?? "";
      requests.push({ method: "PUT", url, ranges: [range], valueInputOption: option, body });
      const { tab, ref } = parseRange(range);
      const cell = /^([A-Z]+)(\d+)$/.exec(ref);
      if (!cell) throw new Error(`Fake Sheets API: unsupported update range ${range}`);
      const g = grid(tab);
      const r = Number(cell[2]) - 1;
      g[r] ??= [];
      g[r][columnIndex(cell[1] ?? "A")] = body.values[0][0];
      return respond({});
    }
    const append = /^\/values\/(.+):append$/.exec(path);
    if (init.method === "POST" && append) {
      const range = append[1] ?? "";
      requests.push({ method: "POST", url, ranges: [range], valueInputOption: option, body });
      const g = grid(parseRange(range).tab);
      let last = g.length - 1;
      while (last > 0 && (g[last] ?? []).every(isEmpty)) last--;
      g.length = last + 1;
      for (const row of body.values as CellValue[][]) g.push(row.map((v) => (v === null ? "" : v)));
      return respond({});
    }
    throw new Error(`Fake Sheets API: unsupported ${init.method} ${url}`);
  };

  return {
    fetch,
    requests,
    servedCells,
    tab: (name: string) => grid(name),
    /** Inserts a row below the header, shifting every data row down (as a sort or insert would). */
    insertRowAtTop(name: string, row: CellValue[]) {
      grid(name).splice(1, 0, row);
    },
  };
}
