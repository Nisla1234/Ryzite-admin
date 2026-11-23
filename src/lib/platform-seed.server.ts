// Authentic website baseline inventory extracted from Nisla1234/ryzite-unified-platform.
// Used to populate D1 CMS collections without inventing fake portfolio items or reviews.

import type { JsonValue } from "./session";

export interface SeedCmsDocument {
  id: string;
  docType:
    | "page"
    | "portfolio"
    | "service"
    | "solution"
    | "team"
    | "article"
    | "testimonial"
    | "navigation"
    | "seo_override";
  slug: string;
  title: string;
  summary: string;
  category: string;
  status: "draft" | "scheduled" | "published" | "archived";
  sortOrder: number;
  payload: Record<string, JsonValue | undefined>;
  seo: {
    seoTitle?: string | undefined;
    metaDescription?: string | undefined;
    canonicalUrl?: string | undefined;
    robots?: string | undefined;
    ogTitle?: string | undefined;
    ogDescription?: string | undefined;
    ogImage?: string | undefined;
    jsonLd?: string | undefined;
  };
}

const ORIGIN = "https://ryzite-website.thulirkalcom.workers.dev";

export const WEBSITE_CORE_PATHS = [
  "/",
  "/about/",
  "/services/",
  "/solutions/",
  "/our-work/",
  "/how-we-work/",
  "/packages/",
  "/articles/",
  "/contact/",
];

