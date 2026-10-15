import { z } from "zod";
import { CHURCH_SLUG_PATTERN } from "@/lib/rules/host";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export const weekdaySchema = z.enum([
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
]);

/** A 24-hour "HH:mm" time of day, interpreted in the church's timezone. */
export const timeOfDaySchema = z.string().regex(TIME_PATTERN, 'Expected a 24-hour "HH:mm" time');

export const timezoneSchema = z.string().refine(
  (value) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  },
  { message: "Expected a valid IANA timezone name, e.g. America/Winnipeg" },
);

export const brandingSchema = z.object({
  primaryColor: z.string().regex(HEX_COLOR_PATTERN, "Expected a hex color, e.g. #4B3F8D"),
  logoUrl: z.url().optional(),
});

export const scheduleSchema = z
  .object({
    serviceDay: weekdaySchema,
    teamLockTime: timeOfDaySchema,
    correctionEndTime: timeOfDaySchema,
    absenceSendTime: timeOfDaySchema,
    newcomerThankYouDay: weekdaySchema,
    newcomerThankYouTime: timeOfDaySchema,
  })
  .refine((schedule) => schedule.correctionEndTime >= schedule.teamLockTime, {
    message: "correctionEndTime must not be earlier than teamLockTime",
    path: ["correctionEndTime"],
  });

export const mockDataSourceConfigSchema = z.object({
  type: z.literal("mock"),
});

const header = z.string().min(1);
const tab = z.string().min(1).max(100);

/** Sheet headers for each field, matched by exact header text, never by column position. */
export const memberColumnsSchema = z.object({
  personId: header,
  firstName: header,
  lastName: header,
  phone: header,
  attended: header,
});

export const newcomerColumnsSchema = z.object({
  personId: header,
  firstName: header,
  lastName: header,
  email: header,
  phone: header,
  heardVia: header,
  invitedBy: header,
  firstVisitDate: header,
  attended: header,
  birthday: header,
  occupation: header,
  consent: header,
  optedOut: header,
});

export const tickLogColumnsSchema = z.object({
  timestamp: header,
  serviceDate: header,
  personId: header,
  list: header,
  action: header,
  markedBy: header,
  correction: header,
});

export const googleSheetsDataSourceConfigSchema = z.object({
  type: z.literal("google-sheets"),
  /** Name of the environment variable holding the spreadsheet ID. The ID is never committed. */
  spreadsheetIdEnv: z.string().regex(/^[A-Z][A-Z0-9_]*$/, "Expected an environment variable name"),
  members: z.object({ tab, columns: memberColumnsSchema }),
  newcomers: z.object({ tab, columns: newcomerColumnsSchema }),
  tickLog: z.object({ tab, columns: tickLogColumnsSchema }),
});

export const dataSourceConfigSchema = z.discriminatedUnion("type", [
  mockDataSourceConfigSchema,
  googleSheetsDataSourceConfigSchema,
]);

export const teamRoleSchema = z.enum(["team", "admin"]);

export const teamMemberSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  email: z.email(),
  role: teamRoleSchema,
});

export const modulesSchema = z.object({
  attendance: z.boolean(),
  newcomerFollowUp: z.boolean(),
  membershipJourney: z.boolean(),
});

export const churchConfigSchema = z.object({
  slug: z
    .string()
    .regex(
      CHURCH_SLUG_PATTERN,
      "Expected a DNS label: lowercase letters, digits and hyphens, at most 63 characters, not starting or ending with a hyphen",
    ),
  displayName: z.string().min(1),
  branding: brandingSchema,
  timezone: timezoneSchema,
  schedule: scheduleSchema,
  dataSource: dataSourceConfigSchema,
  team: z
    .array(teamMemberSchema)
    .refine((team) => new Set(team.map((m) => m.id)).size === team.length, {
      message: "Team member ids must be unique",
    }),
  modules: modulesSchema,
});

export type Weekday = z.infer<typeof weekdaySchema>;
export type Branding = z.infer<typeof brandingSchema>;
export type Schedule = z.infer<typeof scheduleSchema>;
export type MockDataSourceConfig = z.infer<typeof mockDataSourceConfigSchema>;
export type GoogleSheetsDataSourceConfig = z.infer<typeof googleSheetsDataSourceConfigSchema>;
export type MemberColumns = z.infer<typeof memberColumnsSchema>;
export type NewcomerColumns = z.infer<typeof newcomerColumnsSchema>;
export type TickLogColumns = z.infer<typeof tickLogColumnsSchema>;
export type DataSourceConfig = z.infer<typeof dataSourceConfigSchema>;
export type TeamRole = z.infer<typeof teamRoleSchema>;
export type TeamMember = z.infer<typeof teamMemberSchema>;
export type Modules = z.infer<typeof modulesSchema>;
export type ChurchConfig = z.infer<typeof churchConfigSchema>;
export type ChurchConfigInput = z.input<typeof churchConfigSchema>;
