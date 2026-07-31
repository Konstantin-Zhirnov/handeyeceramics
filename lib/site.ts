export const site = {
  name: "Hand Eye Ceramics",
  phoneDisplay: "(778) 898-3414",
  phoneHref: "tel:+17788983414",
  email: "info@handeyeceramics.com",
  instagram: "https://www.instagram.com/handeyedesignceramics/",
  bookingUrl: "https://www.handeyeceramics.com/adult-beginner-pottery-classes-in-vancouver",
};

export const nav = [
  { label: "Classes", href: "#classes" },
  { label: "How it works", href: "#how" },
  { label: "Gallery", href: "#gallery" },
  { label: "Locations", href: "#locations" },
  { label: "Membership", href: "#membership" },
];

export const locations = [
  {
    name: "Chinatown / Strathcona",
    address: "739 Gore Ave, 2nd floor, Vancouver",
    note: "Main studio. Most 6-week courses, all drop-in wheel classes and date nights are held here.",
    tag: "Main studio",
    image: "/images/studio-panorama.jpg",
  },
  {
    name: "Mt Pleasant",
    address: "322 E 5th Ave, Vancouver",
    note: "Pleasant Pottery, our sister studio — 24/7 practice space for students who already have a few classes behind them.",
    tag: "Sister studio",
    image: "/images/studio-empty.png",
  },
  {
    name: "Nanaimo, Vancouver Island",
    address: "3168 Uplands Drive, Nanaimo BC",
    note: "Our newest location. All 6 pm six-week courses on the island run here. Enter through the right-hand gate.",
    tag: "Newest",
    image: "/images/studio-row.png",
  },
];

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
      "Thu 7 PM, Fri 7 PM, Sat 1 & 7 PM, Sun 1 & 4 PM",
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

export const reviews = [
  {
    quote:
      "I recently finished a 6 week beginners wheel throwing course and absolutely loved it. The class size was small, and the studio was bright, airy and open — the perfect environment for learning a new hobby.",
    author: "Courtney P.",
    meta: "6-week beginner course",
  },
  {
    quote:
      "Came in for a date night with zero experience and left with two lopsided bowls and a new hobby. The instructors are patient and genuinely funny.",
    author: "Marcus & Ely",
    meta: "Pottery date night",
  },
  {
    quote:
      "The membership is what sold me. Being able to come in on a Sunday morning and just throw for three hours has completely changed my week.",
    author: "Priya S.",
    meta: "Studio member",
  },
];
