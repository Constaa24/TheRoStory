import React from "react";
import { useLanguage } from "@/hooks/use-language";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { sendContactMessage } from "@/lib/supabase";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { SocialLinks } from "@/components/ui/social-links";
import { PageHead } from "@/components/layout/PageHead";

type ContactFormValues = {
  name: string;
  email: string;
  message: string;
  website?: string;
};

const COOLDOWN_SECONDS = 30;

const ContactUs: React.FC = () => {
  const { t, language } = useLanguage();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [cooldownRemaining, setCooldownRemaining] = React.useState(0);

  React.useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const id = window.setTimeout(() => setCooldownRemaining(s => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldownRemaining]);

  const contactSchema = React.useMemo(() => z.object({
    name: z.string().min(2, { message: t("contact.validation.name") }),
    email: z.string().email({ message: t("contact.validation.email") }),
    message: z.string().min(10, { message: t("contact.validation.message") }).max(5000),
    website: z.string().optional(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [language]);

  const resolver = React.useMemo(() => zodResolver(contactSchema), [contactSchema]);

  const form = useForm<ContactFormValues>({
    resolver,
    defaultValues: { name: "", email: "", message: "", website: "" },
  });

  const onSubmit = async (data: ContactFormValues) => {
    setIsSubmitting(true);
    try {
      const result = await sendContactMessage(data.name, data.email, data.message, data.website || "");
      if (result.ok) {
        toast.success(t("contact.success"));
        form.reset();
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
            style={{ fontSize: 'clamp(56px, 8vw, 120px)', lineHeight: 0.95, letterSpacing: '-0.01em', color: 'var(--parchment)' }}
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { eyebrow: language === 'en' ? 'Editorial' : 'Editorial', name: 'support@therostory.com', desc: language === 'en' ? 'Pitches, corrections, fact-checks.' : 'Propuneri, corecturi, verificări.' },
              { eyebrow: language === 'en' ? 'Press & partnerships' : 'Presă și parteneriate', name: 'support@therostory.com', desc: language === 'en' ? 'Media, festivals, brand collaborations.' : 'Media, festivaluri, colaborări de brand.' },
              { eyebrow: language === 'en' ? 'Follow' : 'Urmărește', name: 'therostory.com', desc: language === 'en' ? 'Instagram, TikTok, YouTube.' : 'Instagram, TikTok, YouTube.' },
            ].map((c, i) => (
              <div key={i} style={{ borderTop: '1px solid var(--line)', paddingTop: 24 }}>
                <div className="eyebrow mb-3.5">{c.eyebrow}</div>
                <div className="font-display italic mb-3" style={{ fontSize: 26, color: 'var(--parchment)', lineHeight: 1.2, wordBreak: 'break-word' }}>{c.name}</div>
                <p className="m-0" style={{ fontSize: 15, color: 'var(--text-dim)' }}>{c.desc}</p>
                {i === 2 && <div className="mt-4"><SocialLinks iconSize="h-5 w-5" /></div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FORM */}
      <section style={{ padding: '60px 0 100px' }}>
        <div className="ed-container">
          <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-20 items-start">
            <form onSubmit={form.handleSubmit(onSubmit)} className="ed-form flex flex-col gap-6">
              <h3
                className="font-display italic font-medium m-0"
                style={{ fontSize: 'clamp(28px, 3vw, 40px)', lineHeight: 1.1, color: 'var(--parchment)' }}
              >
                {language === 'en' ? 'Or, write the long way.' : 'Sau, scrie pe lung.'}
              </h3>

              <div className="sr-only" aria-hidden="true">
                <label htmlFor="website">Website</label>
                <input id="website" tabIndex={-1} autoComplete="off" {...form.register('website')} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label>{language === 'en' ? 'Name' : 'Nume'}</label>
                  <input
                    type="text"
                    placeholder={t('contact.namePlaceholder')}
                    {...form.register('name')}
                    style={form.formState.errors.name ? { borderColor: 'var(--oxblood-2)' } : undefined}
                  />
                  {form.formState.errors.name && (
                    <p className="font-ui text-xs mt-1" style={{ color: 'var(--oxblood-2)' }}>{form.formState.errors.name.message}</p>
                  )}
                </div>
                <div>
                  <label>{language === 'en' ? 'Email' : 'Email'}</label>
                  <input
                    type="email"
                    placeholder={t('contact.emailPlaceholder')}
                    {...form.register('email')}
                    style={form.formState.errors.email ? { borderColor: 'var(--oxblood-2)' } : undefined}
                  />
                  {form.formState.errors.email && (
                    <p className="font-ui text-xs mt-1" style={{ color: 'var(--oxblood-2)' }}>{form.formState.errors.email.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label>{language === 'en' ? 'Subject' : 'Subiect'}</label>
                <select defaultValue="">
                  <option value="">{language === 'en' ? 'Pitch a story' : 'Propune o poveste'}</option>
                  <option>{language === 'en' ? 'Press request' : 'Cerere presă'}</option>
                  <option>{language === 'en' ? 'Correction' : 'Corectură'}</option>
                  <option>{language === 'en' ? 'General' : 'General'}</option>
                </select>
              </div>

              <div>
                <label>{language === 'en' ? 'Message' : 'Mesaj'}</label>
                <textarea
                  rows={7}
                  placeholder={t('contact.messagePlaceholder')}
                  {...form.register('message')}
                  style={form.formState.errors.message ? { borderColor: 'var(--oxblood-2)', resize: 'vertical' } : { resize: 'vertical' }}
                />
                {form.formState.errors.message && (
                  <p className="font-ui text-xs mt-1" style={{ color: 'var(--oxblood-2)' }}>{form.formState.errors.message.message}</p>
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
            </form>

            <aside>
              <div className="ph mb-7" data-tone="warm" data-label={language === 'en' ? 'READING ROOM · BUCHAREST' : 'CAMERA DE LECTURĂ · BUCUREȘTI'} style={{ aspectRatio: '4/3' }} />
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
