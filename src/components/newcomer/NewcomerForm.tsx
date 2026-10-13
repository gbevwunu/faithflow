"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent, type InputHTMLAttributes } from "react";
import {
  addNewcomerAction,
  checkPhoneAction,
  tickExistingAction,
} from "@/app/[church]/newcomers/new/actions";
import { Chip } from "@/components/ui";
import type { HeardViaSource } from "@/lib/data";
import { saveAttendanceFlash, takeNewcomerPrefill } from "@/lib/client/handoff";
import { useHandoff } from "@/lib/client/use-handoff";
import { normalizePhone } from "@/lib/rules";
import type { PhoneMatch } from "@/lib/server/phone-match";
import {
  EMPTY_NEWCOMER_FORM,
  HEARD_VIA_OPTIONS,
  MONTHS,
  validateNewcomerForm,
  type NewcomerField,
  type NewcomerFieldErrors,
  type NewcomerFormInput,
} from "@/lib/validation/newcomer";
import { FieldError, FormField, inputClass } from "./FormField";

const FIELD_ORDER: NewcomerField[] = [
  "firstName",
  "lastName",
  "phone",
  "email",
  "birthdayMonth",
  "birthdayDay",
  "occupation",
  "heardViaSource",
  "heardViaDetail",
];

export function NewcomerForm({ church }: { church: string }) {
  // Prefill from the attendance search, handed over in this tab only.
  const prefill = useHandoff(takeNewcomerPrefill);
  if (!prefill.ready) return <div className="min-h-[60vh]" aria-busy="true" />;
  return (
    <NewcomerFormFields church={church} initial={{ ...EMPTY_NEWCOMER_FORM, ...prefill.value }} />
  );
}

