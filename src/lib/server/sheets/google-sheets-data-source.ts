import "server-only";

import type { GoogleSheetsDataSourceConfig } from "@/lib/config";
import {
  DuplicatePhoneError,
  PersonNotFoundError,
  type AttendanceMark,
  type DataSource,
  type IsoDate,
  type Member,
  type Newcomer,
  type Person,
  type PersonList,
  type RosterEntry,
} from "@/lib/data";
import { appendRange, cellRange, dataColumnRange, headerRowRange } from "./a1";
import type { CellValue, SheetsClient } from "./client";
import { mapHeaders, rowFor } from "./layout";
import {
  birthdayFromCell,
  birthdayToCell,
  cellText,
  heardViaFromCells,
  heardViaToCells,
  isYes,
  isoDateFromCell,
  phoneFromCell,
  phoneToCell,
  yesNo,
} from "./values";

export type SheetsLayout = Pick<GoogleSheetsDataSourceConfig, "members" | "newcomers" | "tickLog">;
type TabKey = keyof SheetsLayout;
type ColumnsOf<K extends TabKey> = SheetsLayout[K]["columns"];
type FieldOf<K extends TabKey> = keyof ColumnsOf<K> & string;

interface SheetRow<F extends string> {
  /** 1-based row number in the sheet, valid only for the read that produced it. */
  row: number;
  cells: Record<F, CellValue>;
}

interface TickLogEntry {
  timestamp: string;
  serviceDate: string;
  personId: string;
  list: string;
  action: string;
  markedBy: string;
  correction: boolean;
}

export interface GoogleSheetsDataSourceOptions {
  client: SheetsClient;
  layout: SheetsLayout;
  /** Lock key for serializing writes in this process; usually the spreadsheet ID. */
  lockKey?: string;
  now?: () => Date;
  generateId?: () => string;
  /** Receives counts and tab names only, never personal data. */
  warn?: (message: string, details: Record<string, string | number>) => void;
}

const writeLocks = new Map<string, Promise<unknown>>();

/** Runs writes for one spreadsheet one at a time within this server instance. */
function serialized<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = writeLocks.get(key) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(task);
  writeLocks.set(key, next);
  return next;
}

