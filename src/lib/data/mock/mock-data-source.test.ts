import { describe, expect, it } from "vitest";
import {
  DuplicatePhoneError,
  createMockDataSource,
  type AddNewcomerInput,
  type DataSource,
  type Person,
} from "@/lib/data";
import { SHARED_PHONE } from "./seed";

const SERVICE_DATE = "2026-10-04";
const FIXED_NOW = () => new Date("2026-10-04T15:00:00.000Z");
const TEAM_MEMBER_ID = "3f6c1d2e-8a4b-4c7d-9e5f-1a2b3c4d5e6f";
const ADMIN_ID = "7b8e9f0a-1c2d-4e3f-a4b5-c6d7e8f9a0b1";
const UNUSED_PHONE = "+12045550199";
const PHONE_PATTERN = /^\+120455501\d\d$/;

function newcomerInput(overrides: Partial<AddNewcomerInput> = {}): AddNewcomerInput {
  return {
    firstName: "Test",
    lastName: "Person",
    phone: UNUSED_PHONE,
    heardVia: { source: "friend" },
    firstVisitDate: SERVICE_DATE,
    consentToMessages: true,
    optedOut: false,
    ...overrides,
  };
}

async function firstPerson(ds: DataSource, list: Person["list"]): Promise<Person> {
  const entry = (await ds.getRoster(SERVICE_DATE)).find((e) => e.person.list === list);
  if (!entry) throw new Error(`No ${list} in roster`);
  return entry.person;
}

async function markOf(ds: DataSource, personId: string, serviceDate = SERVICE_DATE) {
  return (await ds.getRoster(serviceDate)).find((e) => e.person.id === personId)?.mark;
}

