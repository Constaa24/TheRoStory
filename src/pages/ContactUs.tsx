import React from "react";
import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { sendContactMessage } from "@/lib/supabase";
import { toast } from "sonner";
import { Mail, Send, MessageSquare, User } from "lucide-react";
import { HeroBanner } from "@/components/layout/HeroBanner";

type ContactFormValues = {
  name: string;
  email: string;
  message: string;
  website?: string;
};

const ContactUs: React.FC = () => {
  const { t, language } = useLanguage();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

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
    defaultValues: {
      name: "",
      email: "",
      message: "",
      website: "",
    },
  });

  const onSubmit = async (data: ContactFormValues) => {
    setIsSubmitting(true);
    try {
      const result = await sendContactMessage(data.name, data.email, data.message, data.website || "");
      
      if (result.ok) {
        toast.success(t("contact.success"));
        form.reset();
      } else {
        if (result.status === 429) {
          toast.error(
            language === 'en'
              ? "Too many messages sent recently. Please try again a little later."
              : "Prea multe mesaje trimise recent. Te rugăm să încerci din nou puțin mai târziu."
          );
          return;
        }
        if (result.status === 400 && result.error) {
          toast.error(
            language === 'en'
              ? "Please check your message details and try again."
              : "Verifică detaliile mesajului și încearcă din nou."
          );
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
    <div className="min-h-screen bg-background pb-20">
      <HeroBanner 
        title={t("contact.title")}
        subtitle={t("contact.subtitle")}
        imageUrl="https://images.unsplash.com/photo-1701118737005-005fc66703be?q=80&w=2000"
        Icon={MessageSquare}
        height="h-[50vh]"
      />

      <div className="container mx-auto px-4 py-20 max-w-5xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {/* Contact Info */}
          <div className="md:col-span-1 space-y-8">
            <div className="parchment-effect p-8 rounded-sm shadow-elegant space-y-4">
              <h3 className="text-2xl font-serif font-black italic text-primary flex items-center gap-2">
                <MessageSquare className="h-6 w-6 text-accent" />
                {t("contact.getInTouch")}
              </h3>
              <p className="text-muted-foreground font-serif italic leading-relaxed">
                {t("contact.description")}
              </p>
              
              <div className="h-[1px] w-full bg-accent/20 my-6" />
              
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center text-accent shrink-0 border border-accent/20">
                  <Mail className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[10px] font-sans uppercase tracking-[0.2em] text-accent font-bold mb-1">{t("contact.emailLabel")}</p>
                  <p className="font-serif italic text-lg">support@therostory.com</p>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <Card className="md:col-span-2 border-none shadow-elegant overflow-hidden bg-secondary/20">
            <CardHeader className="bg-accent/5 border-b border-secondary-foreground/5 p-8">
              <CardTitle className="text-3xl font-serif font-black italic">{t("contact.formTitle")}</CardTitle>
              <CardDescription className="text-lg font-serif italic">
                {t("contact.formDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="sr-only" aria-hidden="true">
                <label htmlFor="website">Website</label>
                <Input
                  id="website"
                  tabIndex={-1}
                  autoComplete="off"
                  {...form.register("website")}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  {t("contact.name")}
                </label>
                <Input 
                  {...form.register("name")} 
                  placeholder={t("contact.namePlaceholder")}
                  className={form.formState.errors.name ? "border-destructive" : ""}
                />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  {t("contact.email")}
                </label>
                <Input 
                  {...form.register("email")} 
                  type="email"
                  placeholder={t("contact.emailPlaceholder")}
                  className={form.formState.errors.email ? "border-destructive" : ""}
                />
                {form.formState.errors.email && (
                  <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  {t("contact.message")}
                </label>
                <Textarea 
                  {...form.register("message")} 
                  placeholder={t("contact.messagePlaceholder")}
                  rows={5}
                  className={form.formState.errors.message ? "border-destructive" : "resize-none"}
                />
                {form.formState.errors.message && (
                  <p className="text-xs text-destructive">{form.formState.errors.message.message}</p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full gap-2 font-medium" 
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {t("contact.send")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
);
};

export default ContactUs;
