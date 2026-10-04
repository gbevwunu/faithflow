import type { AddNewcomerInput, DataSource, MarkPresentInput, UnmarkInput } from "../data-source";
import { DuplicatePhoneError, PersonNotFoundError } from "../errors";
import type { AttendanceMark, IsoDate, Member, Newcomer, Person, RosterEntry } from "../types";
import { createSeed } from "./seed";

export interface MockDataSourceOptions {
  /** Clock used for markedAt. Defaults to the real clock. */
  now?: () => Date;
  /** Id generator for new people. Defaults to crypto.randomUUID. */
  generateId?: () => string;
  /** Starting data. Defaults to the built-in seed. */
  seed?: { members: Member[]; newcomers: Newcomer[] };
}

function markKey(personId: string, serviceDate: IsoDate): string {
  return `${serviceDate}|${personId}`;
}

/** Creates an isolated in-memory DataSource. Each call has its own data. */
export function createMockDataSource(options: MockDataSourceOptions = {}): DataSource {
  const now = options.now ?? (() => new Date());
  const generateId = options.generateId ?? (() => crypto.randomUUID());
  const seed = structuredClone(options.seed ?? createSeed());
  const members: Member[] = seed.members;
  const newcomers: Newcomer[] = seed.newcomers;
  const marks = new Map<string, AttendanceMark>();

  function findPerson(personId: string): Person | undefined {
    return members.find((m) => m.id === personId) ?? newcomers.find((n) => n.id === personId);
  }

  function findByPhoneSync(phone: string): Person | undefined {
    return members.find((m) => m.phone === phone) ?? newcomers.find((n) => n.phone === phone);
  }

  return {
    async getRoster(serviceDate) {
      const memberPhones = new Set(members.map((m) => m.phone));
      const people: Person[] = [...members, ...newcomers.filter((n) => !memberPhones.has(n.phone))];
      return people.map((person) => ({
        person: structuredClone(person),
        mark: structuredClone(marks.get(markKey(person.id, serviceDate)) ?? null),
      })) satisfies RosterEntry[];
    },

    async markPresent({ personId, serviceDate, markedBy, isCorrection }: MarkPresentInput) {
      if (!findPerson(personId)) throw new PersonNotFoundError(personId);
      const key = markKey(personId, serviceDate);
      const existing = marks.get(key);
      if (existing) return structuredClone(existing);
      const mark: AttendanceMark = {
        personId,
        serviceDate,
        markedBy,
        markedAt: now().toISOString(),
        isCorrection,
      };
      marks.set(key, mark);
      return structuredClone(mark);
    },

    async unmark({ personId, serviceDate }: UnmarkInput) {
      if (!findPerson(personId)) throw new PersonNotFoundError(personId);
      marks.delete(markKey(personId, serviceDate));
    },

    async addNewcomer(input: AddNewcomerInput) {
      const existing = findByPhoneSync(input.phone);
      if (existing) throw new DuplicatePhoneError(structuredClone(existing));
      const newcomer: Newcomer = {
        ...structuredClone(input),
        id: generateId(),
        list: "newcomer",
      };
      newcomers.push(newcomer);
      return structuredClone(newcomer);
    },

    async findByPhone(phone) {
      const person = findByPhoneSync(phone);
      return person ? structuredClone(person) : null;
    },
  };
}
