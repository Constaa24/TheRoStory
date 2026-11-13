import React, { useState } from "react";
import { FormBlock } from "@/components/ui/form-field";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type Lang = "en" | "ro";
export type PublishStatus = "draft" | "scheduled" | "published";

/** An instant as a datetime-local value (the editor's own clock, to the minute), and back. */
export const toLocalInput = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const fromLocalInput = (value: string): string | null => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

export const statusFrom = (published: boolean, publishAt: string): PublishStatus =>
  published ? "published" : publishAt ? "scheduled" : "draft";

/** What is wrong with the schedule, or null. Only a scheduled story has one. */
export const scheduleProblem = (published: boolean, publishAt: string, language: Lang, now = Date.now()): string | null => {
  if (published || !publishAt) return null;
  const iso = fromLocalInput(publishAt);
  if (!iso) return language === "en" ? "Choose the day and time it should go out." : "Alege ziua și ora la care să apară.";
  if (new Date(iso).getTime() <= now) {
    return language === "en" ? "That time has passed. Choose a later one, or publish it now." : "Ora aceea a trecut. Alege una mai târzie sau publică acum.";
  }
  return null;
};

/**
 * The publish_at to save, or undefined to leave the column alone: sent when
 * the story is scheduled, and to clear a schedule the loaded story had.
 * (A database from before migration 20261110120000 has no such column, and
 * a story that was never scheduled never mentions it.)
 */
export const publishAtToSave = (published: boolean, publishAt: string, hadSchedule: boolean): string | null | undefined => {
  const iso = published ? null : fromLocalInput(publishAt);
  if (iso) return iso;
  return hadSchedule ? null : undefined;
};

export type CheckItem = { label: string; done: boolean };

const STATUS: Record<Lang, Record<PublishStatus, string>> = {
  en: { draft: "Draft", scheduled: "Scheduled", published: "Published" },
  ro: { draft: "Ciornă", scheduled: "Programată", published: "Publicată" },
};

/**
 * "Publishing" (the redesign's StoryEditor): a story is a draft, scheduled
 * for a time, or published, and a short list says what a finished story
 * usually has. Only an editor (admin) sets the status; the database holds
 * everyone else to that. The list advises, it doesn't forbid: some stories
 * have no single place on the map, and say so.
 */
