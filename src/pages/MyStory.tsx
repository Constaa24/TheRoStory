import React from "react";
import { useLanguage } from "@/hooks/use-language";
import { Heart, Globe, Lightbulb, Mountain, Castle } from "lucide-react";
import { PageHead } from "@/components/layout/PageHead";

const MyStory: React.FC = () => {
  const { language } = useLanguage();

  const content = {
    en: {
      title: "My Story",
      subtitle: "From the founder",
      lead: "Why I created The RoStory.",
      greeting: "Hello, and welcome.",
      intro: "I'm the creator behind The RoStory, and I want to share with you the reason this project exists.",
      missionTitle: "The mission",
      mission: "To educate people about the true Romania — a country rich in history, culture, and natural beauty that not many people truly know or understand.",
      problemTitle: "What I saw",
      problem: "When I traveled abroad and met people from different countries, I noticed something troubling. Many had a very limited or even negative perception of Romania. They associated it with stereotypes, misconceptions, or simply had no knowledge of what Romania truly offers.",
      truthTitle: "The truth about Romania",
      truths: [
        { icon: Castle, title: "Rich history", description: "From the ancient Dacian civilization to medieval fortresses, Romania has a history spanning thousands of years." },
        { icon: Mountain, title: "Breathtaking nature", description: "The Carpathians, the Danube Delta, pristine forests — some of Europe's most untouched landscapes." },
        { icon: Heart, title: "Warm culture", description: "Traditional music, folk art, unique cuisine, and some of the most hospitable people you'll ever meet." },
        { icon: Lightbulb, title: "Unexpected innovation", description: "From the inventor of the fountain pen to pioneers in aviation, contributions far beyond what's commonly known." },
      ],
      visionTitle: "The vision",
      vision: "Through The RoStory, I want to change perceptions one story at a time. Each article is carefully crafted to share authentic experiences, historical facts, and cultural insights that paint the real picture of Romania.",
      callToAction: "Join the journey.",
      callToActionText: "Whether you're Romanian wanting to reconnect with your roots, or a curious traveler looking to discover a hidden gem of Europe — this archive is for you. Let's wander together.",
      signature: "With love for Romania",
    },
    ro: {
      title: "Povestea mea",
      subtitle: "De la fondator",
      lead: "De ce am creat The RoStory.",
      greeting: "Bună și bine ai venit.",
      intro: "Sunt creatorul din spatele The RoStory și vreau să îți împărtășesc motivul pentru care există acest proiect.",
      missionTitle: "Misiunea",
      mission: "Să educ oamenii despre adevărata Românie — o țară bogată în istorie, cultură și frumusețe naturală pe care nu mulți o cunosc sau o înțeleg cu adevărat.",
      problemTitle: "Ce am văzut",
      problem: "Călătorind în străinătate și întâlnind oameni din alte țări, am observat ceva îngrijorător. Mulți aveau o percepție foarte limitată sau chiar negativă despre România. O asociau cu stereotipuri sau pur și simplu nu știau ce oferă cu adevărat țara.",
      truthTitle: "Adevărul despre România",
      truths: [
        { icon: Castle, title: "Istorie bogată", description: "De la civilizația dacică la fortărețe medievale, o istorie de mii de ani care rivalizează cu oricare națiune." },
        { icon: Mountain, title: "Natură uimitoare", description: "Munții Carpați, Delta Dunării, păduri neatinse — unele dintre cele mai nealterate peisaje din Europa." },
        { icon: Heart, title: "Cultură caldă", description: "Muzică tradițională, artă populară, bucătărie unică și unii dintre cei mai ospitalieri oameni." },
        { icon: Lightbulb, title: "Inovație neașteptată", description: "De la inventatorul stiloului la pionieri în aviație, contribuții cu mult dincolo de ce se știe obișnuit." },
      ],
      visionTitle: "Viziunea",
      vision: "Prin The RoStory, vreau să schimb percepții, spunând câte o poveste pe rând. Fiecare articol este realizat cu grijă pentru a împărtăși experiențe autentice și perspective culturale care pictează imaginea reală a României.",
      callToAction: "Alătură-te călătoriei.",
      callToActionText: "Fie că ești român și vrei să te reconectezi cu rădăcinile tale, sau un călător curios — această arhivă este pentru tine. Hai să rătăcim împreună.",
      signature: "Cu dragoste pentru România",
    },
  };

  const t = content[language];

  return (
    <div className="screen-anim pb-20">
      <PageHead
        title={t.title}
        description={language === 'en'
          ? "The story behind The RoStory — why this project exists, who's behind it, and the love for Romania that drives it."
          : "Povestea din spatele The RoStory — de ce există acest proiect, cine este în spatele lui și dragostea pentru România."}
        language={language}
      />

      {/* HERO */}
      <section className="relative overflow-hidden" style={{ height: '60vh', minHeight: 480, borderBottom: '1px solid var(--line-soft)' }}>
        <div className="absolute inset-0">
          <picture>
            <source type="image/avif" srcSet="/hero/salina.avif" />
            <source type="image/webp" srcSet="/hero/salina.webp" />
            <img src="/hero/salina.jpg" alt="" aria-hidden="true" className="w-full h-full object-cover" loading="eager" />
          </picture>
          <div className="absolute inset-0" style={{ background: 'var(--scrim-hero-short)' }} />
        </div>
        <div className="ed-container relative h-full flex flex-col justify-end pb-16 pt-10">
          <div className="eyebrow mb-4">{t.subtitle}</div>
          <h1
            className="font-display italic font-medium m-0 pb-4"
            style={{ fontSize: 'clamp(56px, 8vw, 120px)', lineHeight: 1, letterSpacing: '-0.01em', color: '#f4ead7' }}
          >
            {t.lead}
          </h1>
        </div>
      </section>

      {/* GREETING + INTRO */}
      <section style={{ padding: '80px 0 40px' }}>
        <div className="ed-container">
          <div className="max-w-[760px] mx-auto text-center">
            <p className="font-display italic" style={{ fontSize: 32, color: 'var(--gold)', marginBottom: 18 }}>{t.greeting}</p>
            <p style={{ fontSize: 19, color: 'var(--text-dim)', lineHeight: 1.65, margin: 0 }}>{t.intro}</p>
          </div>
        </div>
      </section>

      {/* MISSION (pull-quote-like) */}
      <section style={{ padding: '40px 0', borderTop: '1px solid var(--line-soft)', borderBottom: '1px solid var(--line-soft)', background: 'linear-gradient(180deg, transparent, rgba(201,169,110,0.04), transparent)' }}>
        <div className="ed-container">
          <div className="max-w-[920px] mx-auto py-16">
            <div className="flex items-start gap-6">
              <Globe className="w-7 h-7 shrink-0 mt-3" style={{ color: 'var(--gold)' }} />
              <div>
                <div className="eyebrow mb-3">{t.missionTitle}</div>
                <p className="font-display italic m-0" style={{ fontSize: 'clamp(28px, 3vw, 40px)', lineHeight: 1.25, color: 'var(--parchment)', textWrap: 'balance' as React.CSSProperties['textWrap'] }}>
                  “{t.mission}”
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section style={{ padding: '80px 0' }}>
        <div className="ed-container">
          <div className="max-w-[760px] mx-auto">
            <div className="eyebrow mb-4">{language === 'en' ? 'The problem' : 'Problema'}</div>
            <h2 className="font-display italic font-medium m-0 mb-6" style={{ fontSize: 'clamp(32px, 3.4vw, 48px)', lineHeight: 1.15, color: 'var(--parchment)' }}>
              {t.problemTitle}
            </h2>
            <p style={{ fontSize: 18, color: 'var(--text)', lineHeight: 1.75 }}>{t.problem}</p>
          </div>
        </div>
      </section>

      {/* TRUTHS */}
      <section style={{ padding: '80px 0', borderTop: '1px solid var(--line-soft)' }}>
        <div className="ed-container">
          <div className="eyebrow mb-3.5">{language === 'en' ? 'Four truths' : 'Patru adevăruri'}</div>
          <h2 className="font-display italic font-medium m-0 mb-12" style={{ fontSize: 'clamp(36px, 5vw, 64px)', lineHeight: 1.05, color: 'var(--parchment)' }}>
            {t.truthTitle}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {t.truths.map((truth, i) => (
              <div key={i} style={{ borderTop: '1px solid var(--line)', paddingTop: 28 }}>
                <div className="flex items-baseline gap-4 mb-4">
                  <span className="font-ui text-[12px] uppercase" style={{ letterSpacing: '0.18em', color: 'var(--gold)' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <truth.icon className="w-5 h-5" style={{ color: 'var(--gold)' }} />
                </div>
                <h3 className="font-display italic font-medium m-0 mb-3" style={{ fontSize: 32, lineHeight: 1.1, color: 'var(--parchment)' }}>
                  {truth.title}
                </h3>
                <p className="m-0" style={{ fontSize: 16, color: 'var(--text-dim)', lineHeight: 1.6 }}>{truth.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* VISION */}
      <section style={{ padding: '80px 0' }}>
        <div className="ed-container">
          <div className="max-w-[760px] mx-auto">
            <div className="eyebrow mb-4">{language === 'en' ? 'Looking ahead' : 'Privind înainte'}</div>
            <h2 className="font-display italic font-medium m-0 mb-6" style={{ fontSize: 'clamp(32px, 3.4vw, 48px)', lineHeight: 1.15, color: 'var(--parchment)' }}>
              {t.visionTitle}
            </h2>
            <p style={{ fontSize: 18, color: 'var(--text)', lineHeight: 1.75 }}>{t.vision}</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '80px 0', borderTop: '1px solid var(--line-soft)' }}>
        <div className="ed-container">
          <div className="text-center max-w-[720px] mx-auto">
            <h3 className="font-display italic font-medium m-0" style={{ fontSize: 'clamp(36px, 4.4vw, 60px)', lineHeight: 1.05, color: 'var(--parchment)' }}>
              {t.callToAction}
            </h3>
            <p className="mt-6 mx-auto max-w-[520px]" style={{ fontSize: 18, color: 'var(--text-dim)', lineHeight: 1.65 }}>
              {t.callToActionText}
            </p>
            <p className="font-display italic mt-10" style={{ fontSize: 24, color: 'var(--gold)' }}>
              {t.signature} <span style={{ color: 'var(--oxblood-2)' }}>❤</span>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default MyStory;
