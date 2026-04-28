import React, { useState } from "react";
import { useLanguage } from "@/hooks/use-language";
import { Heart, CreditCard, Sparkles, Landmark, Banknote, Copy, Check, User, Building2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import { HeroBanner } from "@/components/layout/HeroBanner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription
} from "@/components/ui/dialog";
import { PageHead } from "@/components/layout/PageHead";
import { toast } from "sonner";

const RevolutIcon = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M5 10h9.5a4.5 4.5 0 1 1 0 9h-3.5" />
    <path d="M5 10h3v10h-3z" />
  </svg>
);

const Support: React.FC = () => {
  const { language } = useLanguage();

  const content = {
    en: {
      title: "Support The RoStory",
      subtitle: "Help us share Romania's rich culture with the world",
      intro: "The RoStory is a passion project dedicated to showcasing the beauty, history, and traditions of Romania. Your support helps us continue creating quality content and reaching more people worldwide.",
      whySupport: "Why Support Us?",
      reasons: [
        {
          icon: Sparkles,
          title: "Quality Content",
          description: "Your support helps us research and create authentic, well-crafted stories about Romanian culture."
        },
        {
          icon: Heart,
          title: "Preserve Heritage",
          description: "Help us document and share Romania's traditions before they're forgotten."
        },
        {
          icon: Banknote,
          title: "Independent Voice",
          description: "Support independent storytelling free from commercial pressures."
        }
      ],
      donateTitle: "Ways to Support",
      donateIntro: "Every contribution, big or small, makes a difference.",
      revolut: "Revolut",
      paypal: "PayPal Donation",
      bankTransfer: "Bank Transfer",
      bankDetails: {
        title: "Bank transfer (RON)",
        subtitle: "Use these details from any bank app.",
        beneficiaryLabel: "Beneficiary",
        beneficiaryValue: "Ionescu Emanuel-Constantin",
        ibanLabel: "IBAN",
        ibanValue: "RO95 REVO 0000 1310 9615 3763",
        bankLabel: "Bank",
        bankValue: "Revolut Bank",
        referenceLabel: "Payment reference",
        referenceValue: "RoStory donation",
        copy: "Copy",
        copied: "Copied",
        copySuccess: "Copied to clipboard",
        copyError: "Couldn't copy — please copy manually"
      },
      thankYou: "Thank You",
      thankYouMessage: "Whether you donate or simply share our stories, you're helping spread the beauty of Romania. Thank you from the heart!"
    },
    ro: {
      title: "Susține The RoStory",
      subtitle: "Ajută-ne să împărtășim bogata cultură a României cu lumea",
      intro: "The RoStory este un proiect de suflet dedicat prezentării frumuseții, istoriei și tradițiilor României. Sprijinul tău ne ajută să continuăm să creăm conținut de calitate și să ajungem la mai mulți oameni din întreaga lume.",
      whySupport: "De ce să ne susții?",
      reasons: [
        {
          icon: Sparkles,
          title: "Conținut de Calitate",
          description: "Sprijinul tău ne ajută să cercetăm și să creăm povești autentice despre cultura românească."
        },
        {
          icon: Heart,
          title: "Păstrează Moștenirea",
          description: "Ajută-ne să documentăm și să împărtășim tradițiile României."
        },
        {
          icon: Banknote,
          title: "Voce Independentă",
          description: "Susține povestirile independente, libere de presiuni comerciale."
        }
      ],
      donateTitle: "Modalități de Susținere",
      donateIntro: "Fiecare contribuție, mare sau mică, contează.",
      revolut: "Revolut",
      paypal: "Donație PayPal",
      bankTransfer: "Transfer bancar",
      bankDetails: {
        title: "Transfer bancar (RON)",
        subtitle: "Folosește aceste detalii din orice aplicație bancară.",
        beneficiaryLabel: "Beneficiar",
        beneficiaryValue: "Ionescu Emanuel-Constantin",
        ibanLabel: "IBAN",
        ibanValue: "RO95 REVO 0000 1310 9615 3763",
        bankLabel: "Banca",
        bankValue: "Revolut Bank",
        referenceLabel: "Detalii plată",
        referenceValue: "Donație RoStory",
        copy: "Copiază",
        copied: "Copiat",
        copySuccess: "Copiat în clipboard",
        copyError: "Nu s-a putut copia — copiază manual"
      },
      thankYou: "Mulțumesc",
      thankYouMessage: "Fie că donezi sau pur și simplu împărtășești poveștile noastre, ajuți la răspândirea frumuseții României. Mulțumesc din suflet!"
    }
  };

  const t = content[language];

  // Tracks which field was last copied so we can flash a "Copied" check next
  // to its button. Resets after a couple of seconds so repeat clicks still
  // give visual feedback.
  const [copiedField, setCopiedField] = useState<"iban" | "reference" | null>(null);

  const handleCopy = async (value: string, field: "iban" | "reference") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      toast.success(t.bankDetails.copySuccess);
      window.setTimeout(() => {
        setCopiedField((prev) => (prev === field ? null : prev));
      }, 2000);
    } catch {
      toast.error(t.bankDetails.copyError);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <PageHead title={t.title} description={t.subtitle} language={language} />
      <HeroBanner
        title={t.title}
        subtitle={t.subtitle}
        imageUrl="/hero/church.jpg"
        Icon={Heart}
        height="h-[60vh]"
      />

      <div className="container mx-auto px-4 py-20 max-w-5xl animate-fade-in">
        {/* Introduction */}
        <div className="text-center mb-24 max-w-3xl mx-auto">
          <p className="text-2xl font-serif italic text-foreground/80 leading-relaxed">
            {t.intro}
          </p>
          <div className="h-[1px] w-24 bg-accent mx-auto mt-10" />
        </div>

        {/* Why Support Section */}
        <div className="mb-24">
          <h2 className="text-4xl font-serif font-black italic text-primary text-center mb-12">
            {t.whySupport}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {t.reasons.map((reason, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="parchment-effect p-10 text-center border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_60px_rgb(0,0,0,0.08)] transition-all duration-700 hover:-translate-y-2 h-full flex flex-col items-center justify-center space-y-6 rounded-[2.5rem] md:rounded-[3rem] relative group">
                  <div className="absolute inset-2 border-[1px] border-accent/10 pointer-events-none group-hover:inset-1 transition-all duration-700 rounded-[2.5rem] md:rounded-[3rem]" />
                  <div className="bg-accent/10 rounded-full p-4 mb-2 group-hover:bg-accent/20 transition-colors duration-500">
                    <reason.icon className="h-8 w-8 text-accent" />
                  </div>
                  <h3 className="text-2xl font-serif italic font-bold text-primary">
                    {reason.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {reason.description}
                  </p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Donate Section */}
        <div className="mb-16">
          <h2 className="text-2xl font-serif italic text-primary text-center mb-4">
            {t.donateTitle}
          </h2>
          <p className="text-center text-muted-foreground mb-8">
            {t.donateIntro}
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              variant="outline"
              size="lg"
              className="h-auto py-8 flex flex-col gap-3 rounded-[2rem] hover:bg-accent hover:text-primary-foreground transition-all duration-500 group border-border/60 shadow-sm hover:shadow-xl hover:-translate-y-1"
              onClick={() => window.open("https://revolut.me/manu2492", "_blank", "noopener,noreferrer")}
            >
              <RevolutIcon className="h-10 w-10 group-hover:scale-110 transition-transform duration-500" />
              <span className="font-serif italic text-lg">{t.revolut}</span>
            </Button>
            
            <Button
              variant="outline"
              size="lg"
              className="h-auto py-8 flex flex-col gap-3 rounded-[2rem] hover:bg-accent hover:text-primary-foreground transition-all duration-500 group border-border/60 shadow-sm hover:shadow-xl hover:-translate-y-1"
              onClick={() => window.open("https://paypal.me/Constaa24?locale.x=ro_RO&country.x=RO", "_blank", "noopener,noreferrer")}
            >
              <CreditCard className="h-10 w-10 group-hover:scale-110 transition-transform duration-500" />
              <span className="font-serif italic text-lg">{t.paypal}</span>
            </Button>
            
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-auto py-8 flex flex-col gap-3 rounded-[2rem] hover:bg-accent hover:text-primary-foreground transition-all duration-500 group border-border/60 shadow-sm hover:shadow-xl hover:-translate-y-1"
                >
                  <Landmark className="h-10 w-10 group-hover:scale-110 transition-transform duration-500" />
                  <span className="font-serif italic text-lg">{t.bankTransfer}</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="parchment-effect border-none shadow-2xl sm:max-w-md rounded-[3rem] sm:rounded-[3.5rem] p-0 overflow-hidden">
                <DialogHeader className="px-6 sm:px-8 pt-10 pb-5 space-y-3">
                  <div className="flex justify-center">
                    <div className="h-14 w-14 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center shadow-sm">
                      <Landmark className="h-6 w-6 text-accent" />
                    </div>
                  </div>
                  <DialogTitle className="text-2xl sm:text-3xl font-serif italic font-bold text-primary text-center leading-tight">
                    {t.bankDetails.title}
                  </DialogTitle>
                  <div className="h-[1px] w-20 bg-accent mx-auto" />
                  <DialogDescription className="text-center text-sm font-serif italic text-muted-foreground">
                    {t.bankDetails.subtitle}
                  </DialogDescription>
                </DialogHeader>

                <div className="px-6 sm:px-8 pb-8 space-y-5">
                  {/* Beneficiary — quiet label/value row */}
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                      <User className="h-3.5 w-3.5 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-muted-foreground">
                        {t.bankDetails.beneficiaryLabel}
                      </p>
                      <p className="font-serif italic text-base sm:text-lg text-foreground/90">
                        {t.bankDetails.beneficiaryValue}
                      </p>
                    </div>
                  </div>

                  {/* IBAN — hero block. Largest, monospaced, copy-first. */}
                  <div className="rounded-3xl bg-accent/5 border border-accent/20 p-5 space-y-3 shadow-inner">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-accent">
                        {t.bankDetails.ibanLabel}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleCopy(t.bankDetails.ibanValue.replace(/\s+/g, ""), "iban")}
                        className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold text-muted-foreground hover:text-accent transition-colors rounded-full px-2.5 py-1 hover:bg-accent/10"
                        aria-label={t.bankDetails.copy}
                      >
                        {copiedField === "iban" ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            {t.bankDetails.copied}
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            {t.bankDetails.copy}
                          </>
                        )}
                      </button>
                    </div>
                    <p className="font-mono text-sm sm:text-base text-foreground/90 break-all leading-relaxed select-all">
                      {t.bankDetails.ibanValue}
                    </p>
                  </div>

                  {/* Bank — quiet label/value row */}
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Building2 className="h-3.5 w-3.5 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-muted-foreground">
                        {t.bankDetails.bankLabel}
                      </p>
                      <p className="font-serif italic text-base sm:text-lg text-foreground/90">
                        {t.bankDetails.bankValue}
                      </p>
                    </div>
                  </div>

                  {/* Payment reference — gold callout, the second thing the
                      user will paste into their banking app. */}
                  <div className="rounded-3xl bg-accent/10 border border-accent/30 p-5 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-accent" />
                        <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-accent">
                          {t.bankDetails.referenceLabel}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(t.bankDetails.referenceValue, "reference")}
                        className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold text-muted-foreground hover:text-accent transition-colors rounded-full px-2.5 py-1 hover:bg-accent/15"
                        aria-label={t.bankDetails.copy}
                      >
                        {copiedField === "reference" ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            {t.bankDetails.copied}
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            {t.bankDetails.copy}
                          </>
                        )}
                      </button>
                    </div>
                    <p className="font-serif italic font-bold text-lg text-accent select-all">
                      {t.bankDetails.referenceValue}
                    </p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Thank You Section */}
        <div className="text-center py-16 px-8 bg-secondary/10 rounded-[3rem] border border-dashed border-border/50 shadow-sm mt-12">
          <h3 className="text-xl font-serif italic text-primary mb-4">
            {t.thankYou}
          </h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            {t.thankYouMessage}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Support;
