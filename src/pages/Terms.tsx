import React from "react";
import { useLanguage } from "@/hooks/use-language";
import { ScrollText } from "lucide-react";
import { HeroBanner } from "@/components/layout/HeroBanner";

const Terms: React.FC = () => {
  const { language } = useLanguage();

  const lastUpdated = "2026-04-26";

  const content = {
    en: {
      title: "Terms of Service",
      subtitle: "The agreement between you and The RoStory",
      lastUpdated: `Last updated: ${lastUpdated}`,
      sections: [
        {
          heading: "Accepting these terms",
          body: "By creating an account, posting comments, or otherwise using The RoStory, you agree to these terms. If you don't agree, please don't use the service.",
        },
        {
          heading: "Your account",
          body: "You're responsible for keeping your account credentials safe. You agree to provide accurate registration information and not to impersonate other people. You must be at least 13 years old to create an account.",
        },
        {
          heading: "Your content",
          body: "When you post a comment, you keep ownership of what you wrote, but you grant The RoStory a non-exclusive license to display and distribute it as part of the site. Don't post anything you don't have the right to post (copyrighted material that isn't yours, private information about others, etc.).",
        },
        {
          heading: "What you can't do",
          body: "Don't use the site to harass, defame, or threaten anyone. Don't post hate speech, illegal content, spam, or misleading information. Don't try to hack, reverse-engineer, or overload the service. Don't scrape content for commercial purposes without permission.",
        },
        {
          heading: "Content moderation",
          body: "We reserve the right to remove any content or close any account that violates these terms or that we judge to be harmful to the community, at our sole discretion. We'll try to be reasonable, but we don't promise advance notice.",
        },
        {
          heading: "Intellectual property",
          body: "The articles published by The RoStory's editorial team, the site design, and the brand are the property of The RoStory. Don't copy, redistribute, or republish them without written permission. User-submitted comments belong to their authors.",
        },
        {
          heading: "Service availability",
          body: "The site is provided 'as is' without warranties. We do our best to keep it running, but we can't promise zero downtime, that all features will always work, or that your data will never be lost. Back up anything you can't afford to lose.",
        },
        {
          heading: "Limitation of liability",
          body: "To the fullest extent allowed by law, The RoStory and its operator are not liable for indirect, incidental, or consequential damages arising from your use of the site. Our total liability is limited to what you've paid us in the past 12 months — which is typically zero, since the site is free to use.",
        },
        {
          heading: "Changes to these terms",
          body: "We may update these terms occasionally. The 'Last updated' date above will reflect the most recent revision. Continued use of the site after changes means you accept the updated terms.",
        },
        {
          heading: "Governing law",
          body: "These terms are governed by the laws of Romania. Disputes will be handled in Romanian courts unless local consumer protection law gives you a stronger right.",
        },
        {
          heading: "Contact",
          body: "Questions about these terms? support@therostory.com.",
        },
      ],
    },
    ro: {
      title: "Termeni și Condiții",
      subtitle: "Acordul dintre tine și The RoStory",
      lastUpdated: `Ultima actualizare: ${lastUpdated}`,
      sections: [
        {
          heading: "Acceptarea acestor termeni",
          body: "Prin crearea unui cont, postarea de comentarii sau utilizarea în alt mod a The RoStory, ești de acord cu acești termeni. Dacă nu ești de acord, te rugăm să nu folosești serviciul.",
        },
        {
          heading: "Contul tău",
          body: "Ești responsabil pentru păstrarea în siguranță a datelor de autentificare. Ești de acord să furnizezi informații exacte de înregistrare și să nu te dai drept altă persoană. Trebuie să ai cel puțin 13 ani pentru a crea un cont.",
        },
        {
          heading: "Conținutul tău",
          body: "Când postezi un comentariu, păstrezi dreptul de proprietate asupra a ceea ce ai scris, dar acorzi The RoStory o licență non-exclusivă de a-l afișa și distribui ca parte a site-ului. Nu posta nimic ce nu ai dreptul să postezi (material protejat de drepturi de autor care nu îți aparține, informații private despre alții etc.).",
        },
        {
          heading: "Ce nu ai voie să faci",
          body: "Nu folosi site-ul pentru a hărțui, defăima sau amenința pe cineva. Nu posta discursuri de ură, conținut ilegal, spam sau informații înșelătoare. Nu încerca să spargi, să reversezi sau să suprasoliciți serviciul. Nu extrage conținut în scopuri comerciale fără permisiune.",
        },
        {
          heading: "Moderarea conținutului",
          body: "Ne rezervăm dreptul de a elimina orice conținut sau de a închide orice cont care încalcă acești termeni sau pe care îl considerăm dăunător comunității, la discreția noastră. Vom încerca să fim rezonabili, dar nu promitem notificare în avans.",
        },
        {
          heading: "Proprietate intelectuală",
          body: "Articolele publicate de echipa editorială The RoStory, design-ul site-ului și brandul sunt proprietatea The RoStory. Nu le copia, redistribui sau republica fără permisiune scrisă. Comentariile postate de utilizatori aparțin autorilor lor.",
        },
        {
          heading: "Disponibilitatea serviciului",
          body: "Site-ul este oferit „așa cum este”, fără garanții. Facem tot posibilul să-l menținem funcțional, dar nu putem promite zero timp de nefuncționare, că toate funcționalitățile vor funcționa mereu sau că datele tale nu se vor pierde niciodată. Salvează separat orice nu îți poți permite să pierzi.",
        },
        {
          heading: "Limitarea răspunderii",
          body: "În măsura maximă permisă de lege, The RoStory și operatorul său nu sunt răspunzători pentru daune indirecte, incidentale sau consecutive care rezultă din utilizarea site-ului. Răspunderea noastră totală este limitată la ce ne-ai plătit în ultimele 12 luni — ceea ce de obicei înseamnă zero, deoarece site-ul este gratuit.",
        },
        {
          heading: "Modificări ale acestor termeni",
          body: "Putem actualiza acești termeni ocazional. Data „Ultima actualizare” de mai sus va reflecta cea mai recentă revizuire. Utilizarea continuă a site-ului după modificări înseamnă că accepți termenii actualizați.",
        },
        {
          heading: "Lege aplicabilă",
          body: "Acești termeni sunt guvernați de legile României. Disputele vor fi soluționate în instanțele din România, cu excepția cazului în care legislația locală de protecție a consumatorului îți oferă un drept mai puternic.",
        },
        {
          heading: "Contact",
          body: "Întrebări despre acești termeni? support@therostory.com.",
        },
      ],
    },
  };

  const c = content[language];

  return (
    <div className="min-h-screen bg-background pb-20">
      <HeroBanner
        title={c.title}
        subtitle={c.subtitle}
        imageUrl="/hero/parliament.jpg"
        Icon={ScrollText}
        height="h-[50vh]"
      />

      <div className="container mx-auto px-4 py-16 max-w-3xl animate-fade-in">
        <p className="text-sm font-sans uppercase tracking-[0.2em] text-accent font-bold mb-12 text-center">
          {c.lastUpdated}
        </p>

        <div className="space-y-12">
          {c.sections.map((section, i) => (
            <section key={i}>
              <h2 className="text-2xl font-serif font-black italic text-primary mb-4">
                {section.heading}
              </h2>
              <p className="text-foreground/80 font-serif leading-relaxed text-lg">
                {section.body}
              </p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Terms;
