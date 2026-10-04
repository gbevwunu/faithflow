import { z } from "zod";

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

export const googleSheetsDataSourceConfigSchema = z.object({
  type: z.literal("google-sheets"),
  spreadsheetId: z.string().min(1),
  memberTab: z.string().min(1),
  newcomerTab: z.string().min(1),
  tickLogTab: z.string().min(1),
  /** Maps internal field names to spreadsheet header names. */
  columns: z.record(z.string().min(1), z.string().min(1)),
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
  slug: z.string().regex(/^[a-z0-9-]+$/, "Expected lowercase letters, digits and dashes"),
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
export type DataSourceConfig = z.infer<typeof dataSourceConfigSchema>;
export type TeamRole = z.infer<typeof teamRoleSchema>;
export type TeamMember = z.infer<typeof teamMemberSchema>;
export type Modules = z.infer<typeof modulesSchema>;
export type ChurchConfig = z.infer<typeof churchConfigSchema>;
export type ChurchConfigInput = z.input<typeof churchConfigSchema>;
