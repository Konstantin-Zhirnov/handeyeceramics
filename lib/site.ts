export const site = {
  name: "Hand Eye Ceramics",
  phoneDisplay: "(778) 898-3414",
  phoneHref: "tel:+17788983414",
  email: "info@handeyeceramics.com",
  instagram: "https://www.instagram.com/handeyedesignceramics/",
  bookingUrl: "https://www.handeyeceramics.com/adult-beginner-pottery-classes-in-vancouver",
  url: "https://handeyeceramics.vercel.app",
};

// "Locations" is deliberately absent — the location switcher replaces it, so
// the studios are visible on every page instead of hidden behind one link.
export const nav = [
  { label: "Classes", href: "/#classes" },
  { label: "Gallery", href: "/#gallery" },
  { label: "Membership", href: "/#membership" },
];

/**
 * The pinned hero stage: three chapters scrubbed by scroll, the way the
 * reference reel pours chocolate over a bun.
 *
 * Two versions. With `stageSequence` set, a canvas plays the generated
 * frames (a lump of clay throws itself into a vase, then takes its glaze)
 * and `sequenceChapters` narrate it. Without it, `photoChapters` tell the same
 * story with the studio's own photographs.
 */
export type StageChapter = {
  n: string;
  label: string;
  title: string;
  body: string;
  image: string;
  alt: string;
  position: string;
};

export const photoChapters: StageChapter[] = [
  {
    n: "01",
    label: "Centre",
    title: "Start with a ball of clay.",
    body: "Night one: a wheel, a bucket of water and an instructor who has centred ten thousand of these.",
    image: "/images/wheel-spin.jpg",
    alt: "Clay spinning on the potter's wheel, seen from above",
    position: "50% 55%",
  },
  {
    n: "02",
    label: "Throw",
    title: "Open it. Pull it up.",
    body: "Week by week the walls get thinner and the bowls stop collapsing. That part is the fun.",
    image: "/images/hands-clay.jpg",
    alt: "Wet hands opening a fresh ball of clay on the wheel",
    position: "50% 42%",
  },
  {
    n: "03",
    label: "Glaze",
    title: "Glaze it. Take it home.",
    body: "Pick colours from our glaze library, we fire everything in-house, and it waits on the shelf for you.",
    image: "/images/studio-panorama.jpg",
    alt: "Shelves of finished, glazed pots in the Gore Avenue studio",
    position: "30% 50%",
  },
];

export const sequenceChapters: StageChapter[] = [
  {
    n: "01",
    label: "Clay",
    title: "It starts as a lump of clay.",
    body: "Night one: a wheel, a bucket of water and an instructor who has centred thousands of these.",
    image: "/assets/img/stage-poster-1920.webp",
    alt: "A lump of wet clay on a potter's wheel",
    position: "50% 50%",
  },
  {
    n: "02",
    label: "Throw",
    title: "Six weeks to a real shape.",
    body: "Centre, open, pull, shape. Week by week the walls get thinner and the forms get braver.",
    image: "/assets/img/stage-poster-1920.webp",
    alt: "",
    position: "50% 50%",
  },
  {
    n: "03",
    label: "Glaze",
    title: "Glazed, fired, yours.",
    body: "Pick a colour from our glaze library, we fire it in-house, and it waits on the shelf for you.",
    image: "/assets/img/stage-poster-1920.webp",
    alt: "",
    position: "50% 50%",
  },
];

/**
 * Generated clay-to-vase sequence (kie.ai: GPT Image 2 stills + Veo 3.1 Fast
 * transitions, built with the reference skill's build_media.py).
 * `windows` are the chapter windows on the stage's scroll progress, aligned
 * to where the pour starts and ends in the frames.
 */
