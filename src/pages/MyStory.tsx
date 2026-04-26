import React from "react";
import { useLanguage } from "@/hooks/use-language";
import { MapPin, Heart, Globe, Lightbulb, Mountain, Castle, BookOpen } from "lucide-react";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import { PageHead } from "@/components/layout/PageHead";

const MyStory: React.FC = () => {
  const { language } = useLanguage();

  const content = {
    en: {
      title: "My Story",
      subtitle: "Why I Created The RoStory",
      greeting: "Hello, and welcome!",
      intro: "I'm the creator behind The RoStory, and I want to share with you the reason this project exists.",
      missionTitle: "The Mission",
      mission: "To educate people about the true Romania — a country rich in history, culture, and natural beauty that not many people truly know or understand.",
      problemTitle: "The Problem I Saw",
      problem: "When I traveled abroad and met people from different countries, I noticed something troubling. Many had a very limited or even negative perception of Romania. They associated it with stereotypes, misconceptions, or simply had no knowledge of what Romania truly offers.",
      truthTitle: "The Truth About Romania",
      truths: [
        {
          icon: Castle,
          title: "Rich History",
          description: "From the ancient Dacian civilization to medieval fortresses, Romania has a history spanning thousands of years that rivals any European nation."
        },
        {
          icon: Mountain,
          title: "Breathtaking Nature",
          description: "The Carpathian Mountains, the Danube Delta, pristine forests, Romania holds some of Europe's most untouched natural landscapes."
        },
        {
          icon: Heart,
          title: "Warm Culture",
          description: "Traditional music, folk art, unique cuisine, and some of the most hospitable people you'll ever meet."
        },
        {
          icon: Lightbulb,
          title: "Unexpected Innovation",
          description: "From the inventor of the fountain pen to pioneers in aviation, Romania has contributed significantly to science and culture."
        }
      ],
      visionTitle: "My Vision",
      vision: "Through The RoStory, I want to change perceptions one story at a time. Each article is carefully crafted to share authentic experiences, historical facts, and cultural insights that paint the real picture of Romania.",
      callToAction: "Join the Journey",
      callToActionText: "Whether you're Romanian wanting to reconnect with your roots, or a curious traveler looking to discover a hidden gem of Europe, The RoStory is for you. Let's explore together!",
      signature: "With love for Romania"
    },
    ro: {
      title: "Povestea Mea",
      subtitle: "De ce am creat The RoStory",
      greeting: "Bună și bine ai venit!",
      intro: "Sunt creatorul din spatele The RoStory și vreau să îți împărtășesc motivul pentru care există acest proiect.",
      missionTitle: "Misiunea",
      mission: "Să educ oamenii despre adevărata Românie — o țară bogată în istorie, cultură și frumusețe naturală pe care nu mulți oameni o cunosc sau o înțeleg cu adevărat.",
      problemTitle: "Problema pe care am observat-o",
      problem: "Când am călătorit în străinătate și am întâlnit oameni din diferite țări, am observat ceva îngrijorător. Mulți aveau o percepție foarte limitată sau chiar negativă despre România. O asociau cu stereotipuri, concepții greșite sau pur și simplu nu știau ce oferă cu adevărat România.",
      truthTitle: "Adevărul Despre România",
      truths: [
        {
          icon: Castle,
          title: "Istorie Bogată",
          description: "De la civilizația dacică antică la fortăreţele medievale, România are o istorie de mii de ani care rivalizează cu oricare națiune europeană."
        },
        {
          icon: Mountain,
          title: "Natură Uimitoare",
          description: "Munții Carpați, Delta Dunării, păduri neatinse, România găzduiește unele dintre cele mai nealterate peisaje naturale din Europa."
        },
        {
          icon: Heart,
          title: "Cultură Caldă",
          description: "Muzică tradițională, artă populară, bucătărie unică și unii dintre cei mai ospitalieri oameni pe care îi vei întâlni."
        },
        {
          icon: Lightbulb,
          title: "Inovație Neașteptată",
          description: "De la inventatorul stiloului la pionieri în aviație, România a contribuit semnificativ la știință și cultură."
        }
      ],
      visionTitle: "Viziunea Mea",
      vision: "Prin The RoStory, vreau să schimb percepții, spunând câte o poveste pe rând. Fiecare articol este realizat cu grijă pentru a împărtăși experiențe autentice, fapte istorice și perspective culturale care pictează imaginea reală a României.",
      callToAction: "Alătură-te Călătoriei",
      callToActionText: "Fie că ești român și vrei să te reconectezi cu rădăcinile tale, sau un călător curios care vrea să descopere o comoară ascunsă a Europei, The RoStory este pentru tine. Hai să explorăm împreună!",
      signature: "Cu dragoste pentru România"
    }
  };

  const t = content[language];

  return (
    <div className="min-h-screen bg-background">
      <PageHead
        title={t.title}
        description={language === "en"
          ? "The story behind The RoStory — why this project exists, who's behind it, and the love for Romania that drives it."
          : "Povestea din spatele The RoStory — de ce există acest proiect, cine este în spatele lui și dragostea pentru România care îl motivează."}
        language={language}
      />
      {/* Hero Section */}
      <section className="relative h-[70vh] flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 scale-105"
          style={{ 
            backgroundImage: `url("/hero/salina.jpg")`,
          }}
        >
          <div className="absolute inset-0 bg-black/45" />
        </div>
        
        <div className="relative z-10 text-center space-y-6 px-4 max-w-4xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex justify-center mb-4"
          >
            <div className="bg-white/20 backdrop-blur-md rounded-full p-4 border border-white/30">
              <BookOpen className="h-10 w-10 text-white" />
            </div>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-7xl font-serif font-black text-white tracking-tighter"
          >
            {t.title}
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg md:text-xl text-white/90 font-serif italic max-w-2xl mx-auto"
          >
            {t.subtitle}
          </motion.p>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </section>

      <div className="container mx-auto px-4 py-12 max-w-4xl animate-fade-in space-y-16">
        {/* Greeting */}
        <div className="text-center mb-12">
          <p className="text-2xl font-serif italic text-primary mb-4">
            {t.greeting}
          </p>
          <p className="text-lg text-foreground/80 leading-relaxed">
            {t.intro}
          </p>
        </div>

        {/* Mission */}
        <Card className="p-10 md:p-12 mb-16 rounded-[2.5rem] md:rounded-[3rem] bg-accent/5 border-none shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-accent/10 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-accent/20 transition-colors duration-700" />
          <div className="relative z-10">
            <h2 className="text-2xl font-serif italic text-accent mb-6 flex items-center gap-3">
              <Globe className="h-8 w-8" />
              {t.missionTitle}
            </h2>
            <p className="text-xl md:text-2xl text-foreground/90 font-serif italic leading-relaxed">
              "{t.mission}"
            </p>
          </div>
        </Card>

        {/* Problem */}
        <div className="mb-12">
          <h2 className="text-2xl font-serif italic text-primary mb-4">
            {t.problemTitle}
          </h2>
          <p className="text-foreground/80 leading-relaxed">
            {t.problem}
          </p>
        </div>

        {/* The Truth About Romania */}
        <div className="mb-12">
          <h2 className="text-2xl font-serif italic text-primary mb-8 flex items-center gap-3">
            <MapPin className="h-6 w-6 text-accent" />
            {t.truthTitle}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {t.truths.map((truth, index) => (
              <Card key={index} className="p-8 md:p-10 rounded-[2.5rem] border-none bg-secondary/10 hover:bg-secondary/20 transition-all duration-500 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_60px_rgb(0,0,0,0.08)] hover:-translate-y-2 group">
                <div className="flex flex-col items-start gap-6">
                  <div className="bg-accent/10 rounded-full p-5 shrink-0 group-hover:bg-accent/20 transition-colors duration-500">
                    <truth.icon className="h-8 w-8 text-accent" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-serif italic font-bold text-primary mb-3">
                      {truth.title}
                    </h3>
                    <p className="text-base text-muted-foreground leading-relaxed">
                      {truth.description}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Vision */}
        <div className="mb-12">
          <h2 className="text-2xl font-serif italic text-primary mb-4">
            {t.visionTitle}
          </h2>
          <p className="text-foreground/80 leading-relaxed">
            {t.vision}
          </p>
        </div>

        {/* Call to Action */}
        <div className="text-center py-20 px-8 bg-gradient-to-br from-secondary/20 to-accent/5 rounded-[3rem] border-none shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-accent/10 rounded-full -mr-32 -mt-32 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-secondary/20 rounded-full -ml-32 -mb-32 blur-2xl" />
          <div className="relative z-10">
            <h3 className="text-3xl md:text-4xl font-serif italic font-black text-primary mb-6">
              {t.callToAction}
            </h3>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed">
              {t.callToActionText}
            </p>
            <p className="text-accent font-serif italic text-2xl font-bold">
              {t.signature} <span className="text-red-500">❤️</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyStory;
