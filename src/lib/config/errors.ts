export class UnknownChurchError extends Error {
  constructor(readonly slug: string) {
    super(`Unknown church "${slug}". Add its config to src/lib/config/churches.`);
    this.name = "UnknownChurchError";
  }
}

export class InvalidChurchConfigError extends Error {
  constructor(
    readonly slug: string,
    readonly issues: string[],
  ) {
    super(
      `Invalid config for church "${slug}":\n${issues.map((issue) => `- ${issue}`).join("\n")}`,
    );
    this.name = "InvalidChurchConfigError";
  }
}
