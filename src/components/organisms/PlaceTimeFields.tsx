import React, { useRef, useState } from "react";
import geo from "@/lib/atlas/atlas-geo.json";
import { invert, project, PLATE_H, PLATE_W } from "@/lib/atlas/projection";
import { COUNTY_GEO, countyAt, countyBBox } from "@/lib/atlas/model";
import { formatCoords, parseCoords, type PlaceDateDraft } from "@/lib/atlas/place-date";
import { PLACE_DATE_LIMITS } from "@/lib/supabase";
import { FormBlock, Field } from "@/components/ui/form-field";

type Props = {
  value: PlaceDateDraft;
  onChange: (next: PlaceDateDraft) => void;
  /** The story's county (the editor's Location field). */
  county: string;
  onCountyChange: (county: string) => void;
  /** The message to show under a field, when errors are being shown. */
  errorFor: (field: string) => string | undefined;
  language: "en" | "ro";
};

const hint: React.CSSProperties = { color: "var(--text-mute)" };

/**
 * Click-to-pin map of Romania. Zooms to the story's county when it has one,
 * so a pin can be put on a street rather than a region; clicking inside
 * another county moves the story's county with it. Mouse-only by nature —
 * the coordinates field beside it is the keyboard route to the same value.
 */
const PinPicker: React.FC<{
  coords: { lat: number; lng: number } | null;
  county: string;
  onPick: (lat: number, lng: number) => void;
  language: "en" | "ro";
}> = ({ coords, county, onPick, language }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [wholeCountry, setWholeCountry] = useState(false);
  const box = county && !wholeCountry ? countyBBox(county) : null;
  const pad = box ? Math.max(box[2] - box[0], box[3] - box[1]) * 0.12 : 0;
  const vb = box
    ? [box[0] - pad, box[1] - pad, box[2] - box[0] + 2 * pad, box[3] - box[1] + 2 * pad]
    : [0, 0, PLATE_W, PLATE_H];
  const unit = vb[2] / 100; // pin and stroke sizes track the zoom
  const pin = coords ? project(coords.lng, coords.lat) : null;

  const onClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    const [lng, lat] = invert(pt.x, pt.y);
    onPick(lat, lng);
  };

  return (
    <div className="flex flex-col gap-2">
      <svg
        ref={svgRef}
        viewBox={vb.join(" ")}
        role="img"
        aria-label={language === "en" ? "Map of Romania: click to place the story's pin" : "Harta României: apasă pentru a fixa reperul poveștii"}
        onClick={onClick}
        style={{ width: "100%", aspectRatio: "10 / 7", cursor: "crosshair", border: "1px solid var(--line)", background: "var(--ink-2)", display: "block" }}
      >
        <path d={geo.nation} fill="rgba(var(--line-rgb), 0.07)" />
        {COUNTY_GEO.map((c) => (
          <path
            key={c.name}
            d={c.d}
            fill={c.name === county ? "rgba(var(--line-rgb), 0.22)" : "transparent"}
            stroke="rgba(var(--line-rgb), 0.45)"
            strokeWidth={unit * 0.12}
            strokeLinejoin="round"
          />
        ))}
        <path d={geo.nation} fill="none" stroke="var(--gold)" strokeWidth={unit * 0.25} strokeLinejoin="round" pointerEvents="none" />
        {pin && (
          <g transform={`translate(${pin[0]} ${pin[1]})`} pointerEvents="none">
            <circle r={unit * 1.6} fill="var(--ink-2)" stroke="var(--gold)" strokeWidth={unit * 0.3} />
            <circle r={unit * 0.6} fill="var(--gold)" />
          </g>
        )}
      </svg>
      {county && (
        <button
          type="button"
          onClick={() => setWholeCountry((w) => !w)}
          className="self-start font-ui text-[12px] cursor-pointer hover:text-gold"
          style={{ ...hint, background: "transparent", border: 0, padding: 0 }}
        >
          {wholeCountry
            ? (language === "en" ? `Zoom to ${county}` : `Apropie ${county}`)
            : (language === "en" ? "Show all of Romania" : "Arată toată România")}
        </button>
      )}
    </div>
  );
};

/**
 * Where and when a story happens: the fields that put it on the Atlas.
 * Shared by the three story editors.
 */
