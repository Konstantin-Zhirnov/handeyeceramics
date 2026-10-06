/**
 * Texts of the prototype's home page that used to live inside its components.
 * The seed moves them into the `home` global and the site settings, where the
 * owner edits them. In a heading `*…*` marks the italic part and ` / ` a line break.
 */
export const hero = {
  eyebrow: "Pottery classes · Vancouver & Nanaimo",
  title: "Throw / *your first pot*",
  subtitle:
    "Six-week wheel courses, one-night drop-ins and date nights across three studios. No experience needed, every tool provided.",
  primaryCta: { label: "See classes", href: "#classes" },
};

export const sections: { key: string; eyebrow?: string; heading?: string; body?: string }[] = [
  {
    key: "feature-1",
    heading: "No experience needed",
    body: "If you've never touched clay in your life, you're exactly who these classes are built for.",
  },
  {
    key: "feature-2",
    heading: "Three studios",
    body: "Chinatown, Mt Pleasant and Nanaimo — pick whichever one is on your way home.",
  },
  {
    key: "feature-3",
    heading: "Small classes",
    body: "Enough wheels, enough space and an instructor who actually gets round to you.",
  },
  {
    key: "feature-4",
    heading: "From $145 / month",
    body: "Studio membership with no time limits — come practise on your own schedule.",
  },
  { key: "classes", eyebrow: "Classes", heading: "Pick the one that *fits your week*" },
  { key: "gallery", eyebrow: "Gallery", heading: "Made by people *on their first try*" },
  { key: "reviews", eyebrow: "What students say" },
  {
    key: "locations",
    eyebrow: "Locations",
    heading: "Four studios, *one community*",
    body: "Each studio has its own page, its own schedule and its own listing in local search — so nobody in Nanaimo assumes we only teach in Vancouver, and nobody in Vancouver assumes the opposite.",
  },
  {
    key: "other-studios",
    eyebrow: "We're also here",
    body: "Same instructors, same six-week course. Pick whichever one you can actually get to.",
  },
  {
    key: "membership",
    eyebrow: "Membership & rentals",
    // The price is in the body: the old home page's own membership line stands here (home-moves.ts); this body is the fallback.
    heading: "Studio access, / on your own time",
    body: "Taken a few classes and want somewhere to keep going? Our members practise on their own schedule in a studio that already knows their name.",
  },
  {
    key: "perk-1",
    heading: "No time limits",
    body: "Flexible days, open shelves and a key to the door. Come in for twenty minutes or for the whole afternoon.",
  },
  {
    key: "perk-2",
    heading: "Shared kilns and glazes",
    body: "Firing is included. So is our glaze library — the same colours you used in class, whenever you want them.",
  },
  {
    key: "perk-3",
    heading: "A studio full of people",
    body: "Members, instructors and the odd film-prop commission. It's the part nobody expects and everybody stays for.",
  },
];

export const footerText =
  "Hands-on pottery classes in Vancouver and Nanaimo. Come learn to throw, hand build and glaze — and rediscover what your hands can do.";
