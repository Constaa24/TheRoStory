import React from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/hooks/use-language";
import { useCooldown } from "@/hooks/use-cooldown";
import { sendContactMessage } from "@/lib/supabase";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { PageHead } from "@/components/layout/PageHead";
import { Motif, Rosette } from "@/components/story/Ornaments";

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

  const en = language === 'en';
  const busy = isSubmitting || cooldownRemaining > 0;
  const fieldError = (id: string, text?: string) =>
    text ? <p id={id} className="sb-error">{text}</p> : null;
  const SOCIALS = [
    { label: 'Instagram', href: 'https://www.instagram.com/therostory' },
    { label: 'TikTok', href: 'https://www.tiktok.com/@therostory' },
    { label: 'YouTube', href: 'https://www.youtube.com/@therostory' },
  ];

  return (
    <div className="screen-anim">
      <PageHead title={t("contact.title")} description={t("contact.subtitle")} language={language} />

      <section className="ed-container" style={{ paddingTop: 'clamp(40px, 6vw, 72px)', paddingBottom: 'clamp(72px, 9vw, 112px)' }}>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] gap-12 lg:gap-[clamp(40px,6vw,96px)] items-start">
          <div className="flex flex-col gap-5 lg:sticky lg:top-10">
            <p className="sb-kicker">{t("contact.title")}</p>
            <h1 className="sb-h1" style={{ fontSize: 'clamp(48px, 5.6vw, 84px)' }}>{en ? 'Write to us.' : 'Scrie-ne.'}</h1>
            <p className="sb-lede">
              {en
                ? "Press, partnerships, corrections, an old letter you'd like to share — we'd love to hear from you."
                : 'Presă, parteneriate, corecturi, o scrisoare veche pe care vrei să o împarți — ne-ar plăcea să auzim de la tine.'}
            </p>
            <div className="sb-place-card mt-3">
              <div className="flex items-center gap-3">
                <Rosette size="sm" />
                <p className="sb-h4">{en ? 'Pitching a story?' : 'Propui o poveste?'}</p>
              </div>
              <p className="sb-dim text-[17px] leading-relaxed">
                {en
                  ? 'Tell us where it happens and, if you know, when. That’s what puts a story on the map.'
                  : 'Spune-ne unde se petrece și, dacă știi, când. Asta pune o poveste pe hartă.'}
              </p>
            </div>
            <div className="flex flex-col gap-2 mt-2">
              <p className="sb-kicker-sm" style={{ color: 'var(--text-dim)' }}>{en ? 'Or write directly' : 'Sau scrie direct'}</p>
              <a href="mailto:support@therostory.com" className="font-display italic text-[24px] break-words transition-colors hover:text-gold" style={{ color: 'var(--parchment)' }}>
                support@therostory.com
              </a>
            </div>
            <div className="flex flex-col gap-3 mt-2">
              <p className="sb-kicker-sm" style={{ color: 'var(--text-dim)' }}>{en ? 'Or find us where we post the field notes' : 'Sau găsește-ne acolo unde publicăm notele de teren'}</p>
              <div className="flex flex-wrap gap-2.5">
                {SOCIALS.map((s) => (
                  <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="sb-btn sb-btn-ghost">{s.label}</a>
                ))}
              </div>
            </div>
            <figure className="m-0 mt-6 hidden lg:block">
              <div className="sb-window-shallow">
                <div className="sb-arch sb-arch-shallow" style={{ aspectRatio: '4 / 3' }}>
                  <picture>
                    <source type="image/avif" srcSet="/bucharest_reading_room.avif" />
                    <source type="image/webp" srcSet="/bucharest_reading_room.webp" />
                    <img
                      src="/bucharest_reading_room.jpg"
                      alt=""
                      width={1024}
                      height={1024}
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  </picture>
                </div>
              </div>
              <figcaption className="sb-kicker-sm text-center mt-3" style={{ color: 'var(--text-dim)' }}>
                {en ? 'Reading room, Bucharest' : 'Camera de lectură, București'}
              </figcaption>
            </figure>
          </div>

          {/* The form is a letter: greeting, subject, the letter, signature. */}
          <form
            onSubmit={onSubmit}
            noValidate
            className="relative grid gap-6"
            style={{ background: 'var(--paper)', border: '1px solid var(--line-soft)', borderRadius: 26, padding: 'clamp(26px, 5vw, 60px)' }}
          >
            <Motif className="absolute" style={{ left: 32, right: 32, top: 0, transform: 'translateY(-50%)', opacity: 0.45 }} />
            <p className="font-display italic m-0" style={{ fontSize: 34, lineHeight: 1.2, color: 'var(--parchment)' }}>
              {en ? 'Dear RoStory,' : 'Dragă RoStory,'}
            </p>

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

            <div className="sb-field">
              <label htmlFor="contact-subject" className="sb-label">{en ? 'What is it about?' : 'Despre ce este vorba?'}</label>
              <select
                id="contact-subject"
                className="sb-input"
                value={subject}
                onChange={(e) => setSubject(e.target.value as SubjectKey)}
              >
                {SUBJECTS.map((s) => (
                  <option key={s.key} value={s.key}>{s[language]}</option>
                ))}
              </select>
            </div>

            <div className="sb-field">
              <label htmlFor="contact-message" className="sb-label">{en ? 'Your letter' : 'Scrisoarea ta'}</label>
              <textarea
                id="contact-message"
                className="sb-input"
                placeholder={t('contact.messagePlaceholder')}
                value={message}
                onChange={(e) => { setMessage(e.target.value); clearError('message'); }}
                maxLength={5000}
                aria-invalid={!!errors.message}
                aria-describedby={errors.message ? 'contact-message-error' : 'contact-message-hint'}
                style={errors.message ? { borderColor: 'var(--oxblood-2)' } : undefined}
              />
              {fieldError('contact-message-error', errors.message) ?? (
                <p id="contact-message-hint" className="sb-meta">
                  {en ? 'At least 10 characters, at most 5,000.' : 'Cel puțin 10 caractere, cel mult 5.000.'}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="sb-field content-start">
                <label htmlFor="contact-name" className="sb-label">{en ? 'Signed,' : 'Cu drag,'}</label>
                <input
                  id="contact-name"
                  className="sb-input"
                  type="text"
                  autoComplete="name"
                  placeholder={t('contact.namePlaceholder')}
                  value={name}
                  onChange={(e) => { setName(e.target.value); clearError('name'); }}
                  maxLength={200}
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? 'contact-name-error' : undefined}
                  style={errors.name ? { borderColor: 'var(--oxblood-2)' } : undefined}
                />
                {fieldError('contact-name-error', errors.name)}
              </div>
              <div className="sb-field content-start">
                <label htmlFor="contact-email" className="sb-label">{en ? 'Where we can write back' : 'Unde îți putem răspunde'}</label>
                <input
                  id="contact-email"
                  className="sb-input"
                  type="email"
                  autoComplete="email"
                  placeholder={t('contact.emailPlaceholder')}
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); clearError('email'); }}
                  maxLength={254}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'contact-email-error' : undefined}
                  style={errors.email ? { borderColor: 'var(--oxblood-2)' } : undefined}
                />
                {fieldError('contact-email-error', errors.email)}
              </div>
            </div>

            <div className="flex flex-wrap justify-between items-center gap-4 mt-2">
              <p className="sb-meta max-w-[340px]">
                {en
                  ? 'We use your letter and email only to reply. See our '
                  : 'Folosim scrisoarea și adresa ta doar pentru a-ți răspunde. Vezi '}
                <Link to="/privacy" className="sb-link">
                  {en ? 'Privacy Policy' : 'Politica de Confidențialitate'}
                </Link>.
              </p>
              <button type="submit" className="sb-btn" disabled={busy}>
                {isSubmitting
                  ? <Loader2 className="sb-ico animate-spin" aria-hidden="true" />
                  : null}
                {cooldownRemaining > 0
                  ? (en ? `Wait ${cooldownRemaining}s` : `Așteaptă ${cooldownRemaining}s`)
                  : (en ? 'Send the letter' : 'Trimite scrisoarea')}
                {!isSubmitting && cooldownRemaining === 0 && <Send className="sb-ico" aria-hidden="true" />}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
};

export default ContactUs;
