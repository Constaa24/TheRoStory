import React from "react";
import { useLanguage } from "@/hooks/use-language";
import { Link } from "react-router-dom";
import { LegalPage } from "@/components/story/LegalPage";

const Privacy: React.FC = () => {
  const { language } = useLanguage();

  // Bump this ONLY for a material change — a new processing activity, a new
  // recipient of data, a change to retention or to a reader's rights. Not for
  // typos or rewording, which would train readers to ignore it.
  //
  // The section "Changes to this policy" below promises this date tracks
  // material revisions, so leaving it stale while adding one makes the policy
  // contradict itself. 2026-08-19 covered disclosing Vercel Web Analytics and
  // rewriting the local-storage section. 2026-11-02 covers naming the
  // controller, the transfers to US providers, the minimum age, the contact
  // form and IP addresses, and the cookies section (no cookies; text size and
  // the offline cache were missing from the list).
  const lastUpdated = "2026-11-02";

  const content = {
    en: {
      title: "Privacy Policy",
      subtitle: "How we handle your data, in plain language",
      lastUpdated: `Last updated: ${lastUpdated}`,
      sections: [
        {
          heading: "Who we are",
          body: "The RoStory is a personal storytelling project run by a single individual based in Romania. The person responsible for your data (the data controller) is Emanuel-Constantin Ionescu, who can be reached at support@therostory.com. This page explains what data the site collects when you use it, why, and how you can control it.",
        },
        {
          heading: "What we collect",
          body: "When you create an account, we store your email address, a display name, and an optional avatar image you upload. When you read articles, we store an anonymous view count per article. When you favorite an article, we store the link between your user ID and that article. When you post a comment, we store its text, the time you posted it, and the user ID it belongs to; your display name is shown publicly beside it. When you write to us through the contact form, we receive your name, your email address, the subject you chose, and your message. Like any website, the servers that deliver the site see your IP address with each request: we use it for a few minutes, in memory, to stop spam and abuse (too many messages from one address, say), and never store it in our database. Our hosting providers keep short-lived technical logs, as every web host does.",
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
          body: "Account data and content are stored with Supabase, in its data centre in Ireland (EU); uploaded images are stored there too, in Supabase Storage. The site itself is served by Vercel from servers around the world, and Vercel also provides the audience measurement described above. Emails (newsletter issues, confirmation links, and contact-form messages) are sent through Resend. Signing in with Google involves Google. Vercel, Resend, and Google are based in the United States, as is Supabase's parent company: where your personal data reaches them, the transfer is covered by the EU–US Data Privacy Framework or by the European Commission's Standard Contractual Clauses in each provider's data processing agreement.",
        },
        {
          id: "cookies",
          heading: "Cookies and local storage",
          body: "The site sets no cookies. It does keep a small amount of data in your browser's own storage, none of it used to track you and none of it sent anywhere except where noted. Preferences that persist: your language, your theme (light or dark), your reading text size, and the last category filter you chose. Housekeeping that persists: if you comment, the time of your last comment, so the form can enforce its own cooldown; and a copy of the site's files, story pictures, and typefaces, kept by your browser so pages open faster and still open offline. Cleared when you close the tab: a flag per article so a single visit is not counted twice, a short timestamp used to recover from a stale page after we publish an update, and a flag marking a password-recovery session in progress. If you are signed in, your login session is also stored here — that is what keeps you signed in between visits, and clearing your browser data signs you out. Everything here is either something you asked for (staying signed in, your language, theme, and text size) or needed for the site to work, so the law requires no consent banner, and you won't see one. You can clear all of it at any time through your browser settings.",
        },
        {
          heading: "Authentication providers",
          body: "If you sign in with Google, Google sees that you authenticated to The RoStory. Beyond that, we only receive the basic profile fields (email, name, avatar) you've chosen to share with us. If you keep your Google profile picture, it is shown straight from Google's servers, so your browser fetches it from Google whenever it is displayed.",
        },
        {
          heading: "Your rights",
          body: "Under the GDPR you can ask to see the data we hold about you, have it corrected or erased, restrict or object to how we use it, and receive it in a portable format; where we rely on your consent, you can withdraw it at any time. Most of this is self-service. You can edit your profile at any time from the Profile page. You can permanently delete your account and all associated content (your articles, comments, favorites) by clicking 'Delete account' on your profile. You can download a complete copy of your data with the export button on the same page. For anything else, or if something fails, email support@therostory.com; we reply within one month, as the law requires.",
        },
        {
          heading: "Children",
          body: "The RoStory isn't directed at children. You must be at least 16 to create an account or subscribe to the newsletter: the age from which EU data-protection law, as it applies in Romania, lets you consent on your own. If you believe a child under 16 has given us personal data, write to support@therostory.com and we'll delete it.",
        },
        {
          heading: "Legal basis",
          body: "We process your account data and content to provide the service you signed up for (performance of a contract). We send the newsletter only with your explicit consent, which you can withdraw at any time via the unsubscribe link or by emailing us. Anonymous view counts and basic abuse prevention rely on our legitimate interest in running and protecting the site.",
        },
        {
          heading: "How long we keep your data",
          body: "We keep your account data for as long as your account exists. When you delete your account, your profile, articles, comments, and favorites are removed immediately, along with any newsletter subscription under the same email address. Newsletter records are kept until you unsubscribe or ask us to erase them; unconfirmed sign-ups are deleted automatically after about 30 days. Contact-form emails remain in our mailbox and are deleted once the conversation is resolved.",
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
          body: "The RoStory este un proiect personal de povestire condus de o singură persoană din România. Persoana responsabilă de datele tale (operatorul de date) este Emanuel-Constantin Ionescu și poate fi contactată la support@therostory.com. Această pagină explică ce date colectează site-ul când îl folosești, de ce și cum le poți controla.",
        },
        {
          heading: "Ce colectăm",
          body: "Când îți creezi cont, stocăm adresa ta de email, un nume afișat și o imagine de profil opțională pe care o încarci. Când citești articole, stocăm un număr anonim de vizualizări per articol. Când adaugi un articol la favorite, stocăm legătura dintre ID-ul tău și acel articol. Când postezi un comentariu, stocăm textul, ora postării și ID-ul utilizatorului căruia îi aparține; numele tău afișat apare public lângă el. Când ne scrii prin formularul de contact, primim numele tău, adresa de email, subiectul ales și mesajul. Ca la orice site, serverele care livrează site-ul văd adresa ta IP la fiecare cerere: o folosim câteva minute, în memorie, ca să oprim spamul și abuzurile (de exemplu, prea multe mesaje de la aceeași adresă), și nu o salvăm niciodată în baza noastră de date. Furnizorii noștri de găzduire păstrează jurnale tehnice pe termen scurt, ca orice gazdă web.",
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
          body: "Datele de cont și conținutul sunt stocate la Supabase, în centrul său de date din Irlanda (UE); tot acolo sunt stocate și imaginile încărcate, în Supabase Storage. Site-ul în sine este servit de Vercel, de pe servere din întreaga lume, iar Vercel furnizează și măsurarea audienței descrisă mai sus. Emailurile (edițiile buletinului, linkurile de confirmare și mesajele din formularul de contact) sunt trimise prin Resend. Autentificarea cu Google implică Google. Vercel, Resend și Google au sediul în Statele Unite, la fel ca firma-mamă a Supabase: acolo unde datele tale personale ajung la ei, transferul este acoperit de Cadrul UE–SUA privind protecția datelor sau de clauzele contractuale standard ale Comisiei Europene din acordul de prelucrare a datelor al fiecărui furnizor.",
        },
        {
          id: "cookies",
          heading: "Cookie-uri și stocare locală",
          body: "Site-ul nu setează niciun cookie. Păstrează totuși o cantitate mică de date în spațiul de stocare al browserului tău, niciuna folosită pentru a te urmări și niciuna trimisă altundeva, cu excepția cazurilor menționate. Preferințe care persistă: limba, tema (deschisă sau întunecată), mărimea textului la citire și ultimul filtru de categorie ales. Elemente tehnice care persistă: dacă lași un comentariu, ora ultimului tău comentariu, ca formularul să își poată aplica propria pauză; și o copie a fișierelor site-ului, a imaginilor poveștilor și a fonturilor, păstrată de browser ca paginile să se deschidă mai repede și să meargă și offline. Șterse când închizi fila: un marcaj per articol, ca o singură vizită să nu fie numărată de două ori, o marcă de timp folosită pentru a recupera o pagină învechită după ce publicăm o actualizare și un marcaj care indică o sesiune de recuperare a parolei în curs. Dacă ești autentificat, sesiunea ta de autentificare este de asemenea stocată aici — asta te menține conectat între vizite, iar ștergerea datelor din browser te deconectează. Totul de aici este fie ceva ce ai cerut (să rămâi conectat, limba, tema și mărimea textului), fie necesar pentru funcționarea site-ului, așa că legea nu cere un banner de consimțământ și nu vei vedea unul. Poți șterge oricând toate acestea din setările browserului.",
        },
        {
          heading: "Furnizori de autentificare",
          body: "Dacă te autentifici cu Google, Google va vedea că te-ai autentificat la The RoStory. Dincolo de aceasta, primim doar câmpurile de profil de bază (email, nume, avatar) pe care ai ales să le împărtășești cu noi. Dacă îți păstrezi fotografia de profil Google, ea este afișată direct de pe serverele Google, așa că browserul tău o descarcă de la Google de fiecare dată când apare.",
        },
        {
          heading: "Drepturile tale",
          body: "Conform GDPR, poți cere să vezi datele pe care le deținem despre tine, să fie corectate sau șterse, să restricționezi sau să te opui modului în care le folosim și să le primești într-un format portabil; acolo unde ne bazăm pe consimțământul tău, îl poți retrage oricând. Cele mai multe le poți face singur. Îți poți edita profilul oricând din pagina de Profil. Îți poți șterge permanent contul și tot conținutul asociat (articolele, comentariile, favoritele) apăsând pe „Șterge contul” în pagina de profil. Poți descărca o copie completă a datelor tale cu butonul de export de pe aceeași pagină. Pentru orice altceva, sau dacă ceva nu funcționează, scrie la support@therostory.com; răspundem în cel mult o lună, cum cere legea.",
        },
        {
          heading: "Copii",
          body: "The RoStory nu se adresează copiilor. Trebuie să ai cel puțin 16 ani pentru a-ți crea un cont sau pentru a te abona la buletin: vârsta de la care legislația UE privind protecția datelor, așa cum se aplică în România, îți permite să îți dai singur consimțământul. Dacă crezi că un copil sub 16 ani ne-a dat date personale, scrie la support@therostory.com și le vom șterge.",
        },
        {
          heading: "Temeiul legal",
          body: "Prelucrăm datele contului și conținutul pentru a-ți oferi serviciul la care te-ai înscris (executarea unui contract). Trimitem buletinul informativ doar cu consimțământul tău explicit, pe care îl poți retrage oricând prin linkul de dezabonare sau scriindu-ne. Numărul anonim de vizualizări și prevenirea abuzurilor se bazează pe interesul nostru legitim de a opera și proteja site-ul.",
        },
        {
          heading: "Cât timp păstrăm datele tale",
          body: "Păstrăm datele contului tău atât timp cât contul există. Când îți ștergi contul, profilul, articolele, comentariile și favoritele sunt eliminate imediat, împreună cu orice abonare la buletin făcută cu aceeași adresă de email. Înregistrările pentru buletin sunt păstrate până când te dezabonezi sau ne ceri ștergerea lor; abonările neconfirmate sunt șterse automat după aproximativ 30 de zile. Emailurile din formularul de contact rămân în căsuța noastră și sunt șterse după rezolvarea conversației.",
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
  const en = language === 'en';

  // Verbatim excerpts — see LegalPage.
  const glance = en
    ? [
        { quote: 'We do not sell, rent, or trade your data.', from: 'What we do not collect' },
        { quote: 'The site sets no cookies.', from: 'Cookies and local storage' },
        { quote: 'You can permanently delete your account and all associated content…', from: 'Your rights' },
      ]
    : [
        { quote: 'Nu vindem, închiriem sau schimbăm datele tale.', from: 'Ce nu colectăm' },
        { quote: 'Site-ul nu setează niciun cookie.', from: 'Cookie-uri și stocare locală' },
        { quote: 'Îți poți șterge permanent contul și tot conținutul asociat…', from: 'Drepturile tale' },
      ];

  return (
    <LegalPage
      language={language}
      current="privacy"
      title={c.title}
      subtitle={c.subtitle}
      lastUpdated={lastUpdated}
      sections={c.sections}
      glance={glance}
      aside={
        <>
          <div className="sb-place-card">
            <p className="sb-kicker-sm">{en ? 'Your data, your controls' : 'Datele tale, sub controlul tău'}</p>
            <p className="sb-dim text-[16px] leading-relaxed">
              {en
                ? 'Everything in “Your rights” is one click away on your profile.'
                : 'Tot ce scrie la „Drepturile tale” e la un clic distanță, în profilul tău.'}
            </p>
            <Link to="/profile" className="sb-btn sb-btn-ghost justify-self-start">{en ? 'Download my data' : 'Descarcă datele mele'}</Link>
            <Link to="/profile" className="sb-btn sb-btn-ghost sb-btn-danger justify-self-start">{en ? 'Delete my account' : 'Șterge contul meu'}</Link>
          </div>
          <div className="sb-place-card">
            <p className="sb-kicker-sm">{en ? 'Questions about your data?' : 'Întrebări despre datele tale?'}</p>
            <a href="mailto:support@therostory.com" className="sb-link text-[17px]">support@therostory.com</a>
            <Link to="/contact-us" className="sb-btn-word" style={{ fontSize: 19 }}>{en ? 'Or write to us →' : 'Sau scrie-ne →'}</Link>
          </div>
        </>
      }
    />
  );
};

export default Privacy;
