import React from "react";
import { useLanguage } from "@/hooks/use-language";
import { Link } from "react-router-dom";
import { LegalPage } from "@/components/story/LegalPage";

const Terms: React.FC = () => {
  const { language } = useLanguage();

  // Independent of the privacy policy's date — these are separate documents,
  // and bumping them together would falsely claim both had changed. Bump only
  // when the terms themselves change. 2026-08-19 covered adding the donations
  // section. 2026-11-02 covers the minimum age (13 -> 16, the GDPR's age of
  // digital consent in Romania), the "Pictures and films" section (every
  // picture and film is AI-made, which the EU AI Act requires saying),
  // providers' fees on donations, and naming the operator.
  const lastUpdated = "2026-11-02";

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
          body: "You're responsible for keeping your account credentials safe. You agree to provide accurate registration information and not to impersonate other people. You must be at least 16 years old to create an account.",
        },
        {
          heading: "Email communications",
          body: "If you subscribe to our newsletter, you consent to receiving periodic emails from The RoStory (roughly once a month). Subscription is optional, free, and uses double opt-in — it only takes effect once you click the confirmation link we email you. You can unsubscribe at any time using the link in any newsletter or by writing to support@therostory.com. Separately, if you hold an account we may send essential transactional emails (such as email verification or password resets); these are not promotional and cannot be opted out of while the account exists.",
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
          id: "pictures",
          heading: "Pictures and films",
          body: "Every picture and film on The RoStory is made with generative AI. They are illustrations — imagined scenes inspired by real places, people, and events — not photographs or documentary footage, so they may differ from how a place looks or how something happened. Every story that shows one says so beside its title. If you spot something wrong in a story, write to support@therostory.com.",
        },
        {
          heading: "Donations",
          body: "The RoStory is free to read and will stay that way. If you want to support the archive, the Support page links out to Revolut, PayPal, and our bank details. Donations are voluntary and non-refundable. They don't buy a subscription, membership, early access, or any influence over what we publish, and they don't make you a client or partner. We run no payment form ourselves — the provider you choose handles the transaction, and no card number ever reaches this site. A bank transfer will show us your name and account number, as any transfer would; that stays in our accounting records. Your payment provider may charge its own fee for the transfer; we add none. If you send something by mistake, write to support@therostory.com and we'll try to put it right.",
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
          body: "The RoStory is run by Emanuel-Constantin Ionescu, in Romania. Questions about these terms? support@therostory.com.",
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
          body: "Ești responsabil pentru păstrarea în siguranță a datelor de autentificare. Ești de acord să furnizezi informații exacte de înregistrare și să nu te dai drept altă persoană. Trebuie să ai cel puțin 16 ani pentru a crea un cont.",
        },
        {
          heading: "Comunicări prin email",
          body: "Dacă te abonezi la buletinul nostru, ești de acord să primești emailuri periodice de la The RoStory (aproximativ o dată pe lună). Abonarea este opțională, gratuită și folosește dubla confirmare — devine activă doar după ce apeși pe linkul de confirmare pe care ți-l trimitem. Te poți dezabona oricând folosind linkul din orice buletin sau scriind la support@therostory.com. Separat, dacă ai un cont, îți putem trimite emailuri tranzacționale esențiale (precum verificarea adresei sau resetarea parolei); acestea nu sunt promoționale și nu pot fi dezactivate cât timp contul există.",
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
          id: "pictures",
          heading: "Imagini și filme",
          body: "Toate imaginile și filmele de pe The RoStory sunt realizate cu inteligență artificială generativă. Sunt ilustrații — scene imaginate, inspirate de locuri, oameni și evenimente reale —, nu fotografii sau înregistrări documentare, așa că pot diferi de felul în care arată un loc sau în care s-a petrecut ceva. Fiecare poveste care conține una spune asta lângă titlu. Dacă observi o greșeală într-o poveste, scrie-ne la support@therostory.com.",
        },
        {
          heading: "Donații",
          body: "The RoStory se citește gratuit și așa va rămâne. Dacă vrei să susții arhiva, pagina de susținere trimite către Revolut, PayPal și datele noastre bancare. Donațiile sunt voluntare și nerambursabile. Nu cumpără un abonament, o calitate de membru, acces în avans sau vreo influență asupra a ceea ce publicăm și nu te fac client sau partener. Noi nu avem niciun formular de plată — tranzacția este gestionată de furnizorul pe care îl alegi, iar niciun număr de card nu ajunge vreodată pe acest site. Un transfer bancar ne va arăta numele și numărul tău de cont, ca orice transfer; acestea rămân în evidențele noastre contabile. Furnizorul de plăți poate percepe propriul comision pentru transfer; noi nu adăugăm niciunul. Dacă trimiți ceva din greșeală, scrie-ne la support@therostory.com și vom încerca să îndreptăm lucrurile.",
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
          body: "The RoStory este administrat de Emanuel-Constantin Ionescu, în România. Întrebări despre acești termeni? support@therostory.com.",
        },
      ],
    },
  };

  const c = content[language];
  const en = language === 'en';

  // Verbatim excerpts — see LegalPage.
  const glance = en
    ? [
        { quote: 'The RoStory is free to read and will stay that way.', from: 'Donations' },
        { quote: 'When you post a comment, you keep ownership of what you wrote…', from: 'Your content' },
        { quote: 'You must be at least 16 years old to create an account.', from: 'Your account' },
      ]
    : [
        { quote: 'The RoStory se citește gratuit și așa va rămâne.', from: 'Donații' },
        { quote: 'Când postezi un comentariu, păstrezi dreptul de proprietate asupra a ceea ce ai scris…', from: 'Conținutul tău' },
        { quote: 'Trebuie să ai cel puțin 16 ani pentru a crea un cont.', from: 'Contul tău' },
      ];

  return (
    <LegalPage
      language={language}
      current="terms"
      title={c.title}
      subtitle={c.subtitle}
      lastUpdated={lastUpdated}
      sections={c.sections}
      glance={glance}
      aside={
        <>
          <div className="sb-place-card">
            <p className="sb-kicker-sm">{en ? 'Questions about these terms?' : 'Întrebări despre acești termeni?'}</p>
            <a href="mailto:support@therostory.com" className="sb-link text-[17px]">support@therostory.com</a>
            <Link to="/contact-us" className="sb-btn-word" style={{ fontSize: 19 }}>{en ? 'Or write to us →' : 'Sau scrie-ne →'}</Link>
          </div>
          <div className="sb-place-card">
            <p className="sb-kicker-sm">{en ? 'Free to read, always' : 'Gratuit de citit, mereu'}</p>
            <p className="sb-dim text-[16px] leading-relaxed">
              {en
                ? 'Donations are voluntary — “Donations” explains what they do and don’t buy.'
                : 'Donațiile sunt voluntare — „Donații” explică ce cumpără și ce nu.'}
            </p>
            <Link to="/support" className="sb-btn sb-btn-ghost justify-self-start">{en ? 'Support the archive' : 'Susține arhiva'}</Link>
          </div>
        </>
      }
    />
  );
};

export default Terms;
