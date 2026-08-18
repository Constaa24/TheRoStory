import React from "react";
import { useLanguage } from "@/hooks/use-language";
import { PageHead } from "@/components/layout/PageHead";

const Privacy: React.FC = () => {
  const { language } = useLanguage();

  // Bump this ONLY for a material change — a new processing activity, a new
  // recipient of data, a change to retention or to a reader's rights. Not for
  // typos or rewording, which would train readers to ignore it.
  //
  // The section "Changes to this policy" below promises this date tracks
  // material revisions, so leaving it stale while adding one makes the policy
  // contradict itself. 2026-08-19 covers disclosing Vercel Web Analytics and
  // rewriting the local-storage section, which had listed three of the eight
  // things actually stored.
  const lastUpdated = "2026-08-19";

  const content = {
    en: {
      title: "Privacy Policy",
      subtitle: "How we handle your data, in plain language",
      lastUpdated: `Last updated: ${lastUpdated}`,
      sections: [
        {
          heading: "Who we are",
          body: "The RoStory is a personal storytelling project run by a single individual based in Romania. The person responsible for your data (the data controller) can be reached at support@therostory.com. This page explains what data the site collects when you use it, why, and how you can control it.",
        },
        {
          heading: "What we collect",
          body: "When you create an account, we store your email address, a display name, and an optional avatar image you upload. When you read articles, we store an anonymous view count per article. When you favorite an article, we store the link between your user ID and that article. When you post a comment, we store its text, the time you posted it, and the user ID it belongs to.",
        },
        {
          heading: "Audience measurement",
          body: "We measure aggregate traffic — how many people visited a page, which pages, roughly where in the world, and which site referred them — using Vercel Web Analytics. It is cookieless: nothing is written to your device, no identifier follows you between visits or between sites, and no profile of you is built or sold. Because it stores no personal data, it needs no consent banner. We use it only to learn which stories people read.",
        },
        {
          heading: "Newsletter",
          body: "If you subscribe to our newsletter, we store your email address and the date you confirmed it. Subscription is double opt-in — nothing is sent until you click the confirmation link in the email we send you. We use your address solely to send the newsletter (roughly once a month), delivered via Resend. Every issue contains a one-click unsubscribe link. To have your address erased from our records entirely, email support@therostory.com.",
        },
        {
          heading: "Donations",
          body: "The Support page links out to Revolut, PayPal, and our bank details. We process no payments ourselves: there is no payment form on this site, and no card number ever reaches it. Follow one of those links and you are on that provider's site, under their privacy policy. If you send a bank transfer, our statement shows your name and account number the way it would for any transfer — that stays in our accounting records, and is never added to your site account or connected to what you read here.",
        },
        {
          heading: "What we do not collect",
          body: "We do not use advertising trackers, marketing pixels, or any analytics that profiles you or follows you across sites — see “Audience measurement” above for the aggregate, cookieless counting we do use. We do not sell, rent, or trade your data. We set no advertising cookies.",
        },
        {
          heading: "Where data is stored",
          body: "Account data and content are stored in Supabase (a managed PostgreSQL provider, hosted in the EU when available). Uploaded images are stored in Supabase Storage. The site itself is served from Vercel. Contact-form messages are sent via Resend.",
        },
        {
          heading: "Local storage on your device",
          body: "The site keeps a small amount of data in your browser, none of it used to track you and none of it sent anywhere except where noted. Preferences that persist: your language, your theme (light or dark), and the last category filter you chose. Housekeeping that persists: a short timestamp used to recover from a stale page after we deploy an update, and, if you comment, the time of your last comment so the form can enforce its own cooldown. Cleared when you close the tab: a flag per article so a single visit is not counted twice, and a flag marking a password-recovery session in progress. If you are signed in, your login session is also stored here — that is what keeps you signed in between visits, and clearing your browser data signs you out. You can clear all of it at any time through your browser settings.",
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
          heading: "Legal basis",
          body: "We process your account data and content to provide the service you signed up for (performance of a contract). We send the newsletter only with your explicit consent, which you can withdraw at any time via the unsubscribe link or by emailing us. Anonymous view counts and basic abuse prevention rely on our legitimate interest in running and protecting the site.",
        },
        {
          heading: "How long we keep your data",
          body: "We keep your account data for as long as your account exists. When you delete your account, your profile, articles, comments, and favorites are removed immediately. Newsletter records are kept until you unsubscribe or ask us to erase them; unconfirmed sign-ups are deleted automatically after about 30 days. Contact-form emails remain in our mailbox and are deleted once the conversation is resolved.",
        },
        {
          heading: "Your right to complain",
          body: "If you believe we've mishandled your data, you can lodge a complaint with the Romanian National Supervisory Authority for Personal Data Processing (ANSPDCP — dataprotection.ro). We'd appreciate the chance to put things right first, so please email support@therostory.com.",
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
          body: "The RoStory este un proiect personal de povestire condus de o singură persoană din România. Persoana responsabilă de datele tale (operatorul de date) poate fi contactată la support@therostory.com. Această pagină explică ce date colectează site-ul când îl folosești, de ce și cum le poți controla.",
        },
        {
          heading: "Ce colectăm",
          body: "Când îți creezi cont, stocăm adresa ta de email, un nume afișat și o imagine de profil opțională pe care o încarci. Când citești articole, stocăm un număr anonim de vizualizări per articol. Când adaugi un articol la favorite, stocăm legătura dintre ID-ul tău și acel articol. Când postezi un comentariu, stocăm textul, ora postării și ID-ul utilizatorului căruia îi aparține.",
        },
        {
          heading: "Măsurarea audienței",
          body: "Măsurăm traficul agregat — câți vizitatori a avut o pagină, care pagini, aproximativ din ce zonă a lumii și de pe ce site au ajuns aici — folosind Vercel Web Analytics. Nu folosește cookie-uri: nu se scrie nimic pe dispozitivul tău, niciun identificator nu te urmărește între vizite sau între site-uri și nu se construiește și nu se vinde niciun profil despre tine. Pentru că nu stochează date personale, nu necesită un banner de consimțământ. Îl folosim doar ca să aflăm ce povești sunt citite.",
        },
        {
          heading: "Buletin informativ",
          body: "Dacă te abonezi la buletinul nostru, stocăm adresa ta de email și data la care ai confirmat-o. Abonarea se face prin dublă confirmare — nu trimitem nimic până nu apeși pe linkul de confirmare din emailul pe care ți-l trimitem. Folosim adresa ta exclusiv pentru a trimite buletinul (aproximativ o dată pe lună), livrat prin Resend. Fiecare ediție conține un link de dezabonare cu un singur clic. Pentru a-ți șterge complet adresa din evidențele noastre, scrie la support@therostory.com.",
        },
        {
          heading: "Donații",
          body: "Pagina de susținere trimite către Revolut, PayPal și datele noastre bancare. Nu procesăm noi nicio plată: pe acest site nu există niciun formular de plată și niciun număr de card nu ajunge vreodată aici. Dacă urmezi unul dintre acele linkuri, ești pe site-ul furnizorului respectiv, sub politica lui de confidențialitate. Dacă trimiți un transfer bancar, extrasul nostru arată numele și numărul tău de cont, la fel ca la orice transfer — acestea rămân în evidențele noastre contabile și nu sunt niciodată adăugate la contul tău de pe site sau legate de ce citești aici.",
        },
        {
          heading: "Ce nu colectăm",
          body: "Nu folosim trackere publicitare, pixeli de marketing sau instrumente de analiză care te profilează ori te urmăresc între site-uri — vezi „Măsurarea audienței” mai sus pentru numărătoarea agregată, fără cookie-uri, pe care o folosim. Nu vindem, închiriem sau schimbăm datele tale. Nu setăm cookie-uri publicitare.",
        },
        {
          heading: "Unde se stochează datele",
          body: "Datele de cont și conținutul sunt stocate în Supabase (un furnizor PostgreSQL gestionat, găzduit în UE când este disponibil). Imaginile încărcate sunt stocate în Supabase Storage. Site-ul în sine este servit de Vercel. Mesajele formularului de contact sunt trimise prin Resend.",
        },
        {
          heading: "Stocare locală pe dispozitivul tău",
          body: "Site-ul păstrează o cantitate mică de date în browserul tău, niciuna folosită pentru a te urmări și niciuna trimisă altundeva, cu excepția cazurilor menționate. Preferințe care persistă: limba, tema (deschisă sau întunecată) și ultimul filtru de categorie ales. Elemente tehnice care persistă: o marcă de timp folosită pentru a recupera o pagină învechită după ce publicăm o actualizare și, dacă lași un comentariu, ora ultimului tău comentariu, ca formularul să își poată aplica propria pauză. Șterse când închizi fila: un marcaj per articol, ca o singură vizită să nu fie numărată de două ori, și un marcaj care indică o sesiune de recuperare a parolei în curs. Dacă ești autentificat, sesiunea ta de autentificare este de asemenea stocată aici — asta te menține conectat între vizite, iar ștergerea datelor din browser te deconectează. Poți șterge oricând toate acestea din setările browserului.",
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
          heading: "Temeiul legal",
          body: "Prelucrăm datele contului și conținutul pentru a-ți oferi serviciul la care te-ai înscris (executarea unui contract). Trimitem buletinul informativ doar cu consimțământul tău explicit, pe care îl poți retrage oricând prin linkul de dezabonare sau scriindu-ne. Numărul anonim de vizualizări și prevenirea abuzurilor se bazează pe interesul nostru legitim de a opera și proteja site-ul.",
        },
        {
          heading: "Cât timp păstrăm datele tale",
          body: "Păstrăm datele contului tău atât timp cât contul există. Când îți ștergi contul, profilul, articolele, comentariile și favoritele sunt eliminate imediat. Înregistrările pentru buletin sunt păstrate până când te dezabonezi sau ne ceri ștergerea lor; abonările neconfirmate sunt șterse automat după aproximativ 30 de zile. Emailurile din formularul de contact rămân în căsuța noastră și sunt șterse după rezolvarea conversației.",
        },
        {
          heading: "Dreptul de a depune o plângere",
          body: "Dacă consideri că ți-am gestionat greșit datele, poți depune o plângere la Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (ANSPDCP — dataprotection.ro). Am aprecia însă ocazia de a îndrepta lucrurile mai întâi, așa că te rugăm să scrii la support@therostory.com.",
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
    <div className="screen-anim pb-20">
      <PageHead title={c.title} description={c.subtitle} language={language} />

      <section style={{ padding: '80px 0 56px', borderBottom: '1px solid var(--line-soft)' }}>
        <div className="ed-container">
          <div className="eyebrow mb-4">{language === 'en' ? 'Legal' : 'Legal'}</div>
          <h1
            className="font-display italic font-medium m-0"
            style={{ fontSize: 'clamp(56px, 8vw, 120px)', lineHeight: 0.95, letterSpacing: '-0.01em', color: 'var(--parchment)' }}
          >
            {c.title}
          </h1>
          <p className="mt-7 max-w-[540px]" style={{ fontSize: 19, color: 'var(--text-dim)', lineHeight: 1.55 }}>
            {c.subtitle}
          </p>
        </div>
      </section>

      <section style={{ padding: '60px 0 100px' }}>
        <div className="ed-container">
          <div className="max-w-[760px] mx-auto">
            <p className="font-ui text-[11px] uppercase mb-12" style={{ letterSpacing: '0.18em', color: 'var(--gold)' }}>
              {c.lastUpdated}
            </p>
            <div className="flex flex-col gap-12">
              {c.sections.map((section, i) => (
                <section key={i}>
                  <h2 className="font-display italic font-medium m-0 mb-4" style={{ fontSize: 28, lineHeight: 1.15, color: 'var(--parchment)' }}>
                    {section.heading}
                  </h2>
                  <p className="m-0" style={{ fontSize: 17, color: 'var(--text)', lineHeight: 1.75, fontFamily: 'var(--serif)' }}>
                    {section.body}
                  </p>
                </section>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Privacy;
