import React from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/hooks/use-language";
import { useCooldown } from "@/hooks/use-cooldown";
import { sendContactMessage } from "@/lib/supabase";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { SocialLinks } from "@/components/ui/social-links";
import { PageHead } from "@/components/layout/PageHead";

const COOLDOWN_SECONDS = 30;

// Mirrors the edge function's email check (contact-email/index.ts).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Language-independent subject keys — the localized label is resolved at
// send time, so switching language mid-form can't strand the <select> on a
// value that no longer matches any option.
const SUBJECTS = [
  { key: "pitch", en: "Pitch a story", ro: "Propune o poveste" },
  { key: "press", en: "Press request", ro: "Cerere presă" },
  { key: "correction", en: "Correction", ro: "Corectură" },
  { key: "general", en: "General", ro: "General" },
] as const;

type SubjectKey = (typeof SUBJECTS)[number]["key"];
type FieldErrors = { name?: string; email?: string; message?: string };

const ContactUs: React.FC = () => {
  const { t, language } = useLanguage();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [subject, setSubject] = React.useState<SubjectKey>("pitch");
  const [message, setMessage] = React.useState("");
  const [website, setWebsite] = React.useState(""); // honeypot — humans never see it
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { remaining: cooldownRemaining, start: setCooldownRemaining } = useCooldown();

  // Same rules the previous zod schema enforced; the message length also
  // matches the edge function's 10–5000 bounds.
  const validate = (): FieldErrors => {
    const errs: FieldErrors = {};
    if (name.trim().length < 2) errs.name = t("contact.validation.name");
    if (!EMAIL_RE.test(email.trim())) errs.email = t("contact.validation.email");
    const trimmed = message.trim();
    if (trimmed.length < 10 || trimmed.length > 5000) errs.message = t("contact.validation.message");
    return errs;
  };

  const clearError = (field: keyof FieldErrors) =>
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (errs.name || errs.email || errs.message) return;
    if (isSubmitting || cooldownRemaining > 0) return;

    setIsSubmitting(true);
    try {
      const subjectLabel = SUBJECTS.find((s) => s.key === subject)?.[language] ?? subject;
      const result = await sendContactMessage(name.trim(), email.trim(), message.trim(), website, subjectLabel);
      if (result.ok) {
        toast.success(t("contact.success"));
        setName("");
        setEmail("");
        setSubject("pitch");
        setMessage("");
        setWebsite("");
        setErrors({});
        setCooldownRemaining(COOLDOWN_SECONDS);
      } else {
        if (result.status === 429) {
          toast.error(language === 'en'
            ? "Too many messages sent recently. Please try again a little later."
            : "Prea multe mesaje trimise recent. Te rugăm să încerci din nou puțin mai târziu.");
          return;
        }
        if (result.status === 400 && result.error) {
          toast.error(language === 'en'
            ? "Please check your message details and try again."
            : "Verifică detaliile mesajului și încearcă din nou.");
          return;
        }
        throw new Error(result.error || "Failed to send message via edge function");
      }
    } catch (error) {
      console.error("Error sending email:", error);
      toast.error(t("contact.error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="screen-anim pb-20">
      <PageHead title={t("contact.title")} description={t("contact.subtitle")} language={language} />

      {/* HERO */}
      <section style={{ padding: '80px 0 56px', borderBottom: '1px solid var(--line-soft)' }}>
        <div className="ed-container">
          <div className="eyebrow mb-4">{language === 'en' ? 'Write to us' : 'Scrie-ne'}</div>
          <h1
            className="font-display italic font-medium m-0"
            style={{ fontSize: 'clamp(42px, 8vw, 120px)', lineHeight: 0.95, letterSpacing: '-0.01em', color: 'var(--parchment)' }}
          >
            {language === 'en' ? 'Say Hello.' : 'Salutări.'}
          </h1>
          <p className="mt-7 max-w-[540px]" style={{ fontSize: 19, color: 'var(--text-dim)', lineHeight: 1.55 }}>
            {language === 'en'
              ? "Press, partnerships, corrections, an old letter you'd like to share — we'd love to hear from you."
              : 'Presă, parteneriate, corecturi, o scrisoare veche pe care vrei să o împarți — ne-ar plăcea să auzim de la tine.'}
          </p>
        </div>
      </section>

      {/* INFO CARDS */}
      <section style={{ padding: '60px 0 40px' }}>
        <div className="ed-container">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              { eyebrow: language === 'en' ? 'Email' : 'Email', name: 'support@therostory.com', desc: language === 'en' ? 'Pitches, corrections, press, partnerships.' : 'Propuneri, corecturi, presă, parteneriate.' },
              { eyebrow: language === 'en' ? 'Follow' : 'Urmărește', name: 'therostory.com', desc: language === 'en' ? 'Instagram, TikTok, YouTube.' : 'Instagram, TikTok, YouTube.' },
            ].map((c, i) => (
              <div key={i} style={{ borderTop: '1px solid var(--line)', paddingTop: 24 }}>
                <div className="eyebrow mb-3.5">{c.eyebrow}</div>
                <div className="font-display italic mb-3" style={{ fontSize: 26, color: 'var(--parchment)', lineHeight: 1.2, wordBreak: 'break-word' }}>{c.name}</div>
                <p className="m-0" style={{ fontSize: 15, color: 'var(--text-dim)' }}>{c.desc}</p>
                {i === 1 && <div className="mt-4"><SocialLinks iconSize="h-5 w-5" /></div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FORM */}
      <section style={{ padding: '60px 0 100px' }}>
        <div className="ed-container">
          <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-20 items-start">
            <form onSubmit={onSubmit} className="ed-form flex flex-col gap-6">
              <h3
                className="font-display italic font-medium m-0"
                style={{ fontSize: 'clamp(28px, 3vw, 40px)', lineHeight: 1.1, color: 'var(--parchment)' }}
              >
                {language === 'en' ? 'Or, write the long way.' : 'Sau, scrie pe lung.'}
              </h3>

              <div className="sr-only" aria-hidden="true">
                <label htmlFor="website">Website</label>
                <input
                  id="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="contact-name">{language === 'en' ? 'Name' : 'Nume'}</label>
                  <input
                    id="contact-name"
                    type="text"
                    placeholder={t('contact.namePlaceholder')}
                    value={name}
                    onChange={(e) => { setName(e.target.value); clearError('name'); }}
                    maxLength={200}
                    style={errors.name ? { borderColor: 'var(--oxblood-2)' } : undefined}
                  />
                  {errors.name && (
                    <p className="font-ui text-xs mt-1" style={{ color: 'var(--oxblood-2)' }}>{errors.name}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="contact-email">{language === 'en' ? 'Email' : 'Email'}</label>
                  <input
                    id="contact-email"
                    type="email"
                    placeholder={t('contact.emailPlaceholder')}
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); clearError('email'); }}
                    maxLength={254}
                    style={errors.email ? { borderColor: 'var(--oxblood-2)' } : undefined}
                  />
                  {errors.email && (
                    <p className="font-ui text-xs mt-1" style={{ color: 'var(--oxblood-2)' }}>{errors.email}</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="contact-subject">{language === 'en' ? 'Subject' : 'Subiect'}</label>
                <select
                  id="contact-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value as SubjectKey)}
                >
                  {SUBJECTS.map((s) => (
                    <option key={s.key} value={s.key}>{s[language]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="contact-message">{language === 'en' ? 'Message' : 'Mesaj'}</label>
                <textarea
                  id="contact-message"
                  rows={7}
                  placeholder={t('contact.messagePlaceholder')}
                  value={message}
                  onChange={(e) => { setMessage(e.target.value); clearError('message'); }}
                  maxLength={5000}
                  style={errors.message ? { borderColor: 'var(--oxblood-2)', resize: 'vertical' } : { resize: 'vertical' }}
                />
                {errors.message && (
                  <p className="font-ui text-xs mt-1" style={{ color: 'var(--oxblood-2)' }}>{errors.message}</p>
                )}
              </div>

              <button
                type="submit"
                className="btn-ed self-start"
                style={{ padding: '16px 32px', opacity: isSubmitting || cooldownRemaining > 0 ? 0.6 : 1 }}
                disabled={isSubmitting || cooldownRemaining > 0}
              >
                {isSubmitting && (
                  <span className="w-3.5 h-3.5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--ink)', borderTopColor: 'transparent' }} />
                )}
                {!isSubmitting && <Send className="w-3.5 h-3.5" />}
                {cooldownRemaining > 0
                  ? (language === 'en' ? `Wait ${cooldownRemaining}s` : `Așteaptă ${cooldownRemaining}s`)
                  : (language === 'en' ? 'Send the letter' : 'Trimite scrisoarea')}
              </button>

              <p className="font-ui text-[11px] m-0" style={{ color: 'var(--text-mute)', lineHeight: 1.6 }}>
                {language === 'en'
                  ? 'We use your message and email only to reply. See our '
                  : 'Folosim mesajul și adresa ta doar pentru a-ți răspunde. Vezi '}
                <Link to="/privacy" className="underline" style={{ color: 'var(--gold)' }}>
                  {language === 'en' ? 'Privacy Policy' : 'Politica de Confidențialitate'}
                </Link>.
              </p>
            </form>

            <aside>
              <div className="mb-7 relative overflow-hidden" style={{ aspectRatio: '4/3' }}>
                <img
                  src="/bucharest_reading_room.png"
                  alt={language === 'en' ? 'Reading room, Bucharest' : 'Camera de lectură, București'}
                  className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                />
              </div>
              <div className="grid grid-cols-2 gap-6 py-5" style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
                {[
                  { k: language === 'en' ? 'Founded' : 'Fondat', v: '2025' },
                  { k: language === 'en' ? 'Stories' : 'Povești', v: '180+' },
                  { k: language === 'en' ? 'Languages' : 'Limbi', v: 'EN · RO' },
                  { k: language === 'en' ? 'Made in' : 'Făcut în', v: language === 'en' ? 'Bucharest' : 'București' },
                ].map(s => (
                  <div key={s.k}>
                    <div className="eyebrow mb-1.5">{s.k}</div>
                    <div className="font-display italic" style={{ fontSize: 26, color: 'var(--gold)' }}>{s.v}</div>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ContactUs;
