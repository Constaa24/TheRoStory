import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Article, Journey, fetchArticleCardsByIds, fetchJourneys, fetchNearbyArticles, getLocalized } from "@/lib/supabase";
import { articleCoverUrl, joinMeta, toneFor } from "@/lib/article-utils";
import { kindPhrase, pinOf, placeOf, whenOf } from "@/lib/story-facts";
import { storageImage } from "@/lib/image-url";
import { cn } from "@/lib/utils";
import { Divider } from "@/components/story/Ornaments";
import { MiniMap } from "@/components/story/MiniMap";

type Lang = "en" | "ro";

export type JourneyStop = {
  journey: Journey;
  /** This story's position, 0-based. */
  index: number;
  prev: Article | null;
  next: Article | null;
};

/**
 * What surrounds a story: up to two others from the same county, and the
 * journey it is a stop on (with its neighbours). Both are optional garnish —
 * a failure leaves the card off rather than troubling the reader.
 */
export const useStoryNeighbours = (article: Pick<Article, "id" | "location">) => {
  const [nearby, setNearby] = useState<Article[]>([]);
  const [journey, setJourney] = useState<JourneyStop | null>(null);

  useEffect(() => {
    let cancelled = false;
    setNearby([]);
    setJourney(null);
    if (article.location) {
      fetchNearbyArticles(article.location, article.id, 2)
        .then((rows) => { if (!cancelled) setNearby(rows); })
        .catch(() => {});
    }
    (async () => {
      const journeys = await fetchJourneys();
      const found = journeys.find((j) => j.stops.includes(article.id));
      if (!found) return;
      const index = found.stops.indexOf(article.id);
      const ids = [found.stops[index - 1], found.stops[index + 1]].filter((x): x is string => !!x);
      const cards = await fetchArticleCardsByIds(ids);
      const byId = new Map(cards.map((c) => [c.id, c]));
      if (cancelled) return;
      setJourney({
        journey: found,
        index,
        prev: byId.get(found.stops[index - 1]) ?? null,
        next: byId.get(found.stops[index + 1]) ?? null,
      });
    })().catch(() => {});
    return () => { cancelled = true; };
  }, [article.id, article.location]);

  return { nearby, journey };
};

/** "Where & when": the outline with the story's pin, its place and its dates. */
export const PlaceCard: React.FC<{
  article: Article;
  language: Lang;
  label?: string;
  /** "row": the map beside the words, for a wide card under a story. */
  layout?: "stack" | "row";
  className?: string;
}> = ({ article, language, label, layout = "stack", className }) => {
  const en = language === "en";
  const pin = pinOf(article);
  const place = placeOf(article, language);
  const when = whenOf(article, language);
  if (!place && !when) return null;

  const county = article.location && article.location !== place ? article.location : null;
  const meta = !pin && article.timeless
    ? (en ? "No single place, no single year — a legend." : "Niciun loc anume, niciun an anume — o legendă.")
    : joinMeta([county, when]);

  return (
    <Link
      to={`/map?story=${article.id}`}
      className={cn("sb-place-card transition-colors hover:border-[color:var(--gold-deep)]", layout === "row" && "sm:grid-cols-[150px_minmax(0,1fr)_auto] sm:items-center sm:gap-6", className)}
    >
      {layout === "stack" && <p className="sb-kicker-sm">{label ?? (en ? "Where & when" : "Unde și când")}</p>}
      {pin && <MiniMap stories={[article]} className={layout === "row" ? "max-w-[220px] sm:max-w-none" : undefined} />}
      <span className="flex flex-col gap-1">
        {layout === "row" && <span className="sb-kicker-sm">{label ?? (en ? "Where it happened" : "Unde s-a petrecut")}</span>}
        <span className="sb-h4">{place ?? when}</span>
        {meta && place && <span className="sb-meta">{meta}</span>}
      </span>
      <span className="sb-btn-word" style={{ fontSize: 19 }}>{en ? "See it on the map →" : "Vezi pe hartă →"}</span>
    </Link>
  );
};