export const SEED_CMS_DOCUMENTS: SeedCmsDocument[] = [
  // Core Website Pages
  {
    id: "doc-page-home",
    docType: "page",
    slug: "/",
    title: "Home",
    summary:
      "RYZITE homepage: hero, marketing & technology divisions, process, packages, trust principles, and FAQ.",
    category: "Core Page",
    status: "published",
    sortOrder: 1,
    payload: {
      route: "/",
      locales: {
        en: {
          eyebrow: "One Agency. All Your Business Solutions.",
          headline: "Digital Growth, Marketing & Software Built Around Your Business.",
          ctaLabel: "Start a Project",
          ctaHref: "/contact/",
        },
        ta: {
          eyebrow: "ஒரே முகமை. உங்கள் அனைத்து வணிகத் தீர்வுகளும்.",
          headline: "உங்கள் வணிகத்திற்கேற்ப டிஜிட்டல் வளர்ச்சி மற்றும் மென்பொருள் தீர்வுகள்.",
          ctaLabel: "திட்டத்தைத் தொடங்கு",
          ctaHref: "/contact/",
        },
        si: {
          eyebrow: "එක් ආයතනයක්. ඔබේ සියලු ව්‍යාපාර විසඳුම්.",
          headline: "ඔබේ ව්‍යාපාරය වටා ගොඩනැගුණු ඩිජිටල් වර්ධනය සහ මෘදුකාංග විසඳුම්.",
          ctaLabel: "ව්‍යාපෘතියක් අරඹන්න",
          ctaHref: "/contact/",
        },
      },
    },
    seo: {
      seoTitle: "RYZITE | Digital Marketing & Technology Solutions Agency",
      metaDescription:
        "RYZITE helps businesses grow with Google SEO, digital advertising, custom websites, online stores, software, mobile apps, and workflow automation.",
      canonicalUrl: `${ORIGIN}/`,
      robots: "index, follow",
      ogTitle: "RYZITE | One Agency. All Your Business Solutions.",
      ogDescription:
        "Marketing services and technology solutions planned clearly around your business goals.",
      ogImage: `${ORIGIN}/images/ryzite-logo.webp`,
    },
  },
  {
    id: "doc-page-about",
    docType: "page",
    slug: "/about/",
    title: "About Us",
    summary: "Company story, marketing and technology capabilities, and how RYZITE works.",
    category: "Core Page",
    status: "published",
    sortOrder: 2,
    payload: {
      route: "/about/",
      locales: {
        en: {
          eyebrow: "ABOUT RYZITE",
          headline: "Clear Digital Strategy, Practical Execution.",
          ctaLabel: "Contact Our Team",
          ctaHref: "/contact/",
        },
        ta: {
          eyebrow: "RYZITE பற்றி",
          headline: "தெளிவான டிஜிட்டல் உத்தி, நடைமுறைச் செயல்பாடு.",
          ctaLabel: "எங்களைத் தொடர்பு கொள்ள",
          ctaHref: "/contact/",
        },
        si: {
          eyebrow: "RYZITE ගැන",
          headline: "පැහැදිලි ඩිජිටල් උපාය මාර්ගය සහ ප්‍රායෝගික ක්‍රියාත්මක කිරීම.",
          ctaLabel: "අප හා සම්බන්ධ වන්න",
          ctaHref: "/contact/",
        },
      },
    },
    seo: {
      seoTitle: "About Us | RYZITE",
      metaDescription:
        "Learn how RYZITE connects marketing strategy and custom technology solutions for growing businesses.",
      canonicalUrl: `${ORIGIN}/about/`,
      robots: "index, follow",
      ogTitle: "About RYZITE | Digital Agency & Technology Partner",
      ogDescription:
        "Practical digital marketing and software delivery in English, Tamil, and Sinhala.",
    },
  },
  {
    id: "doc-page-services",
    docType: "page",
    slug: "/services/",
    title: "Marketing Services",
    summary: "Overview and entry point for RYZITE's 11 marketing services.",
    category: "Offerings",
    status: "published",
    sortOrder: 3,
    payload: {
      route: "/services/",
      locales: {
        en: {
          eyebrow: "MARKETING SERVICES",
          headline: "Reach the Right People and Turn Attention into Growth.",
          ctaLabel: "Explore Services",
          ctaHref: "/contact/",
        },
        ta: {
          eyebrow: "சந்தைப்படுத்தல் சேவைகள்",
          headline: "சரியான வாடிக்கையாளர்களைச் சென்றடையுங்கள்.",
          ctaLabel: "தொடர்பு கொள்ள",
          ctaHref: "/contact/",
        },
        si: {
          eyebrow: "අලෙවිකරණ සේවා",
          headline: "නිවැරදි පාරිභෝගිකයින් වෙත ළඟා වන්න.",
          ctaLabel: "සම්බන්ධ වන්න",
          ctaHref: "/contact/",
        },
      },
    },
    seo: {
      seoTitle: "Marketing Services | RYZITE",
      metaDescription:
        "Google SEO, Google Ads, Meta Ads, social media, branding, motion content, automation, and conversion tracking by RYZITE.",
      canonicalUrl: `${ORIGIN}/services/`,
      robots: "index, follow",
      ogTitle: "Marketing Services | RYZITE",
      ogDescription: "Explore 11 RYZITE digital marketing services.",
    },
  },
  {
    id: "doc-page-solutions",
    docType: "page",
    slug: "/solutions/",
    title: "Technology Solutions",
    summary: "Overview of custom websites, online stores, software, mobile apps, and automation.",
    category: "Offerings",
    status: "published",
    sortOrder: 4,
    payload: {
      route: "/solutions/",
      locales: {
        en: {
          eyebrow: "TECHNOLOGY SOLUTIONS",
          headline: "Digital Platforms & Software Built for Your Operations.",
          ctaLabel: "Discuss a Solution",
          ctaHref: "/contact/",
        },
        ta: {
          eyebrow: "தொழில்நுட்பத் தீர்வுகள்",
          headline: "உங்கள் வணிகத்திற்கான டிஜிட்டல் தளங்கள்.",
          ctaLabel: "தொடர்பு கொள்ள",
          ctaHref: "/contact/",
        },
        si: {
          eyebrow: "තාක්ෂණික විසඳුම්",
          headline: "ඔබේ ව්‍යාපාරයට ගැලපෙන ඩිජිටල් විසඳුම්.",
          ctaLabel: "සම්බන්ධ වන්න",
          ctaHref: "/contact/",
        },
      },
    },
    seo: {
      seoTitle: "Technology Solutions | RYZITE",
      metaDescription:
        "Explore RYZITE technology solutions for websites, online stores, software, mobile apps, chatbots, automation, design, integrations, and website care.",
      canonicalUrl: `${ORIGIN}/solutions/`,
      robots: "index, follow",
      ogTitle: "Technology Solutions | RYZITE",
      ogDescription: "Websites, software, mobile apps, chatbots, API integrations, and care.",
    },
  },
  {
    id: "doc-page-our-work",
    docType: "page",
    slug: "/our-work/",
    title: "Our Work",
    summary: "Showcase and project portfolio hub.",
    category: "Resources",
    status: "published",
    sortOrder: 5,
    payload: {
      route: "/our-work/",
      locales: {
        en: {
          eyebrow: "OUR WORK",
          headline: "Selected Projects & Case Studies.",
          ctaLabel: "Request Proposal",
          ctaHref: "/contact/",
        },
        ta: {
          eyebrow: "எங்கள் பணிகள்",
          headline: "தேர்ந்தெடுக்கப்பட்ட திட்டங்கள்.",
          ctaLabel: "தொடர்பு கொள்ள",
          ctaHref: "/contact/",
        },
        si: {
          eyebrow: "අපගේ වැඩ",
          headline: "තෝරාගත් ව්‍යාපෘති.",
          ctaLabel: "සම්බන්ධ වන්න",
          ctaHref: "/contact/",
        },
      },
    },
    seo: {
      seoTitle: "Our Work | RYZITE",
      metaDescription:
        "Explore approved digital marketing and software case studies delivered by RYZITE.",
      canonicalUrl: `${ORIGIN}/our-work/`,
      robots: "index, follow",
    },
  },
  {
    id: "doc-page-how-we-work",
    docType: "page",
    slug: "/how-we-work/",
    title: "How We Work",
    summary:
      "Six-stage delivery process: Discovery, Planning, Design, Development, Testing, Launch.",
    category: "Resources",
    status: "published",
    sortOrder: 6,
    payload: {
      route: "/how-we-work/",
      locales: {
        en: {
          eyebrow: "HOW WE WORK",
          headline: "From Understanding Your Business to Confident Launch.",
          ctaLabel: "Start Discovery",
          ctaHref: "/contact/",
        },
        ta: {
          eyebrow: "நாங்கள் செயல்படும் விதம்",
          headline: "திட்டமிடல் முதல் வெளியீடு வரை.",
          ctaLabel: "தொடங்குங்கள்",
          ctaHref: "/contact/",
        },
        si: {
          eyebrow: "අපි වැඩ කරන ආකාරය",
          headline: "සැලසුම් කිරීමේ සිට දියත් කිරීම දක්වා.",
          ctaLabel: "අරඹන්න",
          ctaHref: "/contact/",
        },
      },
    },
    seo: {
      seoTitle: "How We Work | RYZITE",
      metaDescription:
        "Understand RYZITE's transparent 6-step process: discovery, planning, design, development, testing, and handover.",
      canonicalUrl: `${ORIGIN}/how-we-work/`,
      robots: "index, follow",
    },
  },
  {
    id: "doc-page-packages",
    docType: "page",
    slug: "/packages/",
    title: "Packages",
    summary: "Discussion packages for websites, growth, and bespoke software scope.",
    category: "Resources",
    status: "published",
    sortOrder: 7,
    payload: {
      route: "/packages/",
      locales: {
        en: {
          eyebrow: "OUR PACKAGES",
          headline: "Flexible Digital Solutions for Every Stage of Business.",
          ctaLabel: "Discuss Your Project",
          ctaHref: "/contact/",
        },
        ta: {
          eyebrow: "தொகுப்புகள்",
          headline: "ஒவ்வொரு வணிக நிலைக்கும் பொருத்தமான தீர்வுகள்.",
          ctaLabel: "தொடர்பு கொள்ள",
          ctaHref: "/contact/",
        },
        si: {
          eyebrow: "පැකේජ",
          headline: "සෑම ව්‍යාපාර අදියරකටම නම්‍යශීලී විසඳුම්.",
          ctaLabel: "සම්බන්ධ වන්න",
          ctaHref: "/contact/",
        },
      },
    },
    seo: {
      seoTitle: "RYZITE Packages | Digital Solutions for Your Business",
      metaDescription:
        "Explore proposed RYZITE digital package options and discuss project scope with our team.",
      canonicalUrl: `${ORIGIN}/packages/`,
      robots: "index, follow",
    },
  },
  {
    id: "doc-page-articles",
    docType: "page",
    slug: "/articles/",
    title: "Articles",
    summary: "Insights and guides across marketing, SEO, web design, and business automation.",
    category: "Resources",
    status: "published",
    sortOrder: 8,
    payload: {
      route: "/articles/",
      locales: {
        en: {
          eyebrow: "ARTICLES",
          headline: "Practical Guides for Business Growth & Technology.",
          ctaLabel: "Talk to Us",
          ctaHref: "/contact/",
        },
        ta: {
          eyebrow: "கட்டுரைகள்",
          headline: "வணிக வளர்ச்சிக்கான வழிகாட்டிகள்.",
          ctaLabel: "தொடர்பு கொள்ள",
          ctaHref: "/contact/",
        },
        si: {
          eyebrow: "ලිපි",
          headline: "ව්‍යාපාර වර්ධනය සඳහා ප්‍රායෝගික මගපෙන්වීම්.",
          ctaLabel: "සම්බන්ධ වන්න",
          ctaHref: "/contact/",
        },
      },
    },
    seo: {
      seoTitle: "Articles & Insights | RYZITE",
      metaDescription:
        "Read practical guides from RYZITE on SEO, digital marketing, websites, and automation.",
      canonicalUrl: `${ORIGIN}/articles/`,
      robots: "index, follow",
    },
  },
  {
    id: "doc-page-contact",
    docType: "page",
    slug: "/contact/",
    title: "Contact",
    summary: "Project enquiry form, direct email, and WhatsApp consultation details.",
    category: "Core Page",
    status: "published",
    sortOrder: 9,
    payload: {
      route: "/contact/",
      locales: {
        en: {
          eyebrow: "CONTACT RYZITE",
          headline: "Let’s Start a Conversation.",
          ctaLabel: "Submit Enquiry",
          ctaHref: "#project-enquiry",
        },
        ta: {
          eyebrow: "தொடர்பு",
          headline: "உங்கள் திட்டத்தைப் பற்றிப் பேசுவோம்.",
          ctaLabel: "சமர்ப்பிக்கவும்",
          ctaHref: "#project-enquiry",
        },
        si: {
          eyebrow: "සම්බන්ධ වන්න",
          headline: "ඔබේ ව්‍යාපෘතිය ගැන කතා කරමු.",
          ctaLabel: "ඉදිරිපත් කරන්න",
          ctaHref: "#project-enquiry",
        },
      },
    },
    seo: {
      seoTitle: "Contact Us | RYZITE",
      metaDescription:
        "Contact RYZITE in Sri Lanka for websites, digital marketing, mobile apps, or custom software.",
      canonicalUrl: `${ORIGIN}/contact/`,
      robots: "index, follow",
    },
  },

  // 11 Marketing Services from offerings.ts
  ...(
    [
      ["Google SEO & Search Visibility", "Help your business get found in search."],
      ["Google Ads Management", "Reach customers when they’re ready to act."],
      ["Facebook & Instagram Ads", "Connect with your audience where they scroll."],
      ["Social Media Management", "Build a consistent, active brand presence."],
      ["Branding & Logo Design", "Give your business a memorable identity."],
      ["Content, Reels & Motion Design", "Bring your story to life through creative content."],
      ["Online Store Marketing", "Turn product discovery into more sales."],
      ["Marketing Automation & CRM", "Keep your leads and customer journeys connected."],
      ["Blog Writing & Content Marketing", "Share useful ideas that build trust over time."],
      [
        "Website Tracking & Conversion Improvement",
        "Understand visitors and improve their next step.",
      ],
      ["Practical AI Marketing Support", "Make everyday marketing work smarter."],
    ] as ReadonlyArray<readonly [string, string]>
  ).map(([title, summary], idx) => {
    const slug = title
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return {
      id: `doc-service-${slug}`,
      docType: "service" as const,
      slug,
      title,
      summary,
      category: "Marketing Services",
      status: "published" as const,
      sortOrder: idx + 1,
      payload: {
        division: "services",
        slug,
        benefits: [
          "Focused campaign planning",
          "Clear reporting & milestones",
          "Aligned with your business goals",
        ],
        faqs: [],
      },
      seo: {
        seoTitle: `${title} | RYZITE Services`,
        metaDescription: summary,
        canonicalUrl: `${ORIGIN}/services/${slug}/`,
        robots: "index, follow",
      },
    };
  }),

  // 9 Technology Solutions from offerings.ts
  ...(
    [
      ["Business Website Design & Development", "A professional home for your business online."],
      ["Online Store Development", "Build a smooth shopping experience for your customers."],
      ["Custom Software for Businesses", "Tools built around the way your business works."],
      ["Mobile App Development", "Put your business in your customers’ hands."],
      ["Customer Chatbots & Assistants", "Help customers find answers and take action."],
      ["Business Workflow Automation", "Connect everyday tasks and free up your team."],
      ["UI/UX Design for Websites & Apps", "Make every interaction clear and intuitive."],
      ["Software & API Integrations", "Get your systems working together."],
      ["Website Care & Maintenance", "Keep your website updated and running smoothly."],
    ] as ReadonlyArray<readonly [string, string]>
  ).map(([title, summary], idx) => {
    const slug = title
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return {
      id: `doc-solution-${slug}`,
      docType: "solution" as const,
      slug,
      title,
      summary,
      category: "Technology Solutions",
      status: "published" as const,
      sortOrder: idx + 1,
      payload: {
        division: "solutions",
        slug,
        benefits: ["Tailored architecture", "Responsive & accessible UI", "Documented handover"],
        faqs: [],
      },
      seo: {
        seoTitle: `${title} | RYZITE Solutions`,
        metaDescription: summary,
        canonicalUrl: `${ORIGIN}/solutions/${slug}/`,
        robots: "index, follow",
      },
    };
  }),

  // Main Navigation & Footer configuration from Navbar.astro, Footer.astro, Constants.ts
  {
    id: "doc-navigation-main",
    docType: "navigation",
    slug: "site-navigation-footer",
    title: "Navigation, Footer & Contact Channels",
    summary: "Primary header menu, footer columns, company contact details, and social profiles.",
    category: "Site Architecture",
    status: "published",
    sortOrder: 1,
    payload: {
      headerLinks: [
        { key: "home", label: "Home", href: "/", visible: true, essential: true },
        { key: "about", label: "About Us", href: "/about/", visible: true, essential: false },
        { key: "services", label: "Services", href: "/services/", visible: true, essential: true },
        {
          key: "solutions",
          label: "Solutions",
          href: "/solutions/",
          visible: true,
          essential: true,
        },
        { key: "packages", label: "Packages", href: "/packages/", visible: true, essential: false },
        { key: "work", label: "Our Work", href: "/our-work/", visible: true, essential: false },
        { key: "articles", label: "Articles", href: "/articles/", visible: true, essential: false },
        { key: "contact", label: "Contact", href: "/contact/", visible: true, essential: true },
      ],
      footerTagline: "One Agency. All Your Business Solutions.",
      company: {
        name: "Ryzite",
        email: "info@ryzite.lk",
        location: "Sri Lanka",
        whatsappDisplay: "+94 72 650 8419",
        whatsappNumber: "94726508419",
      },
      social: {
        facebook: "https://web.facebook.com/ryzite.lk",
        instagram: "https://www.instagram.com/ryzitetm/",
        linkedin: "https://www.linkedin.com/company/ryzite/",
        tiktok: "https://www.tiktok.com/@ryzite",
        youtube: "",
      },
    },
    seo: {},
  },
];
