import { initials } from "@/lib/format";

export function Avatar({
  firstName,
  lastName,
  tone,
}: {
  firstName: string;
  lastName: string;
  tone: "member" | "newcomer";
}) {
  return (
    <span
      aria-hidden="true"
      className={`grid size-9 shrink-0 place-items-center rounded-full text-[13px] font-semibold ${
        tone === "newcomer" ? "bg-warning-light text-warning" : "bg-primary-light text-primary"
      }`}
    >
      {initials(firstName, lastName)}
    </span>
  );
}
