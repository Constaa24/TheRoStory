import React, { createContext, useContext, useState, useEffect } from "react";

type Language = "en" | "ro";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations = {
  en: {
    "nav.home": "Home",
    "nav.categories": "Categories",
    "nav.support": "Support",
    "nav.myStory": "My Story",
    "nav.contactUs": "Contact Us",
    "nav.explore": "Explore",
    "nav.admin": "Admin",
    "nav.login": "Login",
    "nav.logout": "Logout",
    "hero.title": "The RoStory",
    "hero.subtitle": "A Visual Journey through Romanian Culture",
    "hero.badge": "Discover the Spirit of Romania",
    "categories.title": "Discover by Category",
    "articles.readMore": "Read Story",
    "articles.noArticles": "No stories found in this category.",
    "admin.title": "Admin Dashboard",
    "admin.addArticle": "Add New Story",
    "admin.addCategory": "Add New Category",
    "parchment.close": "Close Story",
    "parchment.theEnd": "The End",
    "home.randomTitle": "Feeling Adventurous?",
    "home.randomSubtitle": "Let us surprise you with a random story from our collection.",
    "home.randomButton": "Discover a Random Story",
    "contact.title": "Contact Us",
    "contact.subtitle": "Have a question or a story to share? We'd love to hear from you!",
    "contact.getInTouch": "Get in Touch",
    "contact.description": "Whether you have a question about our stories, want to suggest a new category, or just want to say hi, we're here for you.",
    "contact.formTitle": "Send us a Message",
    "contact.formDescription": "Fill out the form below and we'll get back to you as soon as possible.",
    "contact.name": "Name",
    "contact.namePlaceholder": "Your full name",
    "contact.email": "Email",
    "contact.emailLabel": "Email",
    "contact.emailPlaceholder": "your.email@example.com",
    "contact.message": "Message",
    "contact.messagePlaceholder": "Tell us what's on your mind...",
    "contact.send": "Send Message",
    "contact.success": "Your message has been sent successfully!",
    "contact.error": "There was an error sending your message. Please try again.",
    "contact.validation.name": "Name must be at least 2 characters.",
    "contact.validation.email": "Please enter a valid email address.",
    "contact.validation.message": "Message must be at least 10 characters.",
    "profile.title": "Your Profile",
    "profile.subtitle": "Manage your personal information and preferences",
    "profile.displayName": "Display Name",
    "profile.email": "Email Address",
    "profile.avatar": "Profile Picture",
    "profile.update": "Update Profile",
    "profile.updating": "Updating...",
    "profile.success": "Profile updated successfully!",
    "profile.error": "Failed to update profile. Please try again.",
    "nav.profile": "Profile",
    "nav.map": "Map",
    "location.label": "Location",
    "location.select": "Select a location",
    "map.zoomIn": "Zoom In",
    "map.zoomOut": "Zoom Out",
    "map.storiesIn": "Stories in",
    "map.noStories": "No stories in this location yet.",
    "map.clickToZoom": "Click to explore stories",
    "share.title": "Share Story",
    "share.copyLink": "Copy Link",
    "share.copied": "Link copied to clipboard!",
    "share.facebook": "Share on Facebook",
    "share.twitter": "Share on X",
    "related.title": "More stories you might like",
    "nav.favorites": "Favorites",
    "nav.dashboard": "Dashboard",
    "home.all": "All",
    "auth.welcomeBack": "Welcome back!",
    "auth.loginFailed": "Login failed",
    "auth.accountCreatedVerify": "Account created! Please check your email to verify.",
    "auth.accountCreatedWelcome": "Account created! Welcome!",
    "auth.signupFailed": "Signup failed",
    "auth.googleFailed": "Google sign-in failed",
    "auth.resetLinkSent": "Password reset link sent to your email!",
    "auth.resetLinkFailed": "Failed to send reset link",
    "auth.passwordUpdated": "Password updated successfully! You can now login.",
    "auth.passwordResetFailed": "Failed to reset password",
    "auth.checkEmail": "Check your email",
    "auth.verificationSentTo": "We sent a verification link to",
    "auth.verifyEmailPrompt": "Please verify your email address to access all features.",
    "auth.goHome": "Go to Home",
    "auth.resetPassword": "Reset Password",
    "auth.resetPasswordDesc": "Enter your email to receive a reset link",
    "auth.sendLink": "Send Link",
    "auth.backToLogin": "Back to Login",
    "auth.invalidResetLink": "Invalid Reset Link",
    "auth.invalidResetLinkDesc": "This password reset link is invalid or has expired.",
    "auth.invalidResetLinkHelp": "Please request a new password reset link from the login page.",
    "auth.requestNewLink": "Request New Link",
    "auth.newPassword": "New Password",
    "auth.newPasswordDesc": "Enter your new password",
    "auth.cancel": "Cancel",
    "auth.continueJourney": "Continue your journey",
    "auth.startStory": "Start your story",
    "auth.loginTab": "Login",
    "auth.signupTab": "Sign Up",
    "auth.displayName": "Display Name",
    "auth.password": "Password",
    "auth.forgotPassword": "Forgot password?",
    "auth.orContinueWith": "Or continue with",
    "auth.createAccount": "Create Account",
    "auth.agreement": "By continuing, you agree to explore the rich history and culture of Romania.",
    "search.placeholder": "Search stories...",
    "search.label": "Search",
    "search.close": "Close search",
    "search.noResults": "No stories found.",
  },
  ro: {
    "nav.home": "Acasă",
    "nav.categories": "Categorii",
    "nav.support": "Susține",
    "nav.myStory": "Povestea Mea",
    "nav.contactUs": "Contactează-ne",
    "nav.explore": "Explorează",
    "nav.admin": "Admin",
    "nav.login": "Autentificare",
    "nav.logout": "Deconectare",
    "hero.title": "The RoStory",
    "hero.subtitle": "O călătorie vizuală prin cultura românească",
    "hero.badge": "Descoperă Spiritul României",
    "categories.title": "Descoperă pe categorii",
    "articles.readMore": "Citește povestea",
    "articles.noArticles": "Nu au fost găsite povești în această categorie.",
    "admin.title": "Panou Admin",
    "admin.addArticle": "Adaugă poveste nouă",
    "admin.addCategory": "Adaugă categorie nouă",
    "parchment.close": "Închide povestea",
    "parchment.theEnd": "Sfârșit",
    "home.randomTitle": "Te simți aventuros?",
    "home.randomSubtitle": "Lasă-ne să te surprindem cu o poveste aleatorie din colecția noastră.",
    "home.randomButton": "Descoperă o poveste aleatorie",
    "contact.title": "Contactează-ne",
    "contact.subtitle": "Ai o întrebare sau o poveste de împărtășit? Ne-ar plăcea să te ascultăm!",
    "contact.getInTouch": "Ia legătura cu noi",
    "contact.description": "Indiferent dacă ai o întrebare despre poveștile noastre, vrei să sugerezi o categorie nouă sau doar vrei să ne saluți, suntem aici pentru tine.",
    "contact.formTitle": "Trimite-ne un mesaj",
    "contact.formDescription": "Completează formularul de mai jos și îți vom răspunde cât mai curând posibil.",
    "contact.name": "Nume",
    "contact.namePlaceholder": "Numele tău complet",
    "contact.email": "Email",
    "contact.emailLabel": "Email",
    "contact.emailPlaceholder": "emailul.tau@exemplu.com",
    "contact.message": "Mesaj",
    "contact.messagePlaceholder": "Spune-ne ce ai pe suflet...",
    "contact.send": "Trimite Mesaj",
    "contact.success": "Mesajul tău a fost trimis cu succes!",
    "contact.error": "A apărut o eroare la trimiterea mesajului. Te rugăm să încerci din nou.",
    "contact.validation.name": "Numele trebuie să aibă cel puțin 2 caractere.",
    "contact.validation.email": "Te rugăm să introduci o adresă de email validă.",
    "contact.validation.message": "Mesajul trebuie să aibă cel puțin 10 caractere.",
    "profile.title": "Profilul Tău",
    "profile.subtitle": "Gestionează-ți informațiile personale și preferințele",
    "profile.displayName": "Nume Afișat",
    "profile.email": "Adresă de Email",
    "profile.avatar": "Poză de Profil",
    "profile.update": "Actualizează Profilul",
    "profile.updating": "Se actualizează...",
    "profile.success": "Profil actualizat cu succes!",
    "profile.error": "Actualizarea profilului a eșuat. Te rugăm să încerci din nou.",
    "nav.profile": "Profil",
    "nav.map": "Hartă",
    "location.label": "Locație",
    "location.select": "Selectează o locație",
    "map.zoomIn": "Mărește",
    "map.zoomOut": "Micșorează",
    "map.storiesIn": "Povești din",
    "map.noStories": "Nu există încă povești în această locație.",
    "map.clickToZoom": "Apasă pentru a explora poveștile",
    "share.title": "Distribuie Povestea",
    "share.copyLink": "Copiază Link-ul",
    "share.copied": "Link copiat în clipboard!",
    "share.facebook": "Distribuie pe Facebook",
    "share.twitter": "Distribuie pe X",
    "related.title": "Mai multe povești care ți-ar putea plăcea",
    "nav.favorites": "Favorite",
    "nav.dashboard": "Panou control",
    "home.all": "Toate",
    "auth.welcomeBack": "Bine ai revenit!",
    "auth.loginFailed": "Autentificare eșuată",
    "auth.accountCreatedVerify": "Cont creat! Verifică-ți email-ul pentru confirmare.",
    "auth.accountCreatedWelcome": "Cont creat! Bine ai venit!",
    "auth.signupFailed": "Înregistrare eșuată",
    "auth.googleFailed": "Autentificarea cu Google a eșuat",
    "auth.resetLinkSent": "Link-ul de resetare a parolei a fost trimis pe email!",
    "auth.resetLinkFailed": "Trimiterea link-ului a eșuat",
    "auth.passwordUpdated": "Parola a fost actualizată cu succes! Te poți autentifica.",
    "auth.passwordResetFailed": "Resetarea parolei a eșuat",
    "auth.checkEmail": "Verifică-ți email-ul",
    "auth.verificationSentTo": "Am trimis un link de verificare la",
    "auth.verifyEmailPrompt": "Te rugăm să-ți verifici adresa de email pentru a accesa toate funcționalitățile.",
    "auth.goHome": "Mergi la Acasă",
    "auth.resetPassword": "Resetează Parola",
    "auth.resetPasswordDesc": "Introdu email-ul pentru a primi un link de resetare",
    "auth.sendLink": "Trimite Link",
    "auth.backToLogin": "Înapoi la Autentificare",
    "auth.invalidResetLink": "Link Invalid",
    "auth.invalidResetLinkDesc": "Acest link de resetare a parolei este invalid sau a expirat.",
    "auth.invalidResetLinkHelp": "Te rugăm să soliciți un nou link de resetare a parolei de pe pagina de autentificare.",
    "auth.requestNewLink": "Solicită Link Nou",
    "auth.newPassword": "Parolă Nouă",
    "auth.newPasswordDesc": "Introdu noua parolă",
    "auth.cancel": "Anulează",
    "auth.continueJourney": "Continuă-ți călătoria",
    "auth.startStory": "Începe-ți povestea",
    "auth.loginTab": "Autentificare",
    "auth.signupTab": "Înregistrare",
    "auth.displayName": "Nume afișat",
    "auth.password": "Parolă",
    "auth.forgotPassword": "Ai uitat parola?",
    "auth.orContinueWith": "Sau continuă cu",
    "auth.createAccount": "Creează Cont",
    "auth.agreement": "Continuând, ești de acord să explorezi istoria și cultura bogată a României.",
    "search.placeholder": "Caută povești...",
    "search.label": "Căutare",
    "search.close": "Închide căutarea",
    "search.noResults": "Nu s-au găsit povești.",
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window === "undefined") return "en";
    try {
      const saved = window.localStorage.getItem("rostory_lang");
      return saved === "en" || saved === "ro" ? saved : "en";
    } catch {
      return "en";
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem("rostory_lang", language);
    } catch {
      // Ignore browser storage restrictions
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
    }
  }, [language]);

  const t = (key: string) => {
    return translations[language][key as keyof typeof translations["en"]] || '';
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
