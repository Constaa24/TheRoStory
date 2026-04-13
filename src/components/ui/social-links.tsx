import React from "react";
import { Instagram, Youtube } from "lucide-react";
import { TikTokIcon } from "@/components/ui/tiktok-icon";
import { cn } from "@/lib/utils";

const SOCIAL_LINKS = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/therostory",
    icon: (className: string) => <Instagram className={className} />,
  },
  {
    label: "TikTok",
    href: "https://www.tiktok.com/@therostory",
    icon: (className: string) => <TikTokIcon className={className} />,
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/@therostory",
    icon: (className: string) => <Youtube className={className} />,
  },
] as const;

interface SocialLinksProps {
  iconSize?: string;
  className?: string;
}

export const SocialLinks: React.FC<SocialLinksProps> = ({
  iconSize = "h-5 w-5",
  className,
}) => (
  <div className={cn("flex items-center gap-4", className)}>
    {SOCIAL_LINKS.map(({ label, href, icon }) => (
      <a
        key={label}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        className="text-muted-foreground hover:text-accent transition-colors duration-200"
      >
        {icon(iconSize)}
      </a>
    ))}
  </div>
);
