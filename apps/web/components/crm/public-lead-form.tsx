"use client";

import { useState } from "react";
import type { LeadFormField } from "@/lib/validations/crm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2 } from "lucide-react";

interface PublicLeadFormProps {
  token: string;
  fields: LeadFormField[];
}

/**
 * The interactive part of the public lead-capture page. It renders the form's
 * field list, posts the values to `/api/forms/<token>`, and shows the form's
 * success message on a 200. Field-level errors returned by the API (422) are
 * surfaced inline.
 */
export function PublicLeadForm({ token, fields }: PublicLeadFormProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  // Hidden honeypot — a real visitor never fills it; a bot does.
  const [honeypot, setHoneypot] = useState("");

  const setValue = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setErrors({});

    try {
      const res = await fetch(`/api/forms/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values, website: honeypot }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        error?: string;
        fields?: Record<string, string>;
      };

      if (res.ok && body.ok) {
        setSuccess(body.message ?? "Obrigado! Recebemos seu contato.");
        return;
      }
      if (res.status === 422 && body.fields) {
        setErrors(body.fields);
        setFormError("Verifique os campos destacados.");
        return;
      }
      setFormError(body.error ?? "Não foi possível enviar. Tente novamente.");
    } catch {
      setFormError("Falha de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <CheckCircle2 className="size-10 text-emerald-500" />
        <p className="text-sm">{success}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {fields.map((field) => {
        const id = `field-${field.key}`;
        return (
          <div key={field.key} className="grid gap-1.5">
            <Label htmlFor={id}>
              {field.label}
              {field.required && <span className="text-destructive"> *</span>}
            </Label>
            {field.type === "textarea" ? (
              <Textarea
                id={id}
                value={values[field.key] ?? ""}
                onChange={(e) => setValue(field.key, e.target.value)}
                required={field.required}
              />
            ) : field.type === "select" ? (
              <select
                id={id}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                value={values[field.key] ?? ""}
                onChange={(e) => setValue(field.key, e.target.value)}
                required={field.required}
              >
                <option value="">Selecione...</option>
                {(field.options ?? []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                id={id}
                type={
                  field.type === "email"
                    ? "email"
                    : field.type === "tel"
                      ? "tel"
                      : "text"
                }
                value={values[field.key] ?? ""}
                onChange={(e) => setValue(field.key, e.target.value)}
                required={field.required}
              />
            )}
            {errors[field.key] && (
              <p className="text-xs text-destructive">{errors[field.key]}</p>
            )}
          </div>
        );
      })}

      {/* Honeypot: visually hidden, off-screen, not announced to humans. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="website">Não preencha este campo</label>
        <input
          id="website"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      {formError && <p className="text-sm text-destructive">{formError}</p>}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Enviando..." : "Enviar"}
      </Button>
    </form>
  );
}
