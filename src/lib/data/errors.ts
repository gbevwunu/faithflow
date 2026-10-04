import type { Person } from "./types";

export class DuplicatePhoneError extends Error {
  constructor(readonly existing: Person) {
    // Message carries ids only; callers read `existing` for anything they need to show.
    super(`Phone already belongs to ${existing.list} ${existing.id}`);
    this.name = "DuplicatePhoneError";
  }
}

export class PersonNotFoundError extends Error {
  constructor(readonly personId: string) {
    super(`No person with id "${personId}"`);
    this.name = "PersonNotFoundError";
  }
}