export const PlaceTimeFields: React.FC<Props> = ({ value, onChange, county, onCountyChange, errorFor, language }) => {
  const en = language === "en";
  const set = (patch: Partial<PlaceDateDraft>) => onChange({ ...value, ...patch });
  const parsed = parseCoords(value.coords);
  const coords = parsed && parsed !== "invalid" ? parsed : null;
  const L = PLACE_DATE_LIMITS;
  // The pin decides the county, however it was placed: a story pinned in
  // București but filed under Prahova would be listed in the wrong county.
  const followPin = (lat: number, lng: number) => {
    const at = countyAt(...project(lng, lat));
    if (at && at !== county) onCountyChange(at);
  };

  return (
    <FormBlock title={en ? "Place & time" : "Loc și timp"}>
      <p className="m-0" style={{ fontSize: 15, color: "var(--text-dim)", lineHeight: 1.55 }}>
        {en
          ? "Where and when the story happens. This is what places it on the Atlas and its timeline. All optional: without a pin the story sits in its county; without years it stays off the timeline."
          : "Unde și când se petrece povestea. Asta o așază pe Atlas și pe cronologie. Totul e opțional: fără reper, povestea stă în județul ei; fără ani, rămâne în afara cronologiei."}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-5 items-start">
        <PinPicker
          coords={coords}
          county={county}
          language={language}
          onPick={(lat, lng) => {
            set({ coords: formatCoords(lat, lng) });
            followPin(lat, lng);
          }}
        />
        <div className="flex flex-col gap-4">
          <Field label={en ? "Coordinates (latitude, longitude)" : "Coordonate (latitudine, longitudine)"} error={errorFor("coords")}>
            <input
              type="text"
              inputMode="decimal"
              value={value.coords}
              onChange={(e) => set({ coords: e.target.value })}
              // On blur rather than per keystroke, so a half-typed pair
              // doesn't flick the county around.
              onBlur={() => { if (coords) followPin(coords.lat, coords.lng); }}
              placeholder="44.4355, 26.1018"
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          <p className="font-ui text-[12px] m-0 -mt-2" style={hint}>
            {en ? "Click the map, or paste from any map app." : "Apasă pe hartă sau lipește din orice aplicație de hărți."}
          </p>
          {value.coords && (
            <button
              type="button"
              onClick={() => set({ coords: "" })}
              className="btn-ed btn-ed-ghost self-start"
            >
              {en ? "Remove pin" : "Elimină reperul"}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label={en ? "Place name (English)" : "Numele locului (engleză)"}>
          <input type="text" value={value.placeNameEn} onChange={(e) => set({ placeNameEn: e.target.value })} maxLength={L.PLACE_NAME_MAX} placeholder={en ? "e.g. University Square, Bucharest" : "ex. University Square, Bucharest"} />
        </Field>
        <Field label={en ? "Place name (Romanian)" : "Numele locului (română)"}>
          <input type="text" value={value.placeNameRo} onChange={(e) => set({ placeNameRo: e.target.value })} maxLength={L.PLACE_NAME_MAX} placeholder={en ? "e.g. Piața Universității, București" : "ex. Piața Universității, București"} />
        </Field>
      </div>

      <label className="flex items-start gap-3 cursor-pointer select-none" style={{ marginBottom: 0 }}>
        <input
          type="checkbox"
          checked={value.timeless}
          onChange={(e) => set({ timeless: e.target.checked })}
          className="mt-1 w-4 h-4 accent-[color:var(--gold)]"
        />
        <span style={{ flex: 1, textTransform: "none", letterSpacing: "normal" }}>
          <span className="font-display italic block" style={{ color: "var(--parchment)", fontSize: 17 }}>
            {en ? "Timeless" : "Atemporală"}
          </span>
          <span className="font-ui text-[13px] mt-1 block" style={hint}>
            {en ? "A legend, custom or landscape with no date of its own." : "O legendă, un obicei sau un peisaj fără o dată anume."}
          </span>
        </span>
      </label>

      {!value.timeless && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Field label={en ? "From year" : "Din anul"} error={errorFor("yearStart")}>
              <input type="text" inputMode="numeric" value={value.yearStart} onChange={(e) => set({ yearStart: e.target.value })} placeholder="1873" autoComplete="off" />
            </Field>
            <Field label={en ? "To year (optional)" : "Până în anul (opțional)"} error={errorFor("yearEnd")}>
              <input type="text" inputMode="numeric" value={value.yearEnd} onChange={(e) => set({ yearEnd: e.target.value })} placeholder="1914" autoComplete="off" />
            </Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={en ? "Period label (English, optional)" : "Eticheta perioadei (engleză, opțional)"}>
              <input type="text" value={value.eraLabelEn} onChange={(e) => set({ eraLabelEn: e.target.value })} maxLength={L.ERA_LABEL_MAX} placeholder={en ? "e.g. 15th century" : "ex. 15th century"} />
            </Field>
            <Field label={en ? "Period label (Romanian, optional)" : "Eticheta perioadei (română, opțional)"}>
              <input type="text" value={value.eraLabelRo} onChange={(e) => set({ eraLabelRo: e.target.value })} maxLength={L.ERA_LABEL_MAX} placeholder={en ? "e.g. secolul al XV-lea" : "ex. secolul al XV-lea"} />
            </Field>
          </div>
          <p className="font-ui text-[12px] m-0" style={hint}>
            {en
              ? "The label is shown instead of the years when they would overstate precision. Use a minus sign for BC (-82)."
              : "Eticheta apare în locul anilor când aceștia ar sugera o precizie falsă. Folosește minus pentru î.Hr. (-82)."}
          </p>
        </>
      )}
    </FormBlock>
  );
};
