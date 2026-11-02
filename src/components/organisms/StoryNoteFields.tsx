import React from "react";
import { NOTE_MAX } from "@/lib/supabase";
import { FormBlock, Field } from "@/components/ui/form-field";

export type StoryNoteDraft = { en: string; ro: string };
export const EMPTY_NOTE: StoryNoteDraft = { en: "", ro: "" };

/**
 * Whether a save should include the note: always for a story read with the
 * note columns (so clearing it clears it), otherwise only once something has
 * been written — the same rule as shouldSendPlaceDate.
 */
export const shouldSendNote = (note: StoryNoteDraft, supported: boolean): boolean =>
  supported || !!note.en.trim() || !!note.ro.trim();

const hint: React.CSSProperties = { color: "var(--text-mute)" };

/** "About this story": an optional note shown beside the story. */
export const StoryNoteFields: React.FC<{
  value: StoryNoteDraft;
  onChange: (next: StoryNoteDraft) => void;
  language: "en" | "ro";
}> = ({ value, onChange, language }) => {
  const en = language === "en";
  return (
    <FormBlock title={en ? "About this story (optional)" : "Despre această poveste (opțional)"}>
      <p className="m-0" style={{ fontSize: 15, color: "var(--text-dim)", lineHeight: 1.55 }}>
        {en
          ? "A few lines of context, shown beside the story: where it was written, what it answers to, why it matters."
          : "Câteva rânduri de context, afișate lângă poveste: unde a fost scrisă, la ce răspunde, de ce contează."}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label={en ? "English" : "Engleză"}>
          <textarea rows={4} value={value.en} maxLength={NOTE_MAX} onChange={(e) => onChange({ ...value, en: e.target.value })} style={{ resize: "vertical" }} />
          <p className="font-ui text-[12px] mt-1.5" style={hint}>{value.en.length} / {NOTE_MAX}</p>
        </Field>
        <Field label={en ? "Romanian" : "Română"}>
          <textarea rows={4} value={value.ro} maxLength={NOTE_MAX} onChange={(e) => onChange({ ...value, ro: e.target.value })} style={{ resize: "vertical" }} />
          <p className="font-ui text-[12px] mt-1.5" style={hint}>{value.ro.length} / {NOTE_MAX}</p>
        </Field>
      </div>
    </FormBlock>
  );
};