export const stageSequence: {
  path: string;
  count: number;
  poster: string;
  windows: [number, number][];
} | null = {
  path: "/assets/seq",
  // 12-frame hold on the lump + t1 lump → cylinder (50) + t2 cylinder → vase (50)
  // + t3 wet clay → glazed (44)
  count: 156,
  poster: "/assets/img/stage-poster-1920.webp",
  // stage progress p = 0.16 + 0.84 × frame/155: the clay is centred and opened
  // by p ≈ 0.4, the vase is shaped by p ≈ 0.77, glazed from there to the end
  windows: [
    [0.1, 0.42],
    [0.38, 0.79],
    [0.75, 1.01],
  ],
};

export const stageChapters = stageSequence ? sequenceChapters : photoChapters;

export type Location = {
  slug: string;
  /** Short label for the switcher. */
  short: string;
  /** Full studio name. */
  name: string;
  region: string;
  tag: string;
  status: "open" | "planned";
  street: string;
  locality: string;
  regionCode: string;
  postalCode?: string;
  country: string;
  image: string;
  /** Verified from the studio's Google Business Profile. */
  google?: { rating: number; count: number; url: string };
  /** Homepage card copy. */
  note: string;
  /** Per-page SEO. Each location owns its own title and description. */
  metaTitle: string;
  metaDescription: string;
  h1: string;
  intro: string;
  access?: string;
  schedule: { label: string; times: string }[];
  highlights: string[];
};

/**
 * One record per studio. Everything downstream — the /classes/[location]
 * routes, the switcher, the homepage cards and the LocalBusiness structured
 * data — is generated from this array, so adding a studio means adding an
 * object here and nothing else.
 *
 * Schedules are transcribed from handeyeceramics.com, where a few times are
 * listed inconsistently between the home page and the classes page. Confirm
 * with the studio before this goes live.
 */
