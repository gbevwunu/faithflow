import "server-only";

import type { CellValue } from "./client";
import { cellText } from "./values";

/** A mapped header is missing. Names the tab and header only, never any cell data. */
export class MissingHeaderError extends Error {
  constructor(
    readonly tab: string,
    readonly header: string,
  ) {
    super(`Sheet tab "${tab}" has no column headed "${header}" in row 1.`);
    this.name = "MissingHeaderError";
  }
}

/** Maps each field to the column whose row-1 header matches its configured text exactly. */
export function mapHeaders<F extends string>(
  tab: string,
  columns: Record<F, string>,
  headerRow: readonly CellValue[],
): Record<F, number> {
  const headers = headerRow.map((cell) => cellText(cell));
  const positions = {} as Record<F, number>;
  for (const [field, header] of Object.entries(columns) as [F, string][]) {
    const index = headers.indexOf(header);
    if (index === -1) throw new MissingHeaderError(tab, header);
    positions[field] = index;
  }
  return positions;
}

/** A row with each value at its field's column. Other cells are null, which writes nothing. */
export function rowFor(
  positions: Record<string, number>,
  values: Record<string, CellValue>,
): CellValue[] {
  const width = Math.max(...Object.values(positions)) + 1;
  const row: CellValue[] = Array.from({ length: width }, () => null);
  for (const [field, value] of Object.entries(values)) {
    const column = positions[field];
    if (column !== undefined) row[column] = value;
  }
  return row;
}
