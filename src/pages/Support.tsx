import React, { useState } from "react";
import { useLanguage } from "@/hooks/use-language";
import { CreditCard, Landmark, Copy, Check, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Motif } from "@/components/story/Ornaments";
import { PageHead } from "@/components/layout/PageHead";
import { toast } from "sonner";

const RevolutIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M5 10h9.5a4.5 4.5 0 1 1 0 9h-3.5" />
    <path d="M5 10h3v10h-3z" />
  </svg>
);

const Support: React.FC = () => {
  const { language } = useLanguage();
  const [copiedField, setCopiedField] = useState<"iban" | "reference" | null>(null);
  const [showBank, setShowBank] = useState(false);

  const content = {
    en: {
      title: "Help keep the\narchive open.",
      subtitle: "Become a contributor",
      intro: "The RoStory is reader-supported. Your contribution funds field research, the pictures and films, translation, and the slow work of listening.",
      revolut: "Revolut", paypal: "PayPal", bankTransfer: "Bank transfer",
      revolutDesc: "Quickest. Direct from your Revolut wallet.",
      paypalDesc: "International. Card, bank, or PayPal balance.",
      bankDesc: "Larger amounts or recurring transfers in RON.",
      whereTitle: "Where it will go",
      wherePlan: "A plan for how donations will be spent, not audited accounts.",
      whereLead: "I am one mind, a suite of neural networks, and a great deal of train tickets.",
      whereRows: [
        { label: "Field reporting & travel", pct: 38 },
        { label: "Pictures & films (AI tools)", pct: 26 },
        { label: "Translation (EN ↔ RO)", pct: 14 },
        { label: "Editorial & fact-checking", pct: 12 },
        { label: "Hosting & maintenance", pct: 10 },
      ],
      thank: "Thank you",
      thankMsg: "Whether you donate or simply share our stories, you're helping keep this archive alive.",
      bankDetails: {
        title: "Bank transfer (RON)", subtitle: "Use these details from any bank app.",
        beneficiaryLabel: "Beneficiary", beneficiaryValue: "Ionescu Emanuel-Constantin",
        ibanLabel: "IBAN", ibanValue: "RO95 REVO 0000 1310 9615 3763",
        bankLabel: "Bank", bankValue: "Revolut Bank",
        referenceLabel: "Payment reference", referenceValue: "RoStory donation",
        copy: "Copy", copied: "Copied",
        copySuccess: "Copied to clipboard", copyError: "Couldn't copy — please copy manually",
      },
    },
    ro: {
      title: "Ajută să ținem\narhiva deschisă.",
      subtitle: "Devino contribuitor",
      intro: "The RoStory este susținut de cititori. Contribuția ta finanțează cercetarea pe teren, imaginile și filmele, traducerea și munca lentă de a asculta.",
      revolut: "Revolut", paypal: "PayPal", bankTransfer: "Transfer bancar",
      revolutDesc: "Cel mai rapid. Direct din portofelul tău Revolut.",
      paypalDesc: "Internațional. Card, bancă sau sold PayPal.",
      bankDesc: "Sume mai mari sau transferuri recurente în RON.",
      whereTitle: "Unde vor merge banii",
      wherePlan: "Un plan pentru felul în care vor fi folosite donațiile, nu un raport contabil auditat.",
      whereLead: "Sunt o singură minte, un set de rețele neuronale și foarte multe bilete de tren.",
      whereRows: [
        { label: "Reportaje și deplasări", pct: 38 },
        { label: "Imagini și filme (instrumente AI)", pct: 26 },
        { label: "Traducere (RO ↔ EN)", pct: 14 },
        { label: "Editare și verificare", pct: 12 },
        { label: "Găzduire și mentenanță", pct: 10 },
      ],
      thank: "Mulțumim",
      thankMsg: "Fie că donezi sau pur și simplu împărtășești poveștile noastre, ne ajuți să ținem arhiva în viață.",
      bankDetails: {
        title: "Transfer bancar (RON)", subtitle: "Folosește aceste detalii din orice aplicație bancară.",
        beneficiaryLabel: "Beneficiar", beneficiaryValue: "Ionescu Emanuel-Constantin",
        ibanLabel: "IBAN", ibanValue: "RO95 REVO 0000 1310 9615 3763",
        bankLabel: "Banca", bankValue: "Revolut Bank",
        referenceLabel: "Detalii plată", referenceValue: "Donație RoStory",
        copy: "Copiază", copied: "Copiat",
        copySuccess: "Copiat în clipboard", copyError: "Nu s-a putut copia — copiază manual",
      },
    },
  };

  const t = content[language];

  const handleCopy = async (value: string, field: "iban" | "reference") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      toast.success(t.bankDetails.copySuccess);
      window.setTimeout(() => setCopiedField((prev) => (prev === field ? null : prev)), 2000);
    } catch {
      toast.error(t.bankDetails.copyError);
    }
  };

  const en = language === 'en';



  const tiers = [

    {

      label: t.revolut,

      icon: <RevolutIcon className="w-6 h-6" />,

      desc: t.revolutDesc,

      cta: en ? 'Give with Revolut' : 'Contribuie prin Revolut',

      onClick: () => window.open("https://revolut.me/manu2492", "_blank", "noopener,noreferrer"),

      // Our recommendation, and labelled as one. The badge used to say "Most

      // chosen" — a claim about other readers that nothing measured.

      recommended: true,

    },

    {

      label: t.paypal,

      icon: <CreditCard className="w-6 h-6" />,

      desc: t.paypalDesc,

      cta: en ? 'Give with PayPal' : 'Contribuie prin PayPal',

      onClick: () => window.open("https://paypal.me/Constaa24?locale.x=ro_RO&country.x=RO", "_blank", "noopener,noreferrer"),

    },

    {

      label: t.bankTransfer,

      icon: <Landmark className="w-6 h-6" />,

      desc: t.bankDesc,

      cta: en ? 'Show bank details' : 'Arată detaliile bancare',

      isDialog: true,

    },

  ];



  return (
    <div className="rs-in">
      <PageHead title={t.subtitle} description={t.intro} language={language} />

      <section className="ed-container" style={{ paddingTop: 'clamp(40px, 6vw, 80px)' }}>
        <div className="grid grid-cols-1 min-[1000px]:grid-cols-[1.2fr_1fr] gap-x-[72px] gap-y-7 items-end" style={{ marginBottom: 'clamp(40px, 5vw, 64px)' }}>
          <div>
            <p className="rs-eyebrow" style={{ marginBottom: 16 }}>{t.subtitle}</p>
            <h1 className="rs-display" style={{ fontSize: 'clamp(54px, 7.4vw, 116px)', lineHeight: 0.92, letterSpacing: '-0.025em', whiteSpace: 'pre-line' }}>{t.title}</h1>
          </div>
          <p className="m-0 mb-2.5" style={{ fontSize: 20, lineHeight: 1.6, color: 'var(--text-dim)', textWrap: 'pretty' }}>{t.intro}</p>
        </div>

        {/* Three ways to give, each an arched door. */}
        <ul className="list-none m-0 p-0 grid gap-5 grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))]" style={{ paddingTop: 14 }}>
          {tiers.map((tier) => (
            <li key={tier.label} className={tier.recommended ? 'rs-tier is-recommended' : 'rs-tier'}>
              {tier.recommended && <span className="rs-tier-badge">{en ? 'Recommended' : 'Recomandat'}</span>}
              <span className="grid place-items-center" style={{ width: 52, height: 52, marginTop: 14, borderRadius: '50%', border: '1px solid var(--line)', color: 'var(--gold)' }} aria-hidden="true">
                {tier.icon}
              </span>
              <h2 className="rs-display" style={{ fontSize: 36, lineHeight: 1, letterSpacing: 0 }}>{tier.label}</h2>
              <p className="m-0" style={{ fontSize: 16, lineHeight: 1.55, color: 'var(--text-dim)', minHeight: '3.1em' }}>{tier.desc}</p>
              <button
                type="button"
                className={tier.recommended ? 'rs-btn w-full' : 'rs-btn rs-btn-ghost w-full'}
                style={tier.recommended ? undefined : { borderColor: 'var(--gold)', color: 'var(--gold)' }}
                onClick={tier.isDialog ? () => setShowBank((s) => !s) : tier.onClick}
                aria-expanded={tier.isDialog ? showBank : undefined}
                aria-controls={tier.isDialog ? 'bank-details' : undefined}
              >
                {tier.isDialog && showBank ? (en ? 'Hide bank details' : 'Ascunde detaliile bancare') : tier.cta}
              </button>
            </li>
          ))}
        </ul>

        {/* Bank details, opened in place under the doors. */}
        <div id="bank-details" hidden={!showBank} className="rs-in" style={{ marginTop: 20, padding: 'clamp(22px, 3vw, 36px)', border: '1.5px dashed var(--gold-deep)', borderRadius: 24, background: 'var(--paper)' }}>
          <div className="flex flex-wrap justify-between gap-3 mb-5">
            <div>
              <h2 className="rs-display" style={{ margin: '0 0 4px', fontSize: 30, letterSpacing: 0 }}>{t.bankDetails.title}</h2>
              <p className="m-0" style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--text-mute)' }}>{t.bankDetails.subtitle}</p>
            </div>
            <button type="button" onClick={() => setShowBank(false)} aria-label={en ? 'Close' : 'Închide'} className="sb-icon-btn grid" style={{ width: 40, height: 40 }}>
              <X className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>
          <dl className="m-0 grid gap-x-8 grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))]">
            <BankRow label={t.bankDetails.beneficiaryLabel} value={t.bankDetails.beneficiaryValue} />
            <BankRow
              label={t.bankDetails.ibanLabel}
              value={t.bankDetails.ibanValue}
              mono
              action={<CopyButton copied={copiedField === 'iban'} onClick={() => handleCopy(t.bankDetails.ibanValue.replace(/\s+/g, ''), 'iban')} copy={t.bankDetails.copy} copiedLabel={t.bankDetails.copied} />}
            />
            <BankRow label={t.bankDetails.bankLabel} value={t.bankDetails.bankValue} />
            <BankRow
              label={t.bankDetails.referenceLabel}
              value={t.bankDetails.referenceValue}
              action={<CopyButton copied={copiedField === 'reference'} onClick={() => handleCopy(t.bankDetails.referenceValue, 'reference')} copy={t.bankDetails.copy} copiedLabel={t.bankDetails.copied} />}
            />
          </dl>
        </div>
      </section>

      {/* Where it will go */}
      <section className="ed-container" style={{ paddingTop: 'clamp(64px, 8vw, 112px)' }}>
        <div className="grid grid-cols-1 min-[1000px]:grid-cols-2 gap-[clamp(32px,5vw,88px)]">
          <div>
            <h2 className="rs-display" style={{ margin: '0 0 14px', fontSize: 'clamp(36px, 4vw, 56px)', lineHeight: 1 }}>{t.whereTitle}</h2>
            <p className="m-0 mb-3.5 font-display italic" style={{ fontSize: 24, lineHeight: 1.35, color: 'var(--text)' }}>{t.whereLead}</p>
            {/* The percentages are an intention, not a report: said so,
                so donors aren't told something that can't be shown. */}
            <p className="m-0" style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--text-mute)' }}>{t.wherePlan}</p>
          </div>
          <ul className="list-none m-0 p-0 grid gap-[22px]">
            {t.whereRows.map((row) => (
              <li key={row.label}>
                <div className="flex justify-between gap-3 mb-2">
                  <span style={{ fontSize: 18, color: 'var(--parchment)' }}>{row.label}</span>
                  <span className="font-display" style={{ fontSize: 24, color: 'var(--gold-2)' }}>{row.pct}%</span>
                </div>
                <div aria-hidden="true" style={{ height: 6, borderRadius: 6, background: 'var(--line-soft)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${row.pct}%`, borderRadius: 6, background: 'linear-gradient(90deg, var(--gold-deep), var(--gold))' }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Thank you */}
      <section className="ed-container text-center" style={{ paddingTop: 'clamp(64px, 8vw, 112px)', maxWidth: 760 }}>
        <Motif className="mx-auto mb-9" style={{ width: 260, maxWidth: '100%' }} />
        <h2 className="rs-display" style={{ margin: '0 0 14px', fontStyle: 'italic', fontSize: 'clamp(44px, 5vw, 72px)', color: 'var(--gold-2)' }}>{t.thank}</h2>
        <p className="m-0 mb-6" style={{ fontSize: 19, lineHeight: 1.7, color: 'var(--text-dim)' }}>{t.thankMsg}</p>
        <Link to="/" className="rs-btn rs-btn-ghost">{en ? 'Back to the stories' : 'Înapoi la povești'}</Link>
      </section>
    </div>
  );
};

const BankRow: React.FC<{ label: string; value: string; mono?: boolean; action?: React.ReactNode }> = ({ label, value, mono, action }) => (
  <div className="flex items-center justify-between gap-3" style={{ padding: '14px 0', borderBottom: '1px solid var(--line-soft)' }}>
    <div className="min-w-0">
      <dt style={{ fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 700, color: 'var(--text-mute)' }}>{label}</dt>
      <dd className={mono ? 'font-mono break-all select-all' : 'select-all'} style={{ margin: '2px 0 0', fontSize: mono ? 15 : 17, color: 'var(--parchment)' }}>{value}</dd>
    </div>
    {action}
  </div>
);

const CopyButton: React.FC<{ copied: boolean; onClick: () => void; copy: string; copiedLabel: string }> = ({ copied, onClick, copy, copiedLabel }) => (
  <button
    type="button"
    onClick={onClick}
    className="rs-chip shrink-0"
    style={{ minHeight: 36, padding: '0 14px', color: 'var(--gold)' }}
  >
    {copied ? <Check className="w-3 h-3" aria-hidden="true" /> : <Copy className="w-3 h-3" aria-hidden="true" />}
    {copied ? copiedLabel : copy}
  </button>
);

export default Support;
