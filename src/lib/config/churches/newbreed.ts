import "server-only";

import type { ChurchConfigInput } from "../schema";

export const newbreed = {
  slug: "newbreed",
  displayName: "The NewBreed Church",
  branding: {
    primaryColor: "#4B3F8D",
  },
  timezone: "America/Winnipeg",
  schedule: {
    serviceDay: "sunday",
    teamLockTime: "17:00",
    correctionEndTime: "19:00",
    absenceSendTime: "19:00",
    newcomerThankYouDay: "thursday",
    newcomerThankYouTime: "18:00",
  },
  dataSource: {
    type: "google-sheets",
    spreadsheetIdEnv: "NEWBREED_SPREADSHEET_ID",
    members: {
      tab: 'Template "26',
      columns: {
        personId: "Person ID",
        firstName: "First Name",
        lastName: "Last Name",
        phone: "Phone Number",
        attended: "Attended Church",
      },
    },
    newcomers: {
      tab: "New Comers 2026",
      columns: {
        personId: "Person ID",
        firstName: "Name - First Name",
        lastName: "Name - Last Name",
        email: "Email",
        phone: "Phone Number",
        heardVia: "How did you find out about us?",
        invitedBy: "Who invited you to church?",
        firstVisitDate: "Date",
        attended: "Attended Church",
        birthday: "Birthday",
        occupation: "Occupation",
        consent: "Consent to Messages",
        optedOut: "Opted Out",
      },
    },
    tickLog: {
      tab: "Tick Log",
      columns: {
        timestamp: "Timestamp",
        serviceDate: "Service Date",
        personId: "Person ID",
        list: "List",
        action: "Action",
        markedBy: "Marked By",
        correction: "Correction",
      },
    },
  },
  team: [
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
  ],
  modules: {
    attendance: true,
    newcomerFollowUp: false,
    membershipJourney: false,
  },
} satisfies ChurchConfigInput;
