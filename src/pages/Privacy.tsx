import React from "react";
import { useLanguage } from "@/hooks/use-language";
import { Shield } from "lucide-react";
import { HeroBanner } from "@/components/layout/HeroBanner";

const Privacy: React.FC = () => {
  const { language } = useLanguage();

  const lastUpdated = "2026-04-26";

  const content = {
    en: {
      title: "Privacy Policy",
      subtitle: "How we handle your data, in plain language",
      lastUpdated: `Last updated: ${lastUpdated}`,
      sections: [
        {
          heading: "Who we are",
          body: "The RoStory is a personal storytelling project run by a single individual based in Romania. This page explains what data the site collects when you use it, why, and how you can control it.",
        },
        {
          heading: "What we collect",
          body: "When you create an account, we store your email address, a display name, and an optional avatar image you upload. When you read articles, we store an anonymous view count per article. When you favorite an article, we store the link between your user ID and that article. When you post a comment, we store its text, the time you posted it, and the user ID it belongs to.",
        },
        {
          heading: "What we do not collect",
          body: "We do not use third-party advertising trackers, marketing pixels, or analytics tools that profile you. We do not sell, rent, or trade your data. We do not use cookies for advertising.",
        },
        {
          heading: "Where data is stored",
          body: "Account data and content are stored in Supabase (a managed PostgreSQL provider, hosted in the EU when available). Uploaded images are stored in Supabase Storage. The site itself is served from Vercel. Contact-form messages are sent via Resend.",
        },
        {
          heading: "Local storage on your device",
          body: "We store a few small preferences in your browser's localStorage and sessionStorage: your selected language, theme (light/dark), and a per-article session flag to avoid double-counting views in a single session. These never leave your device.",
        },
        {
          heading: "Authentication providers",
          body: "If you sign in with Google, Google sees that you authenticated to The RoStory. Beyond that, we only receive the basic profile fields (email, name, avatar) you've chosen to share with us.",
        },
        {
          heading: "Your rights",
          body: "You can edit your profile at any time from the Profile page. You can permanently delete your account and all associated content (your articles, comments, favorites) by clicking 'Delete account' on your profile. You can request a complete export of your data via the Profile page export button. If anything fails or you have questions, email support@therostory.com.",
        },
        {
          heading: "Changes to this policy",
          body: "When this policy changes materially, the 'Last updated' date above is updated. We do not currently send notifications for policy changes.",
        },
        {
          heading: "Contact",
          body: "Questions about your data? support@therostory.com.",
        },
      ],
    },
    ro: {
      title: "Politica de Confidențialitate",
      subtitle: "Cum gestionăm datele tale, pe înțelesul tuturor",
      lastUpdated: `Ultima actualizare: ${lastUpdated}`,
      sections: [
        {
          heading: "Cine suntem",
          body: "The RoStory este un proiect personal de povestire condus de o singură persoană din România. Această pagină explică ce date colectează site-ul când îl folosești, de ce și cum le poți controla.",
        },
        {
          heading: "Ce colectăm",
          body: "Când îți creezi cont, stocăm adresa ta de email, un nume afișat și o imagine de profil opțională pe care o încarci. Când citești articole, stocăm un număr anonim de vizualizări per articol. Când adaugi un articol la favorite, stocăm legătura dintre ID-ul tău și acel articol. Când postezi un comentariu, stocăm textul, ora postării și ID-ul utilizatorului căruia îi aparține.",
        },
        {
          heading: "Ce nu colectăm",
          body: "Nu folosim trackere publicitare terțe, pixeli de marketing sau instrumente de analiză care te profilează. Nu vindem, închiriem sau schimbăm datele tale. Nu folosim cookie-uri pentru publicitate.",
        },
        {
          heading: "Unde se stochează datele",
          body: "Datele de cont și conținutul sunt stocate în Supabase (un furnizor PostgreSQL gestionat, găzduit în UE când este disponibil). Imaginile încărcate sunt stocate în Supabase Storage. Site-ul în sine este servit de Vercel. Mesajele formularului de contact sunt trimise prin Resend.",
        },
        {
          heading: "Stocare locală pe dispozitivul tău",
          body: "Stocăm câteva preferințe mici în localStorage și sessionStorage-ul browserului tău: limba selectată, tema (deschisă/întunecată) și un marcaj per articol pentru a evita dublarea numărării vizualizărilor într-o sesiune. Acestea nu părăsesc niciodată dispozitivul tău.",
        },
        {
          heading: "Furnizori de autentificare",
          body: "Dacă te autentifici cu Google, Google va vedea că te-ai autentificat la The RoStory. Dincolo de aceasta, primim doar câmpurile de profil de bază (email, nume, avatar) pe care ai ales să le împărtășești cu noi.",
        },
        {
          heading: "Drepturile tale",
          body: "Îți poți edita profilul oricând din pagina de Profil. Îți poți șterge permanent contul și tot conținutul asociat (articolele, comentariile, favoritele) apăsând pe „Șterge contul” în pagina de profil. Poți solicita un export complet al datelor tale prin butonul de export din pagina de Profil. Dacă ceva nu funcționează sau ai întrebări, scrie la support@therostory.com.",
        },
        {
          heading: "Modificări ale acestei politici",
          body: "Când această politică se schimbă semnificativ, data „Ultima actualizare” de mai sus este actualizată. În prezent nu trimitem notificări pentru modificările politicii.",
        },
        {
          heading: "Contact",
          body: "Întrebări despre datele tale? support@therostory.com.",
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
        Icon={Shield}
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

export default Privacy;
