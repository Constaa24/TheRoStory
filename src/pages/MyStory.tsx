import React from "react";
import { useLanguage } from "@/hooks/use-language";
import { Link } from "react-router-dom";
import { Heart, Lightbulb, Mountain, Castle } from "lucide-react";
import { PageHead } from "@/components/layout/PageHead";
import { Divider, Rosette } from "@/components/story/Ornaments";

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
  const en = language === 'en';

  // A part of the letter: a Roman numeral beside its heading.
  const part = (numeral: string, title: string, size: string | number = 36) => (
    <div className="flex items-baseline gap-4" style={{ marginBottom: 16 }}>
      <span aria-hidden="true" className="font-display italic" style={{ fontSize: 28, color: 'var(--gold)' }}>{numeral}.</span>
      <h2 className="rs-display" style={{ fontSize: size, lineHeight: 1, letterSpacing: 0 }}>{title}</h2>
    </div>
  );

  return (
    <div className="rs-in">
      <PageHead
        title={t.title}
        description={en
          ? "The story behind The RoStory — why this project exists, who's behind it, and the love for Romania that drives it."
          : "Povestea din spatele The RoStory — de ce există acest proiect, cine este în spatele lui și dragostea pentru România."}
        language={language}
      />

      {/* The title, beside the salt galleries. */}
      <section className="ed-container" style={{ paddingTop: 'clamp(40px, 6vw, 80px)', paddingBottom: 'clamp(48px, 6vw, 88px)' }}>
        <div className="grid grid-cols-1 min-[1000px]:grid-cols-2 gap-[clamp(36px,5vw,72px)] items-center">
          <div className="flex flex-col gap-[22px]">
            <p className="rs-eyebrow">{t.subtitle}</p>
            <h1 className="rs-display" style={{ fontSize: 'clamp(56px, 8vw, 124px)', lineHeight: 0.92, letterSpacing: '-0.025em' }}>{t.title}</h1>
            <p className="m-0 font-display italic" style={{ fontSize: 'clamp(24px, 2.4vw, 32px)', lineHeight: 1.3, color: 'var(--text)' }}>{t.lead}</p>
          </div>
          <figure className="m-0 w-full max-w-[520px] justify-self-center min-[1000px]:justify-self-end" style={{ padding: 10, border: '1px solid var(--line)', borderRadius: '50% 50% 24px 24px / 26% 26% 24px 24px' }}>
            <div className="relative overflow-hidden" style={{ aspectRatio: '4 / 4.4', borderRadius: '50% 50% 14px 14px / 30% 30% 14px 14px', background: 'var(--paper)' }}>
              <picture>
                <source type="image/avif" srcSet="/hero/salina.avif" />
                <source type="image/webp" srcSet="/hero/salina.webp" />
                <img
                  src="/hero/salina.jpg"
                  alt={en ? 'The salt galleries of Salina Turda' : 'Galeriile de sare ale Salinei Turda'}
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="eager"
                />
              </picture>
            </div>
          </figure>
        </div>
      </section>

      {/* The letter: why, and what was seen. */}
      <section className="rs-band">
        <div className="ed-container grid grid-cols-1 min-[1000px]:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-[clamp(36px,5vw,88px)]" style={{ paddingBlock: 'clamp(56px, 7vw, 104px)' }}>
          <div>
            <Rosette className="block mb-5" />
            <p className="m-0 mb-2 font-display italic" style={{ fontSize: 30, color: 'var(--gold-2)' }}>{t.greeting}</p>
            <p className="m-0" style={{ fontSize: 19, lineHeight: 1.7, color: 'var(--text-dim)' }}>{t.intro}</p>
          </div>
          <div className="flex flex-col gap-12 max-w-[720px]">
            <div>
              {part('I', t.missionTitle)}
              <blockquote className="rs-pullquote">{en ? `“${t.mission}”` : `„${t.mission}”`}</blockquote>
            </div>
            <div>
              {part('II', t.problemTitle)}
              <p className="m-0" style={{ fontSize: 19, lineHeight: 1.75, color: 'var(--text)', textWrap: 'pretty' }}>{t.problem}</p>
            </div>
          </div>
        </div>
      </section>

      {/* What Romania is, in four. */}
      <section className="ed-container" style={{ paddingTop: 'clamp(56px, 7vw, 104px)' }}>
        <div style={{ marginBottom: 36 }}>{part('III', t.truthTitle, 'clamp(36px, 4vw, 56px)')}</div>
        <ul className="rs-truths list-none m-0 p-0">
          {t.truths.map((truth) => (
            <li key={truth.title}>
              {/* Each truth opens on its own stitch: the icon as the knot,
                  the thread running on to the edge of its column. */}
              <div className="rs-truth-head" aria-hidden="true">
                <span className="rs-truth-ico"><truth.icon className="w-5 h-5" strokeWidth={1.6} /></span>
                <span className="sb-thread rs-truth-thread" />
              </div>
              <h3 className="rs-display" style={{ margin: '0 0 10px', fontSize: 28, lineHeight: 1.1, letterSpacing: 0 }}>{truth.title}</h3>
              <p className="m-0" style={{ fontSize: 16.5, lineHeight: 1.6, color: 'var(--text-dim)' }}>{truth.description}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Where it goes from here. */}
      <section className="ed-container text-center" style={{ paddingTop: 'clamp(64px, 8vw, 120px)', maxWidth: 900 }}>
        <span aria-hidden="true" className="font-display italic" style={{ fontSize: 28, color: 'var(--gold)' }}>IV.</span>
        <h2 className="rs-display" style={{ margin: '6px 0 20px', fontSize: 'clamp(36px, 4vw, 56px)', lineHeight: 1 }}>{t.visionTitle}</h2>
        <p className="mx-auto my-0 max-w-[720px]" style={{ fontSize: 20, lineHeight: 1.7, color: 'var(--text)', textWrap: 'pretty' }}>{t.vision}</p>
        <Divider className="mx-auto" style={{ maxWidth: 360, marginBlock: 56 }} />
        <h2 className="rs-display" style={{ margin: '0 0 16px', fontStyle: 'italic', fontSize: 'clamp(40px, 5vw, 72px)', lineHeight: 1, color: 'var(--gold-2)' }}>{t.callToAction}</h2>
        <p className="mx-auto mb-7 mt-0 max-w-[640px]" style={{ fontSize: 19, lineHeight: 1.7, color: 'var(--text-dim)' }}>{t.callToActionText}</p>
        <p className="m-0 mb-8 font-display italic" style={{ fontSize: 24, color: 'var(--parchment)' }}>
          — {t.signature} <span aria-hidden="true" style={{ color: 'var(--oxblood-2)' }}>❤</span>
        </p>
        <div className="flex flex-wrap justify-center gap-2.5">
          <Link to="/" className="rs-btn">{en ? 'Begin with a story →' : 'Începe cu o poveste →'}</Link>
          <Link to="/map" className="rs-btn rs-btn-ghost">{en ? 'Open the map' : 'Deschide harta'}</Link>
        </div>
      </section>
    </div>
  );
};

export default MyStory;