export function createGoogleSheetsDataSource(options: GoogleSheetsDataSourceOptions): DataSource {
  const { client, layout } = options;
  const now = options.now ?? (() => new Date());
  const generateId = options.generateId ?? (() => crypto.randomUUID());
  const warn = options.warn ?? ((message, details) => console.warn(message, details));
  const lockKey = options.lockKey ?? "default";

  /** Reads row 1 of each tab and maps every configured field to its column index. */
  async function readHeaders<K extends TabKey>(tabs: K[]) {
    const rows = await client.batchGetRows(tabs.map((key) => headerRowRange(layout[key].tab)));
    const positions = {} as { [T in K]: Record<FieldOf<T>, number> };
    tabs.forEach((key, i) => {
      positions[key] = mapHeaders(
        layout[key].tab,
        layout[key].columns as Record<FieldOf<K>, string>,
        rows[i] ?? [],
      );
    });
    return positions;
  }

  /**
   * Reads only the requested mapped columns of each tab, all in one batchGet, and lines the
   * columns up into rows. No other column is ever requested.
   */
  async function readTabs<K extends TabKey>(fields: { [T in K]: FieldOf<T>[] }) {
    const tabs = Object.keys(fields) as K[];
    const positions = await readHeaders(tabs);
    const requests = tabs.flatMap((key) =>
      fields[key].map((field) => ({
        key,
        field,
        range: dataColumnRange(layout[key].tab, positions[key][field]),
      })),
    );
    const columns = await client.batchGetColumns(requests.map((r) => r.range));

    const result = {} as { [T in K]: SheetRow<FieldOf<T>>[] };
    for (const key of tabs) {
      const own = requests
        .map((request, i) => ({ ...request, values: columns[i] ?? [] }))
        .filter((r) => r.key === key);
      const length = Math.max(0, ...own.map((r) => r.values.length));
      result[key] = Array.from({ length }, (_, i) => ({
        row: i + 2,
        cells: Object.fromEntries(own.map((r) => [r.field, r.values[i] ?? null])) as Record<
          FieldOf<K>,
          CellValue
        >,
      }));
    }
    return { rows: result, positions };
  }

  function withPersonIds<F extends string>(
    tabKey: TabKey,
    rows: SheetRow<F | "personId">[],
  ): SheetRow<F | "personId">[] {
    const kept = rows.filter((r) => cellText(r.cells.personId) !== "");
    const blankRows = rows.filter(
      (r) =>
        cellText(r.cells.personId) === "" &&
        Object.values(r.cells).some((v) => cellText(v as CellValue) !== ""),
    );
    if (blankRows.length > 0) {
      warn("Skipped sheet rows without a Person ID", {
        tab: layout[tabKey].tab,
        count: blankRows.length,
      });
    }
    return kept;
  }

  function toMember(cells: Record<FieldOf<"members">, CellValue>): Member {
    return {
      id: cellText(cells.personId),
      list: "member",
      firstName: cellText(cells.firstName),
      lastName: cellText(cells.lastName),
      // An invalid phone keeps the person on the roster with no usable number.
      phone: phoneFromCell(cells.phone) ?? "",
    };
  }

  function toNewcomer(cells: Record<FieldOf<"newcomers">, CellValue>): Newcomer {
    const email = cellText(cells.email);
    const occupation = cellText(cells.occupation);
    const birthday = birthdayFromCell(cells.birthday);
    return {
      id: cellText(cells.personId),
      list: "newcomer",
      firstName: cellText(cells.firstName),
      lastName: cellText(cells.lastName),
      phone: phoneFromCell(cells.phone) ?? "",
      ...(email ? { email } : {}),
      ...(birthday ? { birthday } : {}),
      ...(occupation ? { occupation } : {}),
      heardVia: heardViaFromCells(cells.heardVia, cells.invitedBy),
      firstVisitDate: isoDateFromCell(cells.firstVisitDate),
      consentToMessages: isYes(cells.consent),
      optedOut: isYes(cells.optedOut),
    };
  }

  function toTickLog(rows: SheetRow<FieldOf<"tickLog">>[]): TickLogEntry[] {
    return rows.map(({ cells }) => ({
      timestamp: cellText(cells.timestamp),
      serviceDate: cellText(cells.serviceDate),
      personId: cellText(cells.personId),
      list: cellText(cells.list),
      action: cellText(cells.action),
      markedBy: cellText(cells.markedBy),
      correction: isYes(cells.correction),
    }));
  }

  /** The latest Tick Log entry for a person on a service date (later rows are newer). */
  function latestEntry(log: TickLogEntry[], personId: string, serviceDate: IsoDate) {
    for (let i = log.length - 1; i >= 0; i--) {
      const entry = log[i];
      if (entry && entry.personId === personId && entry.serviceDate === serviceDate) return entry;
    }
    return undefined;
  }

  function markFor(personId: string, serviceDate: IsoDate, log: TickLogEntry[]): AttendanceMark {
    const entry = latestEntry(log, personId, serviceDate);
    const attributed = entry?.action === "mark";
    return {
      personId,
      serviceDate,
      markedBy: attributed ? entry.markedBy : "",
      markedAt: attributed ? entry.timestamp : "",
      isCorrection: attributed ? entry.correction : false,
    };
  }

  const memberFields: FieldOf<"members">[] = [
    "personId",
    "firstName",
    "lastName",
    "phone",
    "attended",
  ];
  const newcomerFields = Object.keys(layout.newcomers.columns) as FieldOf<"newcomers">[];
  const tickLogFields = Object.keys(layout.tickLog.columns) as FieldOf<"tickLog">[];

  async function readPeople() {
    const { rows } = await readTabs({
      members: memberFields,
      newcomers: newcomerFields,
      tickLog: tickLogFields,
    });
    const members = withPersonIds("members", rows.members).map((r) => ({
      person: toMember(r.cells),
      attended: isYes(r.cells.attended),
    }));
    const newcomers = withPersonIds("newcomers", rows.newcomers).map((r) => ({
      person: toNewcomer(r.cells),
      attended: isYes(r.cells.attended),
    }));
    return { members, newcomers, log: toTickLog(rows.tickLog) };
  }

  function findByPhoneIn(
    people: { members: { person: Member }[]; newcomers: { person: Newcomer }[] },
    phone: string,
  ): Person | null {
    if (!phone) return null;
    return (
      people.members.find((m) => m.person.phone === phone)?.person ??
      people.newcomers.find((n) => n.person.phone === phone)?.person ??
      null
    );
  }

  /** Looks up the person's current row by Person ID, right before a write. */
  async function locate(personId: string) {
    const { rows, positions } = await readTabs({
      members: ["personId", "attended"],
      newcomers: ["personId", "attended"],
      tickLog: tickLogFields,
    });
    const log = toTickLog(rows.tickLog);
    for (const key of ["members", "newcomers"] as const) {
      const match = rows[key].find((r) => cellText(r.cells.personId) === personId);
      if (match) {
        return {
          tab: layout[key].tab,
          list: (key === "members" ? "member" : "newcomer") as PersonList,
          row: match.row,
          attendedColumn: positions[key].attended,
          attended: isYes(match.cells.attended),
          log,
          tickLogPositions: positions.tickLog,
        };
      }
    }
    return null;
  }

  async function appendTickLog(
    positions: Record<FieldOf<"tickLog">, number>,
    entry: Omit<TickLogEntry, "correction"> & { correction: boolean },
  ) {
    await client.appendRows(appendRange(layout.tickLog.tab), [
      rowFor(positions, { ...entry, correction: yesNo(entry.correction) }),
    ]);
  }

  return {
    async getRoster(serviceDate) {
      const people = await readPeople();
      const memberPhones = new Set(people.members.map((m) => m.person.phone).filter(Boolean));
      const all = [
        ...people.members,
        ...people.newcomers.filter((n) => !(n.person.phone && memberPhones.has(n.person.phone))),
      ];
      return all.map(({ person, attended }) => {
        if (!attended) return { person, mark: null };
        const tickedToday = people.log.some(
          (e) => e.personId === person.id && e.serviceDate === serviceDate && e.action === "mark",
        );
        return {
          person,
          mark: markFor(person.id, serviceDate, people.log),
          ...(tickedToday ? {} : { staleMark: true }),
        };
      }) satisfies RosterEntry[];
    },

    markPresent({ personId, serviceDate, markedBy, isCorrection, markedAt }) {
      return serialized(lockKey, async () => {
        const found = await locate(personId);
        if (!found) throw new PersonNotFoundError(personId);
        const existing = latestEntry(found.log, personId, serviceDate);
        if (found.attended && existing?.action === "mark") {
          return markFor(personId, serviceDate, found.log);
        }
        if (!found.attended) {
          await client.updateCell(cellRange(found.tab, found.attendedColumn, found.row), "Yes");
        }
        const timestamp = (markedAt ?? now()).toISOString();
        await appendTickLog(found.tickLogPositions, {
          timestamp,
          serviceDate,
          personId,
          list: found.list,
          action: "mark",
          markedBy,
          correction: isCorrection,
        });
        return { personId, serviceDate, markedBy, markedAt: timestamp, isCorrection };
      });
    },

    unmark({ personId, serviceDate, by, isCorrection }) {
      return serialized(lockKey, async () => {
        const found = await locate(personId);
        if (!found) throw new PersonNotFoundError(personId);
        if (!found.attended) return;
        await client.updateCell(cellRange(found.tab, found.attendedColumn, found.row), "No");
        await appendTickLog(found.tickLogPositions, {
          timestamp: now().toISOString(),
          serviceDate,
          personId,
          list: found.list,
          action: "unmark",
          markedBy: by,
          correction: isCorrection,
        });
      });
    },

    addNewcomer(input) {
      return serialized(lockKey, async () => {
        const people = await readPeople();
        const existing = findByPhoneIn(people, input.phone);
        if (existing) throw new DuplicatePhoneError(existing);

        const positions = (await readHeaders(["newcomers"])).newcomers;
        const id = generateId();
        const heardVia = heardViaToCells(input.heardVia);
        await client.appendRows(appendRange(layout.newcomers.tab), [
          rowFor(positions, {
            personId: id,
            firstName: input.firstName,
            lastName: input.lastName,
            email: input.email ?? "",
            phone: phoneToCell(input.phone),
            heardVia: heardVia.heardVia,
            invitedBy: heardVia.invitedBy,
            firstVisitDate: input.firstVisitDate,
            attended: "Yes",
            birthday: input.birthday ? birthdayToCell(input.birthday) : "",
            occupation: input.occupation ?? "",
            consent: yesNo(input.consentToMessages),
            optedOut: yesNo(input.optedOut),
          }),
        ]);
        return { ...input, id, list: "newcomer" } satisfies Newcomer;
      });
    },

    async findByPhone(phone) {
      return findByPhoneIn(await readPeople(), phone);
    },
  };
}

export { MissingHeaderError } from "./layout";
