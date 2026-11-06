import "server-only";

import type { TeamList } from "@/lib/config";

/**
 * Fake team members for the development-only fake session, used for every church while the
 * dev tools are on. Real team members only ever come from each church's team environment
 * variable on production.
 */
export const DEV_TEAM: TeamList = [
  {
    id: "3f6c1d2e-8a4b-4c7d-9e5f-1a2b3c4d5e6f",
    name: "Test Team Member",
    email: "team.member@example.com",
    role: "team",
  },
  {
    id: "7b8e9f0a-1c2d-4e3f-a4b5-c6d7e8f9a0b1",
    name: "Test Admin",
    email: "admin@example.com",
    role: "admin",
  },
];
