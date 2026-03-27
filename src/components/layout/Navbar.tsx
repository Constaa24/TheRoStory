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
    <nav className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-md border-b border-border transition-all duration-300">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="The RoStory Logo"
              className="h-9 w-9 sm:h-10 sm:w-10 rounded-md shrink-0 object-contain"
            />
            <span className="text-2xl sm:text-3xl font-serif font-black tracking-tighter text-primary">
              The <span className="text-accent">Ro</span>Story
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-accent",
                  location.pathname === link.path ? "text-accent" : "text-foreground/70"
                )}
              >
                {link.name}
              </Link>
            ))}
          </div>

          {/* Right Actions */}
          <div className="hidden md:flex items-center gap-4">
            {/* Search */}
            <SearchBar />

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Language Switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Globe className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  onClick={() => setLanguage("en")}
                  className={language === "en" ? "bg-accent/10 font-bold" : ""}
                >
                  English
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setLanguage("ro")}
                  className={language === "ro" ? "bg-accent/10 font-bold" : ""}
                >
                  Română
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Auth */}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2 rounded-full border border-border px-4">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={user.avatarUrl} alt={user.displayName || user.email || ''} />
                      <AvatarFallback className="text-xs bg-accent/10 text-accent">
                        {(user.displayName || user.email || "U").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium truncate max-w-[100px]">
                      {user.displayName || user.email}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {t("nav.profile")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/profile?tab=favorites" className="flex items-center gap-2">
                      <Heart className="h-4 w-4" />
                      {t("nav.favorites")}
                    </Link>
                  </DropdownMenuItem>
                  {showDashboard && (
                    <DropdownMenuItem asChild>
                      <Link to="/admin" className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        {isAdmin ? t("nav.admin") : t("nav.dashboard")}
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={logout} className="text-destructive">
                    {t("nav.logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button onClick={login} variant="default" size="sm" className="rounded-full px-6">
                {t("nav.login")}
              </Button>
            )}
          </div>

          {/* Mobile Actions & Toggle */}
          <div className="md:hidden flex items-center gap-2">
            {/* Search for Mobile */}
            <SearchBar />

            {/* Auth for Mobile */}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full border border-border p-0 overflow-hidden">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user.avatarUrl} alt={user.displayName || user.email || ''} />
                      <AvatarFallback className="text-sm bg-accent/10 text-accent">
                        {(user.displayName || user.email || "U").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <div className="px-2 py-1.5 text-sm font-medium border-b border-border mb-1 max-w-[200px] truncate">
                    {user.displayName || user.email}
                  </div>
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {t("nav.profile")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/profile?tab=favorites" className="flex items-center gap-2">
                      <Heart className="h-4 w-4" />
                      {t("nav.favorites")}
                    </Link>
                  </DropdownMenuItem>
                  {showDashboard && (
                    <DropdownMenuItem asChild>
                      <Link to="/admin" className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        {isAdmin ? t("nav.admin") : t("nav.dashboard")}
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={logout} className="text-destructive">
                    {t("nav.logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button onClick={login} variant="ghost" size="icon" className="rounded-full border border-border">
                <User className="h-5 w-5" />
              </Button>
            )}
            
            <Button variant="ghost" size="icon" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden absolute top-20 left-0 w-full bg-background border-b border-border py-4 px-4 flex flex-col gap-4 animate-fade-in">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              onClick={() => setIsMenuOpen(false)}
              className={cn(
                "text-lg font-medium",
                location.pathname === link.path ? "text-accent" : "text-foreground/70"
              )}
            >
              {link.name}
            </Link>
          ))}
          <div className="h-px bg-border w-full my-2" />
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Button 
                  variant={language === "en" ? "default" : "ghost"} 
                  size="sm" 
                  onClick={() => setLanguage("en")}
                >
                  EN
                </Button>
                <Button 
                  variant={language === "ro" ? "default" : "ghost"} 
                  size="sm" 
                  onClick={() => setLanguage("ro")}
                >
                  RO
                </Button>
              </div>
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};
