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

  const content = {
    en: {
      title: "Help keep the\narchive open.",
      subtitle: "Become a contributor",
      intro: "The RoStory is reader-supported. Your contribution funds field research, photography, translation, and the slow work of listening.",
      revolut: "Revolut", paypal: "PayPal", bankTransfer: "Bank transfer",
      revolutDesc: "Quickest. Direct from your Revolut wallet.",
      paypalDesc: "International. Card, bank, or PayPal balance.",
      bankDesc: "Larger amounts or recurring transfers in RON.",
      whereTitle: "Where it goes",
      whereLead: "I am one mind, a suite of neural networks, and a great deal of train tickets.",
      whereRows: [
        { label: "Field reporting & travel", pct: 38 },
        { label: "Photography & video production", pct: 26 },
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
      intro: "RoStory este susținut de cititori. Contribuția ta finanțează cercetarea pe teren, fotografia, traducerea și munca lentă de a asculta.",
      revolut: "Revolut", paypal: "PayPal", bankTransfer: "Transfer bancar",
      revolutDesc: "Cel mai rapid. Direct din portofelul tău Revolut.",
      paypalDesc: "Internațional. Card, bancă sau sold PayPal.",
      bankDesc: "Sume mai mari sau transferuri recurente în RON.",
      whereTitle: "Unde se duce",
      whereLead: "Sunt o singură minte, un set de rețele neuronale și foarte multe bilete de tren.",
      whereRows: [
        { label: "Reportaje și deplasări", pct: 38 },
        { label: "Fotografie și producție video", pct: 26 },
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

  const tiers = [
    {
      label: t.revolut,
      icon: <RevolutIcon className="w-7 h-7" />,
      desc: t.revolutDesc,
      onClick: () => window.open("https://revolut.me/manu2492", "_blank", "noopener,noreferrer"),
      popular: true,
    },
    {
      label: t.paypal,
      icon: <CreditCard className="w-7 h-7" />,
      desc: t.paypalDesc,
      onClick: () => window.open("https://paypal.me/Constaa24?locale.x=ro_RO&country.x=RO", "_blank", "noopener,noreferrer"),
    },
    {
      label: t.bankTransfer,
      icon: <Landmark className="w-7 h-7" />,
      desc: t.bankDesc,
      isDialog: true,
    },
  ];

  return (
    <div className="screen-anim pb-20">
      <PageHead title={t.subtitle} description={t.intro} language={language} />

      {/* Page hero */}
      <section style={{ padding: '80px 0 56px', borderBottom: '1px solid var(--line-soft)' }}>
        <div className="ed-container">
          <div className="eyebrow mb-4">{t.subtitle}</div>
          <h1
            className="font-display italic font-medium m-0"
            style={{
              fontSize: 'clamp(56px, 8vw, 120px)',
              lineHeight: 0.95,
              letterSpacing: '-0.01em',
              color: 'var(--parchment)',
              textWrap: 'balance' as React.CSSProperties['textWrap'],
              whiteSpace: 'pre-line',
            }}
          >
            {t.title}
          </h1>
          <p className="mt-7 max-w-[540px]" style={{ fontSize: 19, color: 'var(--text-dim)', lineHeight: 1.55 }}>
            {t.intro}
          </p>
        </div>
      </section>

      {/* Tiers (donation methods styled as editorial cards) */}
      <section style={{ padding: '60px 0 80px' }}>
        <div className="ed-container">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-7">
            {tiers.map((tier, i) => {
              const card = (
                <div
                  className="relative cursor-pointer transition-colors group"
                  style={{
                    padding: '40px 32px',
                    border: tier.popular ? '1px solid var(--gold)' : '1px solid var(--line)',
                    background: tier.popular ? 'linear-gradient(180deg, rgba(201,169,110,0.06), transparent)' : 'var(--overlay-panel-soft)',
                  }}
                >
                  {tier.popular && (
                    <span
                      className="pill absolute"
                      style={{
                        top: -14,
                        left: 24,
                        background: 'var(--ink)',
                        color: 'var(--gold)',
                        borderColor: 'var(--gold)',
                      }}
                    >
                      {language === 'en' ? 'Most chosen' : 'Cel mai ales'}
                    </span>
                  )}
                  <div className="grid place-items-center mb-5" style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(201,169,110,0.12)', color: 'var(--gold)' }}>
                    {tier.icon}
                  </div>
                  <h3
                    className="font-display italic font-medium m-0"
                    style={{ fontSize: 36, lineHeight: 1.05, color: 'var(--parchment)' }}
                  >
                    {tier.label}
                  </h3>
                  <p className="mt-3 mb-7" style={{ color: 'var(--text-dim)', fontSize: 15, lineHeight: 1.55 }}>
                    {tier.desc}
                  </p>
                  <div className="btn-ed w-full justify-center" style={{ background: tier.popular ? 'var(--gold)' : 'transparent', color: tier.popular ? 'var(--ink)' : 'var(--gold)' }}>
                    {language === 'en' ? `Donate via ${tier.label}` : `Donează prin ${tier.label}`}
                  </div>
                </div>
              );

              if (tier.isDialog) {
                return (
                  <Dialog key={i}>
                    <DialogTrigger asChild>
                      <button className="text-left p-0" style={{ background: 'transparent', border: 0 }}>
                        {card}
                      </button>
                    </DialogTrigger>
                    <DialogContent
                      className="sm:max-w-md p-0 overflow-hidden"
                      style={{
                        border: '1px solid var(--line)',
                        background: 'var(--ink-2)',
                        borderRadius: 4,
                        color: 'var(--text)',
                      }}
                    >
                      <DialogHeader className="px-7 pt-9 pb-3 space-y-3">
                        <div className="grid place-items-center mx-auto" style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(201,169,110,0.12)', color: 'var(--gold)' }}>
                          <Landmark className="w-6 h-6" />
                        </div>
                        <DialogTitle
                          className="font-display italic text-center m-0"
                          style={{ fontSize: 28, lineHeight: 1.1, color: 'var(--parchment)' }}
                        >
                          {t.bankDetails.title}
                        </DialogTitle>
                        <div className="rule-gold mx-auto" style={{ width: 80 }} />
                        <DialogDescription className="text-center font-display italic" style={{ color: 'var(--text-dim)' }}>
                          {t.bankDetails.subtitle}
                        </DialogDescription>
                      </DialogHeader>

                      <div className="px-7 pb-8 space-y-5">
                        <DetailRow icon={<User className="w-3.5 h-3.5" />} label={t.bankDetails.beneficiaryLabel} value={t.bankDetails.beneficiaryValue} />

                        <div className="rounded-sm p-5 space-y-3" style={{ background: 'rgba(201,169,110,0.06)', border: '1px solid var(--line)' }}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="eyebrow">{t.bankDetails.ibanLabel}</div>
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

                        <div className="rounded-sm p-5 space-y-2" style={{ background: 'rgba(138,42,42,0.07)', border: '1px solid var(--line)' }}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="eyebrow flex items-center gap-2"><FileText className="w-3.5 h-3.5" /> {t.bankDetails.referenceLabel}</div>
                            <CopyButton
                              copied={copiedField === 'reference'}
                              onClick={() => handleCopy(t.bankDetails.referenceValue, 'reference')}
                              copy={t.bankDetails.copy}
                              copiedLabel={t.bankDetails.copied}
                            />
                          </div>
                          <p className="font-display italic font-medium select-all" style={{ fontSize: 18, color: 'var(--gold)', margin: 0 }}>
                            {t.bankDetails.referenceValue}
                          </p>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                );
              }

              return (
                <button key={i} onClick={tier.onClick} className="text-left p-0" style={{ background: 'transparent', border: 0 }}>
                  {card}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Where it goes */}
      <section style={{ padding: '80px 0', borderTop: '1px solid var(--line-soft)' }}>
        <div className="ed-container">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr] gap-20 items-start">
            <div>
              <div className="eyebrow mb-3.5">{t.whereTitle}</div>
              <h3
                className="font-display italic font-medium m-0"
                style={{ fontSize: 'clamp(32px, 3.4vw, 48px)', lineHeight: 1.1, color: 'var(--parchment)' }}
              >
                {t.whereLead}
              </h3>
            </div>
            <div className="flex flex-col gap-5">
              {t.whereRows.map((row, i) => (
                <div key={i}>
                  <div className="flex justify-between mb-2">
                    <span className="font-display italic" style={{ fontSize: 19 }}>{row.label}</span>
                    <span className="font-ui text-[11px]" style={{ letterSpacing: '0.15em', color: 'var(--gold)' }}>{row.pct}%</span>
                  </div>
                  <div style={{ height: 1, background: 'var(--line)', position: 'relative' }}>
                    <div style={{ position: 'absolute', left: 0, top: -1, height: 3, width: row.pct + '%', background: 'var(--gold)' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Thank you */}
      <section style={{ padding: '80px 0' }}>
        <div className="ed-container">
          <div className="text-center max-w-[600px] mx-auto py-12 px-6" style={{ border: '1px dashed var(--line)' }}>
            <div className="eyebrow mb-4">{t.thank}</div>
            <p className="font-display italic m-0" style={{ fontSize: 'clamp(22px, 2.4vw, 30px)', lineHeight: 1.3, color: 'var(--parchment)' }}>
              {t.thankMsg}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

const DetailRow: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex items-start gap-3">
    <div className="grid place-items-center shrink-0" style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(201,169,110,0.10)', color: 'var(--gold)', marginTop: 2 }}>
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <div className="eyebrow">{label}</div>
      <p className="font-display italic" style={{ fontSize: 17, color: 'var(--parchment)', margin: '4px 0 0' }}>{value}</p>
    </div>
  </div>
);

const CopyButton: React.FC<{ copied: boolean; onClick: () => void; copy: string; copiedLabel: string }> = ({ copied, onClick, copy, copiedLabel }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center gap-1.5 font-ui text-[10px] uppercase font-bold transition-colors"
    style={{
      letterSpacing: '0.15em',
      color: copied ? 'var(--gold)' : 'var(--text-dim)',
      background: 'transparent',
      border: '1px solid var(--line)',
      padding: '5px 10px',
      borderRadius: 999,
      cursor: 'pointer',
    }}
  >
    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
    {copied ? copiedLabel : copy}
  </button>
);

export default Support;