export const locations: Location[] = [
  {
    slug: "vancouver-chinatown",
    short: "Chinatown",
    name: "Chinatown / Strathcona",
    region: "Vancouver, BC",
    tag: "Main studio",
    status: "open",
    street: "739 Gore Ave, 2nd floor",
    locality: "Vancouver",
    regionCode: "BC",
    postalCode: "V6A 2Z9",
    country: "CA",
    image: "/images/studio-panorama.jpg",
    google: {
      rating: 4.6,
      count: 383,
      url: "https://www.google.com/maps/search/Hand+Eye+Design+Ceramics+739+Gore+Ave+Vancouver",
    },
    note: "Main studio. Most 6-week courses, all drop-in wheel classes and date nights are held here.",
    metaTitle: "Pottery Classes in Chinatown, Vancouver | Hand Eye Ceramics",
    metaDescription:
      "Wheel throwing and hand building classes at 739 Gore Ave in Vancouver's Chinatown. Six-week courses, drop-ins and date nights, 7 days a week. No experience needed.",
    h1: "Pottery classes in Chinatown, Vancouver",
    intro:
      "Our main studio, on the second floor of 739 Gore Ave in Strathcona. Brick walls, big windows and most of our schedule — if a class isn't marked otherwise, it runs here.",
    access:
      "Use the door code from your student info email and ring the bell to the right of the third door.",
    schedule: [
      { label: "Six-week courses", times: "Weekday evenings 6:30 & 7 PM · Sat 9:30 AM & 1 PM · Sun 1 & 4 PM" },
      { label: "Daytime classes", times: "12:30, 2:30 and 3 PM" },
      { label: "Date night", times: "Thu 7 PM · Fri 7 PM · Sat 1 & 7 PM · Sun 1 & 4 PM" },
      { label: "Drop-in hand building", times: "Fri 7 PM" },
      { label: "Drop-in wheel", times: "All drop-in wheel classes run here" },
    ],
    highlights: [
      "Every drop-in wheel class in the city runs at this studio",
      "Private classes and group workshops by arrangement",
      "Two minutes from the Gore & Union bike route",
    ],
  },
  {
    slug: "vancouver-mount-pleasant",
    short: "Mt Pleasant",
    name: "Mt Pleasant",
    region: "Vancouver, BC",
    tag: "Sister studio",
    status: "open",
    street: "322 E 5th Ave",
    locality: "Vancouver",
    regionCode: "BC",
    postalCode: "V5T 1J1",
    country: "CA",
    image: "/images/studio-empty.png",
    google: {
      rating: 4.9,
      count: 14,
      url: "https://www.google.com/maps/search/Pleasant+Pottery+322+E+5th+Ave+Vancouver",
    },
    note: "Pleasant Pottery, our sister studio — 24/7 practice space for students who already have a few classes behind them.",
    metaTitle: "Pottery Studio Space in Mt Pleasant, Vancouver | Hand Eye Ceramics",
    metaDescription:
      "Pleasant Pottery at 322 E 5th Ave — 24/7 members' studio space in Mt Pleasant, Vancouver, for potters who have already taken a few classes.",
    h1: "Studio space in Mt Pleasant, Vancouver",
    intro:
      "Pleasant Pottery is our sister studio on East 5th. It isn't where the beginner courses run — it's where you go once you have a few classes behind you and want somewhere to practise on your own schedule.",
    schedule: [
      { label: "Member access", times: "24/7, no time limits" },
      { label: "Membership", times: "From $145 a month" },
    ],
    highlights: [
      "Open around the clock to members",
      "Shared kilns and the full glaze library",
      "Best fit after a six-week course at one of our teaching studios",
    ],
  },
  {
    slug: "nanaimo",
    short: "Nanaimo",
    name: "Nanaimo, Vancouver Island",
    region: "Nanaimo, BC",
    tag: "Vancouver Island",
    status: "open",
    street: "3168 Uplands Drive",
    locality: "Nanaimo",
    regionCode: "BC",
    postalCode: "V9T 2S8",
    country: "CA",
    image: "/images/studio-row.png",
    google: {
      rating: 4.9,
      count: 38,
      url: "https://www.google.com/maps/search/Nanaimo+Hand+Eye+Ceramics+3168+Uplands+Dr",
    },
    note: "Our newest studio, and the only one on Vancouver Island. Six-week evening courses and Friday date nights run here.",
    metaTitle: "Pottery Classes in Nanaimo, BC | Hand Eye Ceramics",
    metaDescription:
      "Wheel throwing classes on Vancouver Island at 3168 Uplands Drive, Nanaimo. Six-week evening courses Monday to Thursday, plus Friday date nights. Beginners welcome.",
    h1: "Pottery classes in Nanaimo",
    intro:
      "Our Vancouver Island studio, and our newest. You don't need to cross the water for a class — the full six-week beginner course runs here four evenings a week.",
    access: "Enter through the right-hand gate; the studio is at the back of the house. Park parallel in the driveway if there's room.",
    schedule: [
      { label: "Six-week courses", times: "Mon, Tue, Wed & Thu 6 PM" },
      { label: "Afternoon course", times: "Wed 3 PM" },
      { label: "Weekend course", times: "Sat 10 AM" },
      { label: "Date night", times: "Fri 7 PM" },
    ],
    highlights: [
      "The only Hand Eye studio on Vancouver Island",
      "Same course, same instructors, no ferry",
      "Small groups — a home-based studio, not a warehouse",
    ],
  },
  {
    slug: "calgary",
    short: "Calgary",
    name: "Calgary",
    region: "Calgary, AB",
    tag: "Coming soon",
    status: "planned",
    street: "Location to be announced",
    locality: "Calgary",
    regionCode: "AB",
    country: "CA",
    image: "/images/carving-window.png",
    note: "Placeholder entry. Demonstrates how a fourth studio joins the site — one record, and its page, schema and switcher entry appear.",
    metaTitle: "Pottery Classes in Calgary | Hand Eye Ceramics",
    metaDescription:
      "Hand Eye Ceramics is looking at a Calgary studio. Join the list to hear when classes open.",
    h1: "Pottery classes in Calgary",
    intro:
      "We're looking at Calgary. Nothing is booked yet — leave us your email and you'll be the first to know when a date is set.",
    schedule: [{ label: "Opening", times: "To be announced" }],
    highlights: [
      "Not open yet — this page exists so it can be indexed early",
      "Same six-week beginner course as our BC studios",
    ],
  },
];