function NewcomerFormFields({ church, initial }: { church: string; initial: NewcomerFormInput }) {
  const router = useRouter();
  const [values, setValues] = useState<NewcomerFormInput>(initial);
  const [touched, setTouched] = useState<ReadonlySet<NewcomerField>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<NewcomerFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [match, setMatch] = useState<PhoneMatch | null>(null);
  const [pending, setPending] = useState<"save" | "tick" | null>(null);
  const busy = useRef(false);
  const phoneCheck = useRef({ seq: 0, checked: "" });

  const clientErrors = (() => {
    const result = validateNewcomerForm(values);
    return result.ok ? {} : result.errors;
  })();

  const errorFor = (field: NewcomerField) =>
    serverErrors[field] ?? (submitted || touched.has(field) ? clientErrors[field] : undefined);

  function update<K extends NewcomerField>(field: K, value: NewcomerFormInput[K]) {
    setValues((v) => ({ ...v, [field]: value }));
    setServerErrors((errors) => {
      const next = { ...errors };
      delete next[field];
      return next;
    });
    setFormError(null);
  }

  const touch = (field: NewcomerField) => setTouched((t) => new Set(t).add(field));

  async function checkPhone(raw: string) {
    const phone = normalizePhone(raw);
    if (!phone) {
      setMatch(null);
      phoneCheck.current.checked = "";
      return;
    }
    if (phone === phoneCheck.current.checked) return;
    phoneCheck.current.checked = phone;
    const seq = ++phoneCheck.current.seq;
    try {
      const result = await checkPhoneAction({ church, phone });
      if (seq !== phoneCheck.current.seq) return;
      setMatch(result.ok && result.status === "match" ? result.match : null);
    } catch {
      // The save repeats the check on the server, so a failed lookup is not fatal.
      phoneCheck.current.checked = "";
    }
  }

  function onPhoneChange(raw: string) {
    update("phone", raw);
    if (normalizePhone(raw)) {
      void checkPhone(raw);
    } else {
      phoneCheck.current.seq++;
      phoneCheck.current.checked = "";
      setMatch(null);
    }
  }

  function chooseSource(source: HeardViaSource) {
    touch("heardViaSource");
    setServerErrors((errors) => {
      const next = { ...errors };
      delete next.heardViaSource;
      return next;
    });
    setValues((v) => ({
      ...v,
      heardViaSource: v.heardViaSource === source ? null : source,
      heardViaDetail: "",
    }));
  }

  function focusFirstError(errors: NewcomerFieldErrors) {
    const first = FIELD_ORDER.find((field) => errors[field]);
    if (first) document.getElementById(`newcomer-${first}`)?.focus();
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    setSubmitted(true);
    setFormError(null);

    const validation = validateNewcomerForm(values);
    if (!validation.ok) {
      focusFirstError(validation.errors);
      return;
    }

    busy.current = true;
    setPending("save");
    try {
      const result = await addNewcomerAction({ church, values });
      if (result.ok) {
        const name = `${validation.data.firstName} ${validation.data.lastName}`;
        saveAttendanceFlash({
          message: result.marked
            ? `${name} added and marked present`
            : `${name} added. Tick them on the list to mark them present.`,
          query: name,
        });
        router.push(`/${church}/attendance`);
        return; // Stay busy so the form cannot be submitted again while leaving.
      }
      if (result.code === "invalid-fields") {
        setServerErrors(result.fieldErrors);
        focusFirstError(result.fieldErrors);
      } else if (result.code === "duplicate") {
        setMatch(result.match);
        document.getElementById("newcomer-phone")?.focus();
      } else {
        setFormError(result.error);
        if (result.code === "window-closed") router.refresh();
      }
    } catch {
      setFormError("Could not reach the server. They have not been added yet.");
    }
    busy.current = false;
    setPending(null);
  }

  async function tickInstead() {
    if (busy.current || !match) return;
    busy.current = true;
    setPending("tick");
    setFormError(null);
    try {
      const result = await tickExistingAction({ church, phone: values.phone });
      if (result.ok) {
        saveAttendanceFlash({
          message: `${result.match.firstName} ${result.match.lastInitial}. marked present`,
          query: result.match.firstName,
        });
        router.push(`/${church}/attendance`);
        return;
      }
      setFormError(result.error);
      if (result.code === "window-closed") router.refresh();
    } catch {
      setFormError("Could not reach the server. Please try again.");
    }
    busy.current = false;
    setPending(null);
  }

  const selected = HEARD_VIA_OPTIONS.find((o) => o.source === values.heardViaSource);
  const describedBy = (field: NewcomerField) =>
    errorFor(field) ? `newcomer-${field}-error` : undefined;

  const textInput = (
    field: "firstName" | "lastName" | "email" | "occupation" | "heardViaDetail",
    props: InputHTMLAttributes<HTMLInputElement>,
  ) => (
    <input
      id={`newcomer-${field}`}
      value={values[field]}
      onChange={(e) => update(field, e.target.value)}
      onBlur={() => touch(field)}
      aria-invalid={errorFor(field) ? true : undefined}
      aria-describedby={describedBy(field)}
      className={inputClass(Boolean(errorFor(field)))}
      {...props}
    />
  );

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5 px-4 pt-5 pb-28">
      <FormField id="newcomer-firstName" label="First name" required error={errorFor("firstName")}>
        {textInput("firstName", {
          autoComplete: "off",
          autoCapitalize: "words",
          "aria-required": true,
        })}
      </FormField>

      <FormField id="newcomer-lastName" label="Last name" required error={errorFor("lastName")}>
        {textInput("lastName", {
          autoComplete: "off",
          autoCapitalize: "words",
          "aria-required": true,
        })}
      </FormField>

      <div>
        <FormField id="newcomer-phone" label="Phone number" required error={errorFor("phone")}>
          <input
            id="newcomer-phone"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            aria-required
            value={values.phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            onBlur={() => {
              touch("phone");
              void checkPhone(values.phone);
            }}
            aria-invalid={errorFor("phone") ? true : undefined}
            aria-describedby={describedBy("phone")}
            className={inputClass(Boolean(errorFor("phone")))}
          />
        </FormField>

        <div aria-live="polite">
          {match && (
            <div className="mt-3 rounded-card bg-warning-light px-3.5 py-3 text-[15px] text-warning">
              <p>
                This number matches {match.firstName} {match.lastInitial}. on the {match.list} list.
              </p>
              <button
                type="button"
                onClick={tickInstead}
                disabled={pending !== null}
                className="-mx-1 mt-1 min-h-11 px-1 text-left font-semibold text-primary focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
              >
                {pending === "tick" ? "Ticking…" : "Tick them instead →"}
              </button>
            </div>
          )}
        </div>
      </div>

      <FormField id="newcomer-email" label="Email" required error={errorFor("email")}>
        {textInput("email", {
          type: "email",
          inputMode: "email",
          autoComplete: "off",
          autoCapitalize: "none",
          spellCheck: false,
          "aria-required": true,
        })}
      </FormField>

      <fieldset>
        <legend className="mb-2 text-[15px] font-medium text-ink">Birthday (month and day)</legend>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="newcomer-birthdayMonth" className="sr-only">
              Birthday month
            </label>
            <select
              id="newcomer-birthdayMonth"
              value={values.birthdayMonth}
              onChange={(e) => update("birthdayMonth", e.target.value)}
              onBlur={() => touch("birthdayMonth")}
              aria-invalid={errorFor("birthdayMonth") ? true : undefined}
              aria-describedby={describedBy("birthdayMonth")}
              className={`${inputClass(Boolean(errorFor("birthdayMonth")))} ${
                values.birthdayMonth === "" ? "text-muted" : ""
              }`}
            >
              <option value="">Month</option>
              {MONTHS.map((month, index) => (
                <option key={month} value={String(index + 1)}>
                  {month}
                </option>
              ))}
            </select>
            <FieldError id="newcomer-birthdayMonth-error" message={errorFor("birthdayMonth")} />
          </div>
          <div>
            <label htmlFor="newcomer-birthdayDay" className="sr-only">
              Birthday day
            </label>
            <input
              id="newcomer-birthdayDay"
              inputMode="numeric"
              autoComplete="off"
              maxLength={2}
              placeholder="Day"
              value={values.birthdayDay}
              onChange={(e) => update("birthdayDay", e.target.value)}
              onBlur={() => touch("birthdayDay")}
              aria-invalid={errorFor("birthdayDay") ? true : undefined}
              aria-describedby={describedBy("birthdayDay")}
              className={inputClass(Boolean(errorFor("birthdayDay")))}
            />
            <FieldError id="newcomer-birthdayDay-error" message={errorFor("birthdayDay")} />
          </div>
        </div>
      </fieldset>

      <FormField id="newcomer-occupation" label="Occupation" error={errorFor("occupation")}>
        {textInput("occupation", { autoComplete: "off" })}
      </FormField>

      <fieldset aria-describedby={describedBy("heardViaSource")}>
        <legend className="mb-2 text-[15px] font-medium text-ink">
          How did you hear about us?
          <span aria-hidden="true"> *</span>
          <span className="sr-only"> (required)</span>
        </legend>
        <div className="flex flex-wrap gap-2 py-2">
          {HEARD_VIA_OPTIONS.map((option, index) => (
            <Chip
              key={option.source}
              id={index === 0 ? "newcomer-heardViaSource" : undefined}
              pressed={values.heardViaSource === option.source}
              onClick={() => chooseSource(option.source)}
              describedBy={describedBy("heardViaSource")}
            >
              {option.label}
            </Chip>
          ))}
        </div>
        <FieldError id="newcomer-heardViaSource-error" message={errorFor("heardViaSource")} />
      </fieldset>

      {selected?.detailLabel && (
        <FormField
          id="newcomer-heardViaDetail"
          label={selected.detailLabel}
          error={errorFor("heardViaDetail")}
        >
          {textInput("heardViaDetail", { autoComplete: "off" })}
        </FormField>
      )}

      <label className="flex min-h-11 cursor-pointer items-start gap-3 text-[15px] text-ink">
        <input
          type="checkbox"
          checked={values.consentToMessages}
          onChange={(e) => update("consentToMessages", e.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-primary"
        />
        <span>Agreed to receive messages from the church</span>
      </label>

      <p className="text-[14px] text-muted">
        Saving adds them to the newcomers list and marks them present.
      </p>

      <div role="alert">
        {formError && (
          <p className="rounded-card bg-warning-light px-3.5 py-3 text-[15px] text-warning">
            {formError}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending !== null}
        aria-busy={pending === "save" || undefined}
        className="h-[52px] w-full rounded-card bg-primary px-4 text-[17px] font-semibold text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending === "save" ? "Saving…" : "Save and mark present"}
      </button>
    </form>
  );
}
