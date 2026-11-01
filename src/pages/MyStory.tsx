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

  // A chapter of the letter: a Roman numeral beside its heading.
  const part = (numeral: string, title: string, className = '') => (
    <div className={`flex items-baseline gap-3.5 ${className}`}>
      <span className="sb-numeral" style={{ fontSize: 26 }} aria-hidden="true">{numeral}</span>
      <h3 className="sb-h3">{title}</h3>
    </div>
  );

  return (
    <div className="screen-anim">
      <PageHead
        title={t.title}
        description={en
          ? "The story behind The RoStory — why this project exists, who's behind it, and the love for Romania that drives it."
          : "Povestea din spatele The RoStory — de ce există acest proiect, cine este în spatele lui și dragostea pentru România."}
        language={language}
      />

      <section className="ed-container" style={{ paddingTop: 'clamp(40px, 6vw, 64px)', paddingBottom: 'clamp(56px, 7vw, 88px)' }}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div className="flex flex-col gap-5">
            <p className="sb-kicker">{t.subtitle}</p>
            <h1 className="sb-h1">{t.title}</h1>
            <p className="font-display italic m-0" style={{ fontSize: 26, lineHeight: 1.35, color: 'var(--text)' }}>{t.lead}</p>
          </div>
          <div className="sb-window w-full max-w-[520px] justify-self-center lg:justify-self-end">
            <div className="sb-arch" style={{ aspectRatio: '4 / 4.4' }}>
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
          </div>
        </div>
      </section>

      {/* The letter itself, on paper. */}
      <section className="ed-container" style={{ paddingBottom: 'clamp(64px, 8vw, 96px)' }}>
        <article className="sb-paper mx-auto max-w-[820px]" style={{ padding: 'clamp(28px, 6vw, 80px)' }}>
          <h2 className="sb-h2" style={{ fontSize: 'clamp(34px, 3.6vw, 52px)' }}>{t.greeting}</h2>
          <div className="sb-prose mt-6">
            <p className="sb-dropcap">{t.intro}</p>
          </div>

          <div className="sb-chapter-head" style={{ marginBlock: 'clamp(44px, 6vw, 64px)' }}>
            <Rosette />
            <p className="sb-kicker">{t.missionTitle}</p>
            <p className="sb-h3 max-w-[640px]" style={{ fontSize: 'clamp(26px, 2.8vw, 38px)', lineHeight: 1.25 }}>
              {en ? `“${t.mission}”` : `„${t.mission}”`}
            </p>
          </div>

          {part('I', t.problemTitle, 'mb-3.5')}
          <div className="sb-prose">
            <p>{t.problem}</p>
          </div>

          {part('II', t.truthTitle, 'mt-14 mb-5')}
          <ul className="list-none m-0 p-0 grid grid-cols-1 md:grid-cols-2 gap-4">
            {t.truths.map((truth) => (
              <li key={truth.title} className="grid gap-4 p-5" style={{ gridTemplateColumns: '48px minmax(0, 1fr)', borderRadius: 18, border: '1px dashed var(--gold-deep)' }}>
                <span className="grid place-items-center" style={{ width: 48, height: 48, borderRadius: '50%', border: '1px solid var(--line)', color: 'var(--gold)' }}>
                  <truth.icon className="w-[22px] h-[22px]" aria-hidden="true" />
                </span>
                <span className="flex flex-col gap-1.5">
                  <span className="sb-h4">{truth.title}</span>
                  <span className="sb-dim" style={{ fontSize: 16.5, lineHeight: 1.55 }}>{truth.description}</span>
                </span>
              </li>
            ))}
          </ul>

          {part('III', t.visionTitle, 'mt-14 mb-3.5')}
          <div className="sb-prose">
            <p>{t.vision}</p>
          </div>

          <Divider style={{ marginBlock: '56px 40px' }} />
          <h3 className="sb-h2" style={{ fontSize: 'clamp(32px, 3.2vw, 46px)' }}>{t.callToAction}</h3>
          <div className="sb-prose mt-4">
            <p>{t.callToActionText}</p>
          </div>
          <p className="font-display italic mt-10 mb-0" style={{ fontSize: 34, lineHeight: 1.2, color: 'var(--gold)' }}>
            {t.signature} <span aria-hidden="true" style={{ color: 'var(--oxblood-2)' }}>❤</span>
          </p>
          <div className="flex flex-wrap gap-3 mt-10">
            <Link to="/" className="sb-btn">{en ? 'Begin with a story →' : 'Începe cu o poveste →'}</Link>
            <Link to="/map" className="sb-btn sb-btn-ghost">{en ? 'Open the map' : 'Deschide harta'}</Link>
          </div>
        </article>
      </section>
    </div>
  );
};

export default MyStory;