export const openLocations = locations.filter((l) => l.status === "open");

/** Real Google review totals across all three studio profiles. */
export const googleTotals = locations.reduce(
  (acc, l) => (l.google ? { count: acc.count + l.google.count, profiles: acc.profiles + 1 } : acc),
  { count: 0, profiles: 0 },
);

export function findLocation(slug: string) {
  return locations.find((l) => l.slug === slug);
}

export const classTabs = [
  {
    id: "wheel",
    label: "Wheel throwing",
    title: "6-week beginner & intermediate course",
    price: "Once a week · 6 weeks",
    image: "/images/class-pair.png",
    body: "Never touched clay? Perfect. You'll centre, pull and trim your first mugs and bowls in small groups, then glaze everything at the end of the course.",
    points: [
      "Mornings, afternoons and evenings, 7 days a week",
      "All tools provided — you buy an apron ($17) and a trimming tool ($10) on day one",
      "Intermediate-only sections available if you already have experience",
    ],
  },
  {
    id: "handbuilding",
    label: "Hand building",
    title: "Friday & Saturday drop-in",
    price: "One evening · no commitment",
    image: "/images/carving-window.png",
    body: "Pinch, coil and slab-build a sculptural or functional piece in a single session. The easiest way to find out whether clay is your thing.",
    points: [
      "Open to all: lovers, friends and family",
      "No experience and no series to commit to",
      "Fridays 7 PM at the Gore Ave studio",
    ],
  },
  {
    id: "datenight",
    label: "Date night",
    title: "Pottery date night for two",
    price: "Thu–Sun evenings",
    image: "/images/throwing-closeup.png",
    body: "Whether it's a first date or a friend date, you both get a wheel, an instructor and two hours of very good mess.",
    points: [
      "Thu 7 PM, Fri 7 PM, Sat 1 & 7 PM, Sun 1 & 4 PM in Vancouver",
      "Also runs in Nanaimo on Fridays at 7 PM",
      "Group workshops, birthdays and team building on request",
    ],
  },
];

export const steps = [
  {
    title: "Pick a class that fits your week",
    body: "Weekday evenings are the most popular, but there's a Monday afternoon and a Sunday morning too. Nothing to figure out — just pick a time.",
  },
  {
    title: "Get your hands dirty",
    body: "Small groups, one instructor, a wheel each. You'll wreck a couple of pots before the first one stands up, and that's the good part.",
  },
  {
    title: "Glaze it, fire it, take it home",
    body: "Choose from our colourful glaze library. We fire everything in-house and let you know the moment your pieces are ready to collect.",
  },
];

export const gallery = [
  { src: "/images/cups-shelf.jpg", alt: "Faceted stoneware cups drying on studio shelves" },
  { src: "/images/vase-carving.jpg", alt: "Student carving flowers into a tall vase" },
  { src: "/images/wheel-spin.jpg", alt: "Clay spinning on the wheel, seen from above" },
  { src: "/images/red-apron.png", alt: "Student in a red apron at the wheel" },
  { src: "/images/teaching.png", alt: "Instructor guiding a student's hands on the wheel" },
  { src: "/images/hands-clay.jpg", alt: "Wet hands opening a fresh ball of clay" },
  { src: "/images/studio-row.png", alt: "A row of students throwing in the Chinatown studio" },
];

/**
 * Real review, quoted from handeyeceramics.com. Only genuine testimonials
 * belong here — do not pad this list with invented ones.
 */
export const reviews = [
  {
    quote:
      "I recently finished a 6 week beginners/introductory wheel throwing pottery course and absolutely loved it. The class size was small, and the studio was bright, airy, and open, which is the perfect environment for learning a new hobby. I'm really looking forward to receiving my finished pieces and signing up for more classes!",
    author: "Courtney P.",
    meta: "6-week beginner course",
  },
];