export const PublishingFields: React.FC<{
  language: Lang;
  isAdmin: boolean;
  published: boolean;
  onPublished: (published: boolean) => void;
  /** A datetime-local value, or "" when not scheduled. */
  publishAt: string;
  onPublishAt: (value: string) => void;
  checklist: CheckItem[];
  showErrors?: boolean;
}> = ({ language, isAdmin, published, onPublished, publishAt, onPublishAt, checklist, showErrors }) => {
  const en = language === "en";
  const status = statusFrom(published, publishAt);
  // Shown as soon as it is true: a time already past is never a surprise at save.
  const shown = showErrors === false ? null : scheduleProblem(published, publishAt, language);

  // Choosing "Scheduled" proposes tomorrow at nine, so the choice always
  // carries a time; clearing the time makes the story a draft again.
  const pick = (next: PublishStatus) => {
    onPublished(next === "published");
    if (next !== "scheduled") onPublishAt("");
    else if (!publishAt) {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      onPublishAt(toLocalInput(d.toISOString()));
    }
  };

  return (
    <FormBlock title={en ? "Publishing" : "Publicare"}>
      {isAdmin ? (
        <>
          <fieldset className="m-0 p-0 border-0">
            <legend className="rs-field-label" style={{ marginBottom: 8 }}>{en ? "Status" : "Stare"}</legend>
            <div className="flex flex-wrap gap-2">
              {(["draft", "scheduled", "published"] as const).map((s) => (
                <label key={s} className="rs-radio-chip" style={{ marginBottom: 0 }}>
                  <input type="radio" name="publish-status" value={s} checked={status === s} onChange={() => pick(s)} />
                  <span className="rs-radio-face">{STATUS[language][s]}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {status === "scheduled" && (
            <div className="flex flex-col">
              <label htmlFor="publish-at" style={{ marginBottom: 8 }}>{en ? "Publish at" : "Publică la"}</label>
              <input
                id="publish-at"
                type="datetime-local"
                value={publishAt}
                min={toLocalInput(new Date().toISOString())}
                onChange={(e) => onPublishAt(e.target.value)}
                className="rs-desk-input"
                aria-describedby="publish-at-hint"
                aria-invalid={shown ? true : undefined}
              />
              <p id="publish-at-hint" className="font-ui text-[12.5px] mt-1.5 mb-0" style={{ color: shown ? "var(--danger)" : "var(--text-mute)" }}>
                {shown
                  ? shown
                  : (en ? "Your own clock. It goes live within five minutes of this, at the top of the home page." : "Ora ta locală. Apare în cel mult cinci minute după aceea, în capul paginii principale.")}
              </p>
            </div>
          )}
          <p className="font-ui text-[13px] m-0" style={{ color: "var(--text-mute)" }}>
            {status === "published"
              ? (en ? "Readers can see it." : "Cititorii o pot vedea.")
              : status === "scheduled"
                ? (en ? "A draft until then." : "Ciornă până atunci.")
                : (en ? "Only you and the other editors can see it." : "O vedeți doar tu și ceilalți editori.")}
          </p>
        </>
      ) : (
        <p className="font-ui text-[13px] m-0" style={{ color: "var(--text-mute)" }}>
          {published
            ? (en ? "Published. Your changes go live when you save." : "Publicată. Modificările apar când salvezi.")
            : (en ? "A draft. An editor publishes it." : "Ciornă. O publică un editor.")}
        </p>
      )}

      <div>
        <p className="rs-field-label m-0" style={{ marginBottom: 8 }}>{en ? "Before it goes out" : "Înainte de publicare"}</p>
        <ul className="list-none m-0 p-0 grid grid-cols-1 gap-1.5">
          {checklist.map((c) => (
            <li key={c.label} className="flex items-center gap-2.5 font-ui text-[13px]" style={{ color: c.done ? "var(--text)" : "var(--text-mute)" }}>
              <span aria-hidden="true" className="rs-check-knot" data-done={c.done ? "" : undefined} />
              {c.label}
              <span className="sr-only">{c.done ? (en ? " (done)" : " (gata)") : (en ? " (missing)" : " (lipsește)")}</span>
            </li>
          ))}
        </ul>
      </div>
    </FormBlock>
  );
};

/**
 * Asks once before a story goes out with something on the list missing.
 * `guard(save)` runs `save` straight away when there is nothing to ask.
 */
export const usePublishGuard = (opts: { language: Lang; goingOut: boolean; scheduled: boolean; checklist: CheckItem[] }) => {
  const { language, goingOut, scheduled, checklist } = opts;
  const en = language === "en";
  const [pending, setPending] = useState<(() => void) | null>(null);
  const missing = checklist.filter((c) => !c.done);

  const guard = (save: () => void) => {
    if (goingOut && missing.length > 0) setPending(() => save);
    else save();
  };

  const dialog = (
    <AlertDialog open={!!pending} onOpenChange={(open) => { if (!open) setPending(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{en ? "A few things are missing." : "Lipsesc câteva lucruri."}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>
              <p className="m-0 mb-2">{en ? "This story would go out without:" : "Povestea ar apărea fără:"}</p>
              <ul className="m-0 pl-5 list-disc">
                {missing.map((c) => <li key={c.label}>{c.label}</li>)}
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{en ? "Keep editing" : "Continuă editarea"}</AlertDialogCancel>
          <Button onClick={() => { const save = pending; setPending(null); save?.(); }}>
            {scheduled ? (en ? "Schedule anyway" : "Programează oricum") : (en ? "Publish anyway" : "Publică oricum")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { guard, dialog };
};
