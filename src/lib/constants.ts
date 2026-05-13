export const COUNTIES = [
  "Alba", "Arad", "Argeș", "Bacău", "Bihor", "Bistrița-Năsăud", "Botoșani", "Brașov", "Brăila", "București",
  "Buzău", "Caraș-Severin", "Călărași", "Cluj", "Constanța", "Covasna", "Dâmbovița", "Dolj", "Galați",
  "Giurgiu", "Gorj", "Harghita", "Hunedoara", "Ialomița", "Iași", "Ilfov", "Maramureș", "Mehedinți",
  "Mureș", "Neamț", "Olt", "Prahova", "Satu Mare", "Sălaj", "Sibiu", "Suceava", "Teleorman", "Timiș",
  "Tulcea", "Vaslui", "Vâlcea", "Vrancea"
] as const;

// Site
export const SITE_URL = "https://therostory.com";
export const SITE_NAME = "The RoStory";

// Sentinel for the "no location" option in county Selects. Radix Select
// forbids empty string values on SelectItem, so we route through this
// constant and map back to '' before persisting.
export const LOCATION_NONE = "__none__";