/** A small linked line for another story: arch thumb, what and when, title. */
const StoryLine: React.FC<{ story: Article; language: Lang; meta?: string; from: string }> = ({ story, language, meta, from }) => {
  const cover = storageImage(articleCoverUrl(story), "thumb");
  return (
    <Link to={`/article/${story.id}`} state={{ from }} className="sb-card grid items-center gap-3" style={{ gridTemplateColumns: "52px minmax(0, 1fr)" }}>
      <span className="sb-arch sb-arch-thumb block" style={{ aspectRatio: "1" }}>
        {cover ? <img src={cover} alt="" loading="lazy" /> : <span className="ph absolute inset-0" data-tone={toneFor(story.id)} style={{ border: 0 }} />}
      </span>
      <span className="flex flex-col gap-0.5 min-w-0">
        <span className="sb-meta">{meta ?? joinMeta([kindPhrase(story, language), whenOf(story, language)])}</span>
        <span className="font-display italic leading-tight" style={{ fontSize: 18, color: "var(--parchment)" }}>
          {getLocalized(story, "title", language)}
        </span>
      </span>
    </Link>
  );
};

/** Other stories from the same county. */
export const NearbyCard: React.FC<{ county: string; stories: Article[]; language: Lang; from: string }> = ({ county, stories, language, from }) => {
  if (!stories.length) return null;
  return (
    <div className="sb-place-card" style={{ gap: 12 }}>
      <p className="sb-kicker-sm">{language === "en" ? `Also in ${county}` : `Tot în ${county}`}</p>
      {stories.map((s) => <StoryLine key={s.id} story={s} language={language} from={from} />)}
    </div>
  );
};

/** "On a journey · stop 2 of 3" — the stops either side, and the way back to the map. */
export const JourneyCard: React.FC<{ stop: JourneyStop; language: Lang; from: string; showIntro?: boolean }> = ({ stop, language, from, showIntro }) => {
  const en = language === "en";
  const { journey, index, prev, next } = stop;
  const intro = getLocalized(journey, "intro", language);
  const where = (s: Article) => placeOf(s, language) || whenOf(s, language) || (en ? "across the country" : "în toată țara");
  return (
    <div className="sb-place-card">
      <p className="sb-kicker-sm">
        {en ? `On a journey · stop ${index + 1} of ${journey.stops.length}` : `Într-o călătorie · oprirea ${index + 1} din ${journey.stops.length}`}
      </p>
      <p className="sb-h4">{getLocalized(journey, "title", language)}</p>
      {showIntro && intro && <p className="sb-dim text-[16px] leading-relaxed">{intro}</p>}
      {(prev || next) && <Divider small />}
      {prev && <StoryLine story={prev} language={language} from={from} meta={`${en ? "Before" : "Înainte"} · ${where(prev)}`} />}
      {next && <StoryLine story={next} language={language} from={from} meta={`${en ? "Next" : "Urmează"} · ${where(next)}`} />}
      <Link to={`/map?journey=${journey.id}&stop=${index + 1}`} className="sb-btn justify-self-start mt-1">
        {en ? "Continue the journey →" : "Continuă călătoria →"}
      </Link>
    </div>
  );
};

/** The writer's own note about the story (articles.note_en / note_ro). */
export const NoteCard: React.FC<{ article: Article; language: Lang; label?: string }> = ({ article, language, label }) => {
  const own = (language === "ro" ? article.noteRo : article.noteEn)?.trim();
  const other = (language === "ro" ? article.noteEn : article.noteRo)?.trim();
  const text = own || other;
  if (!text) return null;
  return (
    <div className="sb-place-card" style={{ gap: 10 }}>
      <p className="sb-kicker-sm">{label ?? (language === "en" ? "About this story" : "Despre această poveste")}</p>
      <div lang={own ? language : language === "en" ? "ro" : "en"} className="grid gap-2.5">
        {text.split(/\n+/).map((p, i) => (
          <p key={i} className="sb-dim m-0" style={{ fontSize: 16.5, lineHeight: 1.6 }}>{p}</p>
        ))}
      </div>
    </div>
  );
};
