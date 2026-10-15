import "server-only";

/**
 * Quotes a tab name for A1 notation: wrap in single quotes and double any single quote inside.
 * Quoting is always safe, so every name is quoted (spaces, double quotes, digits and all).
 */
export function quoteSheetName(name: string): string {
  return `'${name.replace(/'/g, "''")}'`;
}

/** Zero-based column index to letters: 0 -> A, 25 -> Z, 26 -> AA. */
export function columnLetter(index: number): string {
  let n = index + 1;
  let letters = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

/** The header row of a tab: 'Tab'!1:1. */
export const headerRowRange = (tab: string) => `${quoteSheetName(tab)}!1:1`;

/** One column from row 2 down: 'Tab'!C2:C. */
export const dataColumnRange = (tab: string, column: number) => {
  const letter = columnLetter(column);
  return `${quoteSheetName(tab)}!${letter}2:${letter}`;
};

/** A single cell: 'Tab'!C7 (rows are 1-based, as in the sheet). */
export const cellRange = (tab: string, column: number, row: number) =>
  `${quoteSheetName(tab)}!${columnLetter(column)}${row}`;

/** The anchor used to append rows to a tab's table. */
export const appendRange = (tab: string) => `${quoteSheetName(tab)}!A1`;
