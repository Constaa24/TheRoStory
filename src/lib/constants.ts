export const COUNTIES = [
  "Alba", "Arad", "Argeș", "Bacău", "Bihor", "Bistrița-Năsăud", "Botoșani", "Brașov", "Brăila", "București",
  "Buzău", "Caraș-Severin", "Călărași", "Cluj", "Constanța", "Covasna", "Dâmbovița", "Dolj", "Galați",
  "Giurgiu", "Gorj", "Harghita", "Hunedoara", "Ialomița", "Iași", "Ilfov", "Maramureș", "Mehedinți",
  "Mureș", "Neamț", "Olt", "Prahova", "Satu Mare", "Sălaj", "Sibiu", "Suceava", "Teleorman", "Timiș",
  "Tulcea", "Vaslui", "Vâlcea", "Vrancea"
] as const;

// Comments
export const COMMENT_MAX_LENGTH = 1000;
export const COMMENT_COOLDOWN_MS = 10_000;

// Pagination
export const ARTICLES_PAGE_SIZE = 9;
export const ADMIN_USERS_PAGE_SIZE = 25;
export const SEARCH_RESULTS_LIMIT = 6;

// Caching
export const PUBLIC_CONTENT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Storytelling
export const CHAPTER_COUNT = 5;

// Site
export const SITE_URL = "https://therostory.com";
export const SITE_NAME = "The RoStory";
