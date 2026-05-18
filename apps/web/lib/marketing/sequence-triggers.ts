import type { SequenceTrigger } from "@/lib/validations/marketing";

/**
 * Triggers offered when creating a sequence. `segment_entry` is intentionally
 * excluded: there is no scheduled job that auto-enrolls a segment's members,
 * so promising it in the UI would be a broken affordance.
 */
export const SELECTABLE_SEQUENCE_TRIGGERS: SequenceTrigger[] = ["manual"];

/**
 * Resolves the trigger options to show in the sequence form select.
 *
 * Returns the supported triggers, plus `current` when it is an otherwise
 * unsupported value — so editing a legacy sequence created with an old
 * trigger keeps that value visible (and its label renders) instead of
 * silently switching it.
 */
export function sequenceTriggerOptions(
  current: SequenceTrigger
): SequenceTrigger[] {
  return SELECTABLE_SEQUENCE_TRIGGERS.includes(current)
    ? [...SELECTABLE_SEQUENCE_TRIGGERS]
    : [...SELECTABLE_SEQUENCE_TRIGGERS, current];
}
