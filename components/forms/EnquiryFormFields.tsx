"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  CONFIRMATION,
  FORMS,
  SELECT_PLACEHOLDER,
  SUBMIT,
  isVisible,
  validate,
  type EnquiryType,
  type Errors,
  type FieldDef,
  type Values,
} from "./definitions";

type Props = { type: EnquiryType; studio?: number | string; phone: string; email: string };
type State = "idle" | "sending" | "sent" | "failed";

const ENDPOINT = "/forms/enquiry";
/** A field no person sees or fills; whatever fills it is a bot. */
const TRAP = "company_url";

const control =
  "block w-full min-h-12 rounded-[14px] border bg-white px-4 py-3 text-base text-ink placeholder:text-ink-soft/70 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-deep disabled:opacity-60";

/** "(778) 898-3414" → "tel:+17788983414" (ten digits are a Canadian number). */
function telHref(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  return `tel:${/^\d{10}$/.test(digits) ? `+1${digits}` : digits}`;
}

export function EnquiryFormFields({ type, studio, phone, email }: Props) {
  const fields = FORMS[type];
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;
  const [values, setValues] = useState<Values>({});
  const [errors, setErrors] = useState<Errors>({});
  const [state, setState] = useState<State>("idle");
  const [notice, setNotice] = useState("");
  const trap = useRef<HTMLInputElement>(null);
  const done = useRef<HTMLDivElement>(null);
  const alert = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state === "sent") done.current?.focus();
    if (state === "failed") alert.current?.focus();
  }, [state]);

  const set = (name: string, value: string) => {
    setValues((v) => ({ ...v, [name]: value }));
    if (errors[name]) setErrors(({ [name]: _fixed, ...rest }) => rest);
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "sending") return;
    const checked = validate(type, values);
    setErrors(checked.errors);
    const firstBad = fields.find((f) => checked.errors[f.name]);
    if (firstBad) {
      setState("idle");
      document.getElementById(id(firstBad.name))?.focus();
      return;
    }
    setState("sending");
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type,
          studio,
          page: window.location.pathname,
          values: checked.values,
          [TRAP]: trap.current?.value || "",
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; errors?: Errors };
      if (res.ok && json.ok) {
        setState("sent");
        return;
      }
      if (res.status === 400 && json.errors) {
        setErrors(json.errors);
        setState("idle");
        const bad = fields.find((f) => json.errors![f.name]);
        if (bad) document.getElementById(id(bad.name))?.focus();
        return;
      }
      // too many requests: the server says when to try again; anything else is a failure on our side
      setNotice(res.status === 429 && json.message ? json.message : "");
      setState("failed");
    } catch {
      setNotice("");
      setState("failed");
    }
  }

  if (state === "sent") {
    return (
      <div
        ref={done}
        tabIndex={-1}
        role="status"
        data-enquiry-sent={type}
        className="rounded-[20px] border border-clay-200 bg-clay-100 px-5 py-6 text-ink outline-none"
      >
        <p className="display text-xl">{CONFIRMATION[type]}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      data-enquiry-form={type}
      className="grid max-w-xl grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2"
    >
      {fields.map((field) => {
        const shown = isVisible(field, values);
        return (
          <div key={field.name} hidden={!shown} className={field.half ? "" : "sm:col-span-2"}>
            <label htmlFor={id(field.name)} className="mb-1.5 block text-sm font-semibold text-ink">
              {field.label}
              {field.required && <span aria-hidden="true"> *</span>}
            </label>
            <Control
              field={field}
              id={id(field.name)}
              value={values[field.name] || ""}
              error={errors[field.name]}
              disabled={!shown}
              onChange={(v) => set(field.name, v)}
            />
            {errors[field.name] && (
              <p id={`${id(field.name)}-error`} className="mt-1.5 text-sm font-medium text-red-800">
                {errors[field.name]}
              </p>
            )}
          </div>
        );
      })}

      {/* bot trap: off-screen, out of the tab order and of the accessibility tree */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={id(TRAP)}>Company website (leave this empty)</label>
        <input ref={trap} id={id(TRAP)} name={TRAP} type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      {state === "failed" && (
        <div
          ref={alert}
          tabIndex={-1}
          role="alert"
          data-enquiry-failed
          className="rounded-[14px] border border-red-800/40 bg-white px-4 py-3 text-ink outline-none sm:col-span-2"
        >
          {notice || "We couldn't send your message."}{" "}
          {phone && email ? (
            <>
              Please call us at{" "}
              <a className="font-semibold underline" href={telHref(phone)}>
                {phone}
              </a>{" "}
              or email{" "}
              <a className="font-semibold underline" href={`mailto:${email}`}>
                {email}
              </a>
              .
            </>
          ) : phone || email ? (
            <>
              Please contact us at{" "}
              <a className="font-semibold underline" href={phone ? telHref(phone) : `mailto:${email}`}>
                {phone || email}
              </a>
              .
            </>
          ) : (
            "Please try again later."
          )}{" "}
          What you typed is still here.
        </div>
      )}

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={state === "sending"}
          className="flex h-13 min-w-40 items-center justify-center rounded-full bg-terracotta px-7 text-[0.9rem] font-semibold text-clay-50 transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-deep disabled:opacity-70"
        >
          {state === "sending" ? "Sending…" : SUBMIT}
        </button>
      </div>
    </form>
  );
}

function Control({
  field,
  id,
  value,
  error,
  disabled,
  onChange,
}: {
  field: FieldDef;
  id: string;
  value: string;
  error?: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const shared = {
    id,
    name: field.name,
    value,
    disabled,
    required: field.required,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
    className: `${control} ${error ? "border-red-800" : "border-clay-200"}`,
  };
  if (field.kind === "select") {
    return (
      <select {...shared} onChange={(e) => onChange(e.target.value)}>
        <option value="">{SELECT_PLACEHOLDER}</option>
        {field.options!.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }
  if (field.kind === "textarea") {
    return (
      <textarea
        {...shared}
        rows={4}
        maxLength={5000}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return (
    <input
      {...shared}
      type={field.kind}
      maxLength={300}
      min={field.kind === "number" ? 1 : undefined}
      inputMode={field.kind === "number" ? "numeric" : undefined}
      autoComplete={field.kind === "email" ? "email" : field.kind === "tel" ? "tel" : field.name === "name" ? "name" : "off"}
      placeholder={field.placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
