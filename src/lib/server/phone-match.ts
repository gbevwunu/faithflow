import "server-only";

import type { Person, PersonList } from "@/lib/data";

/** The most the browser learns about an existing person who has the same phone. */
export interface PhoneMatch {
  firstName: string;
  lastInitial: string;
  list: PersonList;
}

export function toPhoneMatch(person: Person): PhoneMatch {
  return {
    firstName: person.firstName,
    lastInitial: person.lastName.trim().charAt(0).toUpperCase(),
    list: person.list,
  };
}
