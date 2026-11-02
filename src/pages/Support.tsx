import React, { useState } from "react";
import { useLanguage } from "@/hooks/use-language";
import { CreditCard, Landmark, Copy, Check, User, Building2, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Link } from "react-router-dom";
import { PageHead } from "@/components/layout/PageHead";
import { ChapterHead, Divider, Motif } from "@/components/story/Ornaments";
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

    <div className="screen-anim">

      <PageHead title={t.subtitle} description={t.intro} language={language} />



      <section className="ed-container" style={{ paddingTop: 'clamp(48px, 7vw, 80px)', paddingBottom: 'clamp(48px, 6vw, 72px)' }}>

        <ChapterHead as="h1" kicker={t.subtitle} title={t.title.replace('\n', ' ')} rosetteSize="lg">

          <p className="sb-lede max-w-[620px]">{t.intro}</p>

        </ChapterHead>

      </section>



      {/* Three ways to give */}

      <section className="ed-container" style={{ paddingBottom: 'clamp(72px, 9vw, 104px)' }}>

        <ul className="list-none m-0 p-0 grid grid-cols-1 md:grid-cols-3 gap-7 pt-4">

          {tiers.map((tier) => {

            const button = (

              <button

                type="button"

                onClick={tier.onClick}

                className={tier.recommended ? 'sb-btn justify-self-start mt-2' : 'sb-btn sb-btn-ghost justify-self-start mt-2'}

              >

                {tier.cta}

              </button>

            );

            return (

              <li

                key={tier.label}

                className="relative grid gap-4 content-start"

                style={{

                  padding: '36px 30px 30px',

                  borderRadius: 24,

                  background: 'var(--paper)',

                  border: `1px solid ${tier.recommended ? 'var(--gold-deep)' : 'var(--line-soft)'}`,

                }}

              >

                {tier.recommended && (

                  <span className="sb-tag absolute" style={{ top: -16, left: 30, background: 'var(--gold)', color: 'var(--on-gold)', borderColor: 'var(--gold)' }}>

                    {en ? 'Recommended' : 'Recomandat'}

                  </span>

                )}

                <span className="grid place-items-center" style={{ width: 56, height: 56, borderRadius: '50%', border: '1px solid var(--line)', color: 'var(--gold)' }} aria-hidden="true">

                  {tier.icon}

                </span>

                <h2 className="sb-h3">{tier.label}</h2>

                <p className="sb-dim text-[17px] leading-relaxed">{tier.desc}</p>

                {tier.isDialog ? (

                  <Dialog>

                    <DialogTrigger asChild>{button}</DialogTrigger>

                    <DialogContent

                      className="sm:max-w-md p-0 overflow-hidden"

                      style={{

                        border: '1px solid var(--line)',

                        background: 'var(--paper)',

                        borderRadius: 24,

                        color: 'var(--text)',

                      }}

                    >

                      <DialogHeader className="px-7 pt-9 pb-3 space-y-3">

                        <div className="grid place-items-center mx-auto" style={{ width: 56, height: 56, borderRadius: '50%', border: '1px solid var(--line)', color: 'var(--gold)' }}>

                          <Landmark className="w-6 h-6" aria-hidden="true" />

                        </div>

                        <DialogTitle className="sb-h3 text-center" style={{ fontSize: 30 }}>

                          {t.bankDetails.title}

                        </DialogTitle>

                        <Divider className="mx-auto" style={{ width: 120 }} />

                        <DialogDescription className="text-center font-display italic text-[18px]" style={{ color: 'var(--text-dim)' }}>

                          {t.bankDetails.subtitle}

                        </DialogDescription>

                      </DialogHeader>



                      <div className="px-7 pb-8 space-y-5">

                        <DetailRow icon={<User className="w-3.5 h-3.5" />} label={t.bankDetails.beneficiaryLabel} value={t.bankDetails.beneficiaryValue} />



                        <div className="p-5 space-y-3" style={{ borderRadius: 16, background: 'var(--glow)', border: '1px solid var(--line)' }}>

                          <div className="flex items-center justify-between gap-3">

                            <p className="sb-kicker-sm">{t.bankDetails.ibanLabel}</p>

                            <CopyButton

                              copied={copiedField === 'iban'}

                              onClick={() => handleCopy(t.bankDetails.ibanValue.replace(/\s+/g, ''), 'iban')}

                              copy={t.bankDetails.copy}

                              copiedLabel={t.bankDetails.copied}

                            />

                          </div>

                          <p className="font-mono break-all select-all" style={{ fontSize: 15, color: 'var(--parchment)', lineHeight: 1.6, margin: 0 }}>

                            {t.bankDetails.ibanValue}

                          </p>

                        </div>



                        <DetailRow icon={<Building2 className="w-3.5 h-3.5" />} label={t.bankDetails.bankLabel} value={t.bankDetails.bankValue} />



                        <div className="p-5 space-y-2" style={{ borderRadius: 16, border: '1px dashed var(--gold-deep)' }}>

                          <div className="flex items-center justify-between gap-3">

                            <p className="sb-kicker-sm flex items-center gap-2"><FileText className="w-3.5 h-3.5" aria-hidden="true" /> {t.bankDetails.referenceLabel}</p>

                            <CopyButton

                              copied={copiedField === 'reference'}

                              onClick={() => handleCopy(t.bankDetails.referenceValue, 'reference')}

                              copy={t.bankDetails.copy}

                              copiedLabel={t.bankDetails.copied}

                            />

                          </div>

                          <p className="font-display italic font-medium select-all" style={{ fontSize: 19, color: 'var(--gold)', margin: 0 }}>

                            {t.bankDetails.referenceValue}

                          </p>

                        </div>

                      </div>

                    </DialogContent>

                  </Dialog>

                ) : button}

              </li>

            );

          })}

        </ul>

      </section>



      {/* Where it goes — a ledger drawn in thread */}

      <section className="sb-band">

        <div className="ed-container sb-section">

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-start">

            <div className="flex flex-col gap-4">

              <p className="sb-kicker">{t.whereTitle}</p>

              <h2 className="sb-h2" style={{ fontSize: 'clamp(30px, 3.6vw, 52px)' }}>{t.whereLead}</h2>
              {/* The percentages are an intention, not a report: said so,
                  so donors aren't told something that can't be shown. */}
              <p className="sb-meta">{t.wherePlan}</p>

            </div>

            <ul className="list-none m-0 p-0 grid gap-6">

              {t.whereRows.map((row) => (

                <li key={row.label} className="flex flex-col gap-2.5">

                  <div className="flex justify-between items-baseline gap-3">

                    <span className="font-display italic text-[22px] leading-tight" style={{ color: 'var(--parchment)' }}>{row.label}</span>

                    <span className="sb-numeral" style={{ fontSize: 22 }}>{row.pct}%</span>

                  </div>

                  <div className="relative" style={{ height: 8 }} aria-hidden="true">

                    <span className="sb-thread absolute left-0 right-0" style={{ top: 3 }} />

                    <span className="absolute left-0 top-0 bottom-0" style={{ width: `${row.pct}%`, borderRadius: 999, background: 'var(--gold)' }} />

                  </div>

                </li>

              ))}

            </ul>

          </div>

        </div>

      </section>



      {/* Thank you */}

      <section className="ed-container" style={{ paddingBlock: 'clamp(72px, 9vw, 104px)' }}>

        <div className="sb-chapter-head">

          <Motif style={{ width: 260 }} />

          <h2 className="sb-h2">{t.thank}</h2>

          <p className="sb-lede max-w-[560px]">{t.thankMsg}</p>

          <Link to="/" className="sb-btn sb-btn-ghost mt-2.5">{en ? 'Back to the stories' : 'Înapoi la povești'}</Link>

        </div>

      </section>

    </div>

  );

};



const DetailRow: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (

  <div className="flex items-start gap-3">

    <div className="grid place-items-center shrink-0" style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--line)', color: 'var(--gold)', marginTop: 2 }} aria-hidden="true">

      {icon}

    </div>

    <div className="flex-1 min-w-0">

      <p className="sb-kicker-sm">{label}</p>

      <p className="font-display italic" style={{ fontSize: 18, color: 'var(--parchment)', margin: '2px 0 0' }}>{value}</p>

    </div>

  </div>

);



const CopyButton: React.FC<{ copied: boolean; onClick: () => void; copy: string; copiedLabel: string }> = ({ copied, onClick, copy, copiedLabel }) => (

  <button

    type="button"

    onClick={onClick}

    className="sb-seg-btn"

    style={{ minHeight: 32, padding: '6px 12px', border: '1px solid var(--line)', gap: 6, color: copied ? 'var(--gold)' : undefined }}

  >

    {copied ? <Check className="w-3 h-3" aria-hidden="true" /> : <Copy className="w-3 h-3" aria-hidden="true" />}

    {copied ? copiedLabel : copy}

  </button>

);



export default Support;

