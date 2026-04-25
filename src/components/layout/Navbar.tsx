import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Globe, User, Menu, X, Shield, Heart } from "lucide-react";
import { SocialLinks } from "@/components/ui/social-links";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { SearchBar } from "@/components/layout/SearchBar";

export const Navbar: React.FC = () => {
  const { user, login, logout, isAdmin, isWriter } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  React.useEffect(() => {
    if (!isMenuOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isMenuOpen]);

  const showDashboard = isAdmin || isWriter;

  const navLinks = [
    { name: t("nav.home"), path: "/" },
    { name: t("nav.map"), path: "/map" },
    { name: t("nav.categories"), path: "/categories" },
    { name: t("nav.support"), path: "/support" },
    { name: t("nav.myStory"), path: "/my-story" },
    { name: t("nav.contactUs"), path: "/contact-us" },
  ];

  return (
    <div className="fixed top-0 left-0 right-0 z-50 pt-4 px-4 pointer-events-none flex justify-center">
      <nav className="pointer-events-auto w-full max-w-7xl bg-background/80 backdrop-blur-xl border border-border/40 shadow-[0_8px_30px_rgb(0,0,0,0.08)] rounded-[2rem] transition-all duration-300">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between w-full">
            {/* Logo */}
            <div className="flex-1 flex justify-start">
              <Link to="/" className="flex items-center gap-2.5 hover:scale-105 transition-transform duration-300">
              <img
                src="/logo.png"
                alt="The RoStory Logo"
                className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl shrink-0 object-contain shadow-sm"
              />
              <span className="text-xl sm:text-2xl font-serif font-black tracking-tighter text-primary whitespace-nowrap">
                The <span className="text-accent">Ro</span>Story
              </span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-6 shrink-0">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={cn(
                    "text-sm font-bold font-serif italic px-3 py-1.5 rounded-full transition-all duration-300 hover:bg-accent/10 whitespace-nowrap",
                    location.pathname === link.path ? "text-accent bg-accent/5" : "text-foreground/70 hover:text-accent"
                  )}
                >
                  {link.name}
                </Link>
              ))}
            </div>

            {/* Right Actions */}
            <div className="hidden md:flex items-center gap-3 flex-1 justify-end">
              <SearchBar />
              <ThemeToggle />

              {/* Language Switcher */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full hover:bg-accent/10 hover:text-accent transition-colors" aria-label={t("nav.changeLanguage")}>
                    <Globe className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-[1.5rem] p-2 shadow-xl border-border/40 bg-background/95 backdrop-blur-md">
                  <DropdownMenuItem 
                    onClick={() => setLanguage("en")}
                    className={cn("rounded-xl cursor-pointer font-serif italic transition-colors", language === "en" && "bg-accent/10 text-accent font-bold")}
                  >
                    English
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setLanguage("ro")}
                    className={cn("rounded-xl cursor-pointer font-serif italic transition-colors", language === "ro" && "bg-accent/10 text-accent font-bold")}
                  >
                    Română
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Auth */}
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 rounded-full border-border/40 hover:border-accent/40 hover:bg-accent/5 transition-all px-4 shadow-sm h-10">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={user.avatarUrl} alt={user.displayName || user.email || ''} />
                        <AvatarFallback className="text-xs bg-accent/20 text-accent font-bold">
                          {(user.displayName || user.email || "U").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-serif italic font-bold truncate max-w-[100px]">
                        {user.displayName || user.email}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-[1.5rem] p-2 shadow-xl border-border/40 bg-background/95 backdrop-blur-md w-56">
                    <DropdownMenuItem asChild className="rounded-xl cursor-pointer font-serif italic mb-1">
                      <Link to="/profile" className="flex items-center gap-2">
                        <User className="h-4 w-4 text-accent" />
                        {t("nav.profile")}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="rounded-xl cursor-pointer font-serif italic mb-1">
                      <Link to="/profile?tab=favorites" className="flex items-center gap-2">
                        <Heart className="h-4 w-4 text-red-500" />
                        {t("nav.favorites")}
                      </Link>
                    </DropdownMenuItem>
                    {showDashboard && (
                      <DropdownMenuItem asChild className="rounded-xl cursor-pointer font-serif italic mb-1">
                        <Link to="/admin" className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-accent" />
                          {isAdmin ? t("nav.admin") : t("nav.dashboard")}
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <div className="h-px bg-border/40 my-1 mx-2" />
                    <DropdownMenuItem onClick={logout} className="rounded-xl cursor-pointer font-serif italic text-destructive hover:bg-destructive/10 hover:text-destructive">
                      {t("nav.logout")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button onClick={login} variant="default" size="sm" className="rounded-full px-6 shadow-md hover:scale-105 active:scale-95 transition-all font-serif italic font-bold">
                  {t("nav.login")}
                </Button>
              )}
              
            </div>

            {/* Mobile Actions & Toggle */}
            <div className="md:hidden flex items-center gap-2 flex-1 justify-end">
              <SearchBar />

              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-full border border-border/40 p-0 overflow-hidden shadow-sm" aria-label={t("nav.userMenu")}>
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={user.avatarUrl} alt={user.displayName || user.email || ''} />
                        <AvatarFallback className="text-sm bg-accent/20 text-accent font-bold">
                          {(user.displayName || user.email || "U").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-[1.5rem] p-2 shadow-xl border-border/40 bg-background/95 backdrop-blur-md w-56">
                    <div className="px-3 py-2 text-sm font-serif italic font-bold border-b border-border/40 mb-2 truncate text-accent">
                      {user.displayName || user.email}
                    </div>
                    <DropdownMenuItem asChild className="rounded-xl cursor-pointer font-serif italic mb-1">
                      <Link to="/profile" className="flex items-center gap-2">
                        <User className="h-4 w-4 text-accent" />
                        {t("nav.profile")}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="rounded-xl cursor-pointer font-serif italic mb-1">
                      <Link to="/profile?tab=favorites" className="flex items-center gap-2">
                        <Heart className="h-4 w-4 text-red-500" />
                        {t("nav.favorites")}
                      </Link>
                    </DropdownMenuItem>
                    {showDashboard && (
                      <DropdownMenuItem asChild className="rounded-xl cursor-pointer font-serif italic mb-1">
                        <Link to="/admin" className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-accent" />
                          {isAdmin ? t("nav.admin") : t("nav.dashboard")}
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <div className="h-px bg-border/40 my-1 mx-2" />
                    <DropdownMenuItem onClick={logout} className="rounded-xl cursor-pointer font-serif italic text-destructive hover:bg-destructive/10 hover:text-destructive">
                      {t("nav.logout")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button onClick={login} variant="ghost" size="icon" className="rounded-full border border-border/40 shadow-sm hover:bg-accent/10 hover:text-accent transition-colors" aria-label={t("nav.login")}>
                  <User className="h-5 w-5" />
                </Button>
              )}

              <Button variant="ghost" size="icon" className="rounded-full hover:bg-accent/10 hover:text-accent transition-colors" onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label={isMenuOpen ? t("nav.closeMenu") : t("nav.openMenu")} aria-expanded={isMenuOpen}>
                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden absolute top-[calc(100%+1rem)] left-0 w-full bg-background/95 backdrop-blur-xl border border-border/40 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.2)] rounded-[2rem] py-6 px-6 flex flex-col gap-4 animate-fade-in overflow-hidden">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setIsMenuOpen(false)}
                className={cn(
                  "text-xl font-bold font-serif italic p-3 rounded-2xl transition-colors text-center",
                  location.pathname === link.path ? "text-accent bg-accent/5" : "text-foreground/70 hover:text-accent hover:bg-accent/5"
                )}
              >
                {link.name}
              </Link>
            ))}
            <div className="h-px bg-border/40 w-full my-2" />

            <SocialLinks className="justify-center" />

            <div className="h-px bg-border/40 w-full my-2" />

            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2 bg-secondary/20 p-1.5 rounded-full border border-border/40">
                <Button 
                  variant={language === "en" ? "default" : "ghost"} 
                  size="sm" 
                  className={cn("rounded-full font-bold", language === "en" && "shadow-sm")}
                  onClick={() => setLanguage("en")}
                >
                  EN
                </Button>
                <Button 
                  variant={language === "ro" ? "default" : "ghost"} 
                  size="sm" 
                  className={cn("rounded-full font-bold", language === "ro" && "shadow-sm")}
                  onClick={() => setLanguage("ro")}
                >
                  RO
                </Button>
              </div>
              <ThemeToggle />
            </div>
          </div>
        )}
      </nav>
    </div>
  );
};