describe("MockDataSource", () => {
  it("seeds 40 members and 8 newcomers deterministically, with unique ids", async () => {
    const a = await createMockDataSource().getRoster(SERVICE_DATE);
    const b = await createMockDataSource().getRoster(SERVICE_DATE);
    expect(a).toEqual(b);
    expect(a.filter((e) => e.person.list === "member")).toHaveLength(40);
    expect(new Set(a.map((e) => e.person.id)).size).toBe(a.length);
  });

  it("keeps every seeded phone in the fictional range", async () => {
    const roster = await createMockDataSource().getRoster(SERVICE_DATE);
    for (const { person } of roster) {
      expect(person.phone).toMatch(PHONE_PATTERN);
    }
    expect(SHARED_PHONE).toMatch(PHONE_PATTERN);
  });

  it("roster includes members and newcomers, with the shared phone shown once as the member", async () => {
    const roster = await createMockDataSource().getRoster(SERVICE_DATE);
    expect(roster.some((e) => e.person.list === "member")).toBe(true);
    expect(roster.filter((e) => e.person.list === "newcomer")).toHaveLength(7);
    const shared = roster.filter((e) => e.person.phone === SHARED_PHONE);
    expect(shared).toHaveLength(1);
    expect(shared[0]?.person.list).toBe("member");
    expect(roster.every((e) => e.mark === null)).toBe(true);
  });

  it("marking and unmarking show up in the roster", async () => {
    const ds = createMockDataSource({ now: FIXED_NOW });
    const member = await firstPerson(ds, "member");
    await ds.markPresent({
      personId: member.id,
      serviceDate: SERVICE_DATE,
      markedBy: TEAM_MEMBER_ID,
      isCorrection: false,
    });
    expect(await markOf(ds, member.id)).toEqual({
      personId: member.id,
      serviceDate: SERVICE_DATE,
      markedBy: TEAM_MEMBER_ID,
      markedAt: "2026-10-04T15:00:00.000Z",
      isCorrection: false,
    });
    expect(await markOf(ds, member.id, "2026-10-11")).toBeNull();

    await ds.unmark({
      personId: member.id,
      serviceDate: SERVICE_DATE,
      by: ADMIN_ID,
      isCorrection: true,
    });
    expect(await markOf(ds, member.id)).toBeNull();
  });

  it("marking twice does not duplicate and keeps the first mark", async () => {
    const ds = createMockDataSource({ now: FIXED_NOW });
    const newcomer = await firstPerson(ds, "newcomer");
    const input = {
      personId: newcomer.id,
      serviceDate: SERVICE_DATE,
      markedBy: TEAM_MEMBER_ID,
      isCorrection: false,
    };
    const first = await ds.markPresent(input);
    const second = await ds.markPresent({ ...input, markedBy: ADMIN_ID });
    expect(second).toEqual(first);
    const marked = (await ds.getRoster(SERVICE_DATE)).filter((e) => e.mark !== null);
    expect(marked).toHaveLength(1);
  });

  it("unmarking someone who is not marked is a no-op", async () => {
    const ds = createMockDataSource();
    const member = await firstPerson(ds, "member");
    await expect(
      ds.unmark({
        personId: member.id,
        serviceDate: SERVICE_DATE,
        by: ADMIN_ID,
        isCorrection: false,
      }),
    ).resolves.toBeUndefined();
  });

  it("findByPhone returns the member for the shared phone", async () => {
    const ds = createMockDataSource();
    const person = await ds.findByPhone(SHARED_PHONE);
    expect(person?.list).toBe("member");
    expect(person?.firstName).toBe("Kemi");
    expect(await ds.findByPhone(UNUSED_PHONE)).toBeNull();
  });

  it("addNewcomer with an existing phone throws DuplicatePhoneError with the existing person", async () => {
    const ds = createMockDataSource();
    const member = await ds.findByPhone(SHARED_PHONE);
    const error = await ds
      .addNewcomer(newcomerInput({ phone: SHARED_PHONE }))
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DuplicatePhoneError);
    const duplicate = error as DuplicatePhoneError;
    expect(duplicate.existing.id).toBe(member?.id);
    expect(duplicate.existing.list).toBe("member");

    const newcomer = await firstPerson(ds, "newcomer");
    await expect(ds.addNewcomer(newcomerInput({ phone: newcomer.phone }))).rejects.toBeInstanceOf(
      DuplicatePhoneError,
    );
  });

  it("DuplicatePhoneError message carries no name or phone", async () => {
    const ds = createMockDataSource();
    const error = (await ds
      .addNewcomer(newcomerInput({ phone: SHARED_PHONE }))
      .catch((e: unknown) => e)) as DuplicatePhoneError;
    expect(error.message).not.toContain(SHARED_PHONE);
    expect(error.message).not.toContain("Kemi");
    expect(error.message).not.toContain("Oladipo");
    expect(error.message).toContain(error.existing.id);
  });

  it("addNewcomer gives the new person a generated id and adds them to the roster", async () => {
    const ds = createMockDataSource({ generateId: () => "generated-id" });
    const added = await ds.addNewcomer(newcomerInput());
    expect(added).toMatchObject({ id: "generated-id", list: "newcomer", phone: UNUSED_PHONE });
    const roster = await ds.getRoster(SERVICE_DATE);
    expect(roster.some((e) => e.person.id === "generated-id")).toBe(true);
  });

  it("addNewcomer uses random UUIDs by default", async () => {
    const ds = createMockDataSource();
    const a = await ds.addNewcomer(newcomerInput({ phone: "+12045550198" }));
    const b = await ds.addNewcomer(newcomerInput({ phone: "+12045550197" }));
    expect(a.id).not.toBe(b.id);
    expect(a.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("two instances do not share data", async () => {
    const a = createMockDataSource();
    const b = createMockDataSource();
    const member = await firstPerson(a, "member");
    await a.markPresent({
      personId: member.id,
      serviceDate: SERVICE_DATE,
      markedBy: TEAM_MEMBER_ID,
      isCorrection: false,
    });
    await a.addNewcomer(newcomerInput());

    const rosterB = await b.getRoster(SERVICE_DATE);
    expect(rosterB.every((e) => e.mark === null)).toBe(true);
    expect(await b.findByPhone(UNUSED_PHONE)).toBeNull();
  });

  it("returned records cannot mutate stored data", async () => {
    const ds = createMockDataSource();
    const first = await firstPerson(ds, "member");
    const originalName = first.firstName;
    first.firstName = "Changed";
    expect((await firstPerson(ds, "member")).firstName).toBe(originalName);
  });
});
