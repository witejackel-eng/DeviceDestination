import type { Product, ProductDocument } from "@/lib/products";
import { slugify } from "@/lib/products";

const verifiedAt = "2026-07-22T00:00:00.000Z";

type ExactProductInput = {
  slug?: string;
  model: string;
  brand: string;
  category: string;
  title: string;
  shortDescription: string;
  longDescription: string;
  images: string[];
  documents?: Array<Omit<ProductDocument, "model">>;
  specs: Record<string, string>;
  highlights: string[];
  useCases: string[];
  sellingPriceInclGstPaise: number;
  stockStatus?: Product["stockStatus"];
  officialSourceUrl: string;
  warrantySummary: string;
  relatedProductIds?: string[];
  builderCompatibleIds?: string[];
  builderExclusions?: string[];
};

function exactProduct(input: ExactProductInput): Product {
  const slug = input.slug ?? slugify(`${input.brand}-${input.model}`);
  return {
    id: slug,
    slug,
    legacySlugs: [],
    model: input.model,
    brand: input.brand,
    brandSlug: slugify(input.brand),
    category: input.category,
    categorySlug: slugify(input.category),
    title: input.title,
    shortDescription: input.shortDescription,
    longDescription: input.longDescription,
    images: input.images,
    imageModel: input.model,
    documents: (input.documents ?? []).map((document) => ({ ...document, model: input.model })),
    specs: input.specs,
    highlights: input.highlights,
    useCases: input.useCases,
    stockStatus: input.stockStatus ?? "in_stock",
    sellingPriceInclGstPaise: input.sellingPriceInclGstPaise,
    mrpInclGstPaise: null,
    compareAtPriceInclGstPaise: null,
    compareAtLabel: null,
    gstRateBasisPoints: 1800,
    gstIncluded: true,
    priceVerifiedAt: verifiedAt,
    priceSourceStatus: "verified",
    officialSourceUrl: input.officialSourceUrl,
    verifiedAt,
    warrantySummary: input.warrantySummary,
    relatedProductIds: input.relatedProductIds ?? [],
    builderCompatibleIds: input.builderCompatibleIds ?? [],
    builderExclusions: input.builderExclusions ?? [],
  };
}

const cameraBuilderIds = ["cp-unr-108f1", "cp-unr-4k2161-v2"];
const cameraBuilderExclusions = [
  "Recorder channel count, PoE budget, HDD capacity and retention period require project sizing",
];

export const exactCatalogueExpansion: Product[] = [
  exactProduct({
    model: "GS108PP",
    brand: "NETGEAR",
    category: "PoE Switches",
    title: "NETGEAR GS108PP 8-Port Gigabit High-Power PoE+ Switch",
    shortDescription:
      "An unmanaged eight-port Gigabit PoE+ switch with a 123 W power budget for cameras, access points and VoIP endpoints.",
    longDescription:
      "The GS108PP provides eight auto-negotiating Gigabit copper ports, with PoE+ available on every port. NETGEAR FlexPoE allows the power budget to be changed with a compatible external power supply, while its fanless metal enclosure suits desks, walls and equipment racks. It is an unmanaged switch and does not provide configurable VLAN controls.",
    images: ["/images/products/NETGEAR-GS108PP.png"],
    documents: [
      {
        type: "datasheet",
        title: "NETGEAR datasheet",
        url: "/docs/datasheets/NETGEAR-GS108PP-GS116PP.pdf",
      },
      {
        type: "installation-guide",
        title: "Installation guide",
        url: "/docs/manuals/NETGEAR-GS108PP-installation-guide.pdf",
      },
    ],
    specs: {
      Ports: "8 × 10/100/1000BASE-T RJ45",
      "PoE ports": "8 × IEEE 802.3af/802.3at",
      "PoE budget": "123 W with supplied power adapter",
      "Per-port power": "Up to 30 W PoE+",
      "Switching capacity": "16 Gbps",
      Management: "Unmanaged",
      Mounting: "Desktop, wall or rack",
      Cooling: "Fanless",
    },
    highlights: [
      "8 Gigabit PoE+ ports",
      "123 W PoE budget",
      "Fanless metal enclosure",
      "FlexPoE power supply support",
    ],
    useCases: [
      "IP camera networks",
      "Wireless access points",
      "VoIP deployments",
      "Small equipment racks",
    ],
    sellingPriceInclGstPaise: 1_098_000,
    officialSourceUrl: "https://www.netgear.com/in/business/wired/switches/unmanaged/gs108pp/",
    warrantySummary: "NETGEAR limited lifetime hardware warranty; regional terms apply",
    relatedProductIds: ["cp-unc-da21l3c-q", "cp-unc-ta21l3c-q"],
  }),
  exactProduct({
    model: "GS116PP",
    brand: "NETGEAR",
    category: "PoE Switches",
    title: "NETGEAR GS116PP 16-Port Gigabit High-Power PoE+ Switch",
    shortDescription:
      "A 16-port unmanaged Gigabit PoE+ switch with a 183 W power budget for denser camera and business-network deployments.",
    longDescription:
      "The GS116PP supplies Gigabit data and PoE+ power across all 16 copper ports. Its 183 W FlexPoE budget is intended for multiple powered endpoints and can be reduced with compatible NETGEAR power modules. The fanless metal chassis supports desktop, wall and rack placement; configuration features such as managed VLANs are not included.",
    images: ["/images/products/NETGEAR-GS116PP.png"],
    documents: [
      {
        type: "datasheet",
        title: "NETGEAR datasheet",
        url: "/docs/datasheets/NETGEAR-GS108PP-GS116PP.pdf",
      },
      {
        type: "installation-guide",
        title: "Installation guide",
        url: "/docs/manuals/NETGEAR-GS116PP-installation-guide.pdf",
      },
    ],
    specs: {
      Ports: "16 × 10/100/1000BASE-T RJ45",
      "PoE ports": "16 × IEEE 802.3af/802.3at",
      "PoE budget": "183 W with supplied power adapter",
      "Per-port power": "Up to 30 W PoE+",
      "Switching capacity": "32 Gbps",
      Management: "Unmanaged",
      Mounting: "Desktop, wall or rack",
      Cooling: "Fanless",
    },
    highlights: [
      "16 Gigabit PoE+ ports",
      "183 W PoE budget",
      "Fanless rack-mountable chassis",
      "FlexPoE power supply support",
    ],
    useCases: [
      "Multi-camera surveillance",
      "Office access points",
      "VoIP deployments",
      "Medium equipment racks",
    ],
    sellingPriceInclGstPaise: 1_890_000,
    officialSourceUrl: "https://www.netgear.com/in/business/wired/switches/unmanaged/gs116pp/",
    warrantySummary: "NETGEAR limited lifetime hardware warranty; regional terms apply",
    relatedProductIds: ["cp-unc-da41l3c-d-q", "cp-unc-ta41l3c-q"],
  }),
  exactProduct({
    model: "PT-NC123D3-N(D2)",
    brand: "Prama",
    category: "Dome Cameras",
    title: "Prama PT-NC123D3-N(D2) 2 MP Fixed Turret Network Camera",
    shortDescription:
      "A 2 MP PoE turret camera with 30 m infrared illumination, H.265 compression and IP67 protection.",
    longDescription:
      "The PT-NC123D3-N(D2) is a fixed-lens network turret for indoor or sheltered outdoor surveillance. It records up to 1920 × 1080, supports target-aware motion events and ONVIF integration, and can be powered by 12 VDC or IEEE 802.3af PoE. This IR model records monochrome images in darkness and does not provide colour night illumination.",
    images: ["/images/products/PT-NC123D3-ND2.png"],
    specs: {
      "Image sensor": "1/2.9 inch progressive scan CMOS",
      "Max resolution": "1920 × 1080",
      Lens: "2.8 mm or 4 mm fixed options",
      "IR range": "Up to 30 m",
      Compression: "H.265, H.264, MJPEG (sub-stream)",
      WDR: "Digital WDR",
      Network: "RJ45 10/100 Mbps; ONVIF Profile S/T",
      Power: "12 VDC or IEEE 802.3af PoE",
      Protection: "IP67",
      Dimensions: "185.8 × 66 × 69.1 mm",
    },
    highlights: [
      "2 MP Full HD",
      "30 m smart IR",
      "Human and vehicle event filtering",
      "PoE and IP67",
    ],
    useCases: [
      "Retail interiors",
      "Office corridors",
      "Residential entrances",
      "Covered outdoor areas",
    ],
    sellingPriceInclGstPaise: 255_000,
    officialSourceUrl: "https://www.pramaindia.in/product/pt-nc123d3-nd2/",
    warrantySummary: "Warranty details available on request",
    relatedProductIds: ["cp-unr-108f1", "netgear-gs108pp"],
    builderCompatibleIds: cameraBuilderIds,
    builderExclusions: cameraBuilderExclusions,
  }),
  exactProduct({
    model: "PT-NC143D3-N(D2)",
    brand: "Prama",
    category: "Dome Cameras",
    title: "Prama PT-NC143D3-N(D2) 4 MP Fixed Turret Network Camera",
    shortDescription:
      "A 4 MP fixed turret network camera with 120 dB WDR, 30 m IR, PoE and an IP67 enclosure.",
    longDescription:
      "The PT-NC143D3-N(D2) records 2560 × 1440 video and is intended for entrances, counters and general perimeter coverage. It supports H.265 compression, ONVIF profiles S and T, human and vehicle event filtering and either 12 VDC or PoE power. Infrared illumination provides monochrome night video up to 30 metres.",
    images: ["/images/products/PT-NC143D3-ND2.png"],
    specs: {
      "Image sensor": "1/3 inch progressive scan CMOS",
      "Max resolution": "2560 × 1440",
      Lens: "2.8 mm or 4 mm fixed options",
      "IR range": "Up to 30 m",
      Compression: "H.265, H.264, MJPEG (sub-stream)",
      WDR: "120 dB",
      Network: "RJ45 10/100 Mbps; ONVIF Profile S/T",
      Power: "12 VDC or IEEE 802.3af PoE",
      Protection: "IP67",
      Dimensions: "Ø112 × 82 mm",
    },
    highlights: ["4 MP 2560 × 1440", "120 dB WDR", "30 m IR", "PoE and IP67"],
    useCases: ["Retail entrances", "Office reception", "Indoor common areas", "Covered perimeters"],
    sellingPriceInclGstPaise: 336_000,
    officialSourceUrl: "https://www.pramaindia.in/product/pt-nc143d3-nd2/",
    warrantySummary: "Warranty details available on request",
    relatedProductIds: ["cp-unr-4k2161-v2", "netgear-gs108pp"],
    builderCompatibleIds: cameraBuilderIds,
    builderExclusions: cameraBuilderExclusions,
  }),
  exactProduct({
    model: "PT-NC140D3-N(D2)",
    brand: "Prama",
    category: "Bullet Cameras",
    title: "Prama PT-NC140D3-N(D2) 4 MP Fixed Bullet Network Camera",
    shortDescription:
      "A weather-resistant 4 MP bullet camera with 120 dB WDR, 30 m infrared illumination and PoE.",
    longDescription:
      "The PT-NC140D3-N(D2) is the bullet-format counterpart for directional perimeter and approach coverage. It supports 2560 × 1440 video, H.265 compression, ONVIF profiles S and T and human or vehicle event filtering. Its IP67 enclosure and PoE input simplify exterior installations, subject to correct mounting and surge protection.",
    images: ["/images/products/PT-NC140D3-ND2.png"],
    specs: {
      "Image sensor": "1/3 inch progressive scan CMOS",
      "Max resolution": "2560 × 1440",
      Lens: "2.8 mm or 4 mm fixed options",
      "IR range": "Up to 30 m",
      Compression: "H.265, H.264, MJPEG (sub-stream)",
      WDR: "120 dB",
      Network: "RJ45 10/100 Mbps; ONVIF Profile S/T",
      Power: "12 VDC or IEEE 802.3af PoE",
      Protection: "IP67",
      Dimensions: "185.8 × 66 × 69.1 mm",
    },
    highlights: ["4 MP 2560 × 1440", "120 dB WDR", "30 m IR", "PoE and IP67"],
    useCases: [
      "Building perimeters",
      "Parking approaches",
      "Warehouse aisles",
      "Commercial entrances",
    ],
    sellingPriceInclGstPaise: 336_000,
    officialSourceUrl: "https://www.pramaindia.in/product/pt-nc140d3-nd2/",
    warrantySummary: "Warranty details available on request",
    relatedProductIds: ["cp-unr-4k2161-v2", "netgear-gs108pp"],
    builderCompatibleIds: cameraBuilderIds,
    builderExclusions: cameraBuilderExclusions,
  }),
  exactProduct({
    model: "CP-UNC-TA61L3C-LQ",
    brand: "CP Plus",
    category: "Color Bullet Cameras",
    title: "CP Plus CP-UNC-TA61L3C-LQ 6 MP Dual-Light Bullet Network Camera",
    shortDescription:
      "A 6 MP dual-light bullet camera with 30 m IR and warm-light coverage, built-in audio, PoE and IP67 protection.",
    longDescription:
      "The CP-UNC-TA61L3C-LQ records up to 6 MP and combines infrared with adjustable warm light for colour-capable night monitoring. It includes a fixed 3.6 mm lens, built-in microphone, triple-stream video, ONVIF integration and intelligent human or vehicle motion classification. The IP67 housing and IEEE 802.3af PoE input suit correctly protected outdoor installations.",
    images: ["/images/products/CP-UNC-TA61L3C-LQ.png"],
    documents: [
      {
        type: "datasheet",
        title: "CP Plus datasheet",
        url: "/docs/datasheets/CP-UNC-TA61L3C-LQ.pdf",
      },
      { type: "manual", title: "User manual", url: "/docs/manuals/CP-UNC-TA61L3C-LQ-manual.pdf" },
    ],
    specs: {
      "Image sensor": "1/2.7 inch 6 MP progressive scan CMOS",
      "Max resolution": "3200 × 1800 at up to 20 fps",
      Lens: "3.6 mm fixed, F1.4",
      "Field of view": "91° horizontal, 46° vertical, 110° diagonal",
      "Night illumination": "30 m IR and 30 m warm light",
      Compression: "Instastream, H.265, H.264 and MJPEG",
      Audio: "Built-in microphone",
      Network: "RJ45 10/100 Base-T; ONVIF Profile S/G/T",
      Power: "12 VDC or IEEE 802.3af PoE",
      Protection: "IP67",
      Dimensions: "178.6 × 70 × 68.3 mm",
      Weight: "350 g",
    },
    highlights: ["6 MP resolution", "30 m dual light", "Built-in microphone", "PoE and IP67"],
    useCases: [
      "Colour-aware perimeter monitoring",
      "Parking areas",
      "Warehouse approaches",
      "Commercial entrances",
    ],
    sellingPriceInclGstPaise: 512_900,
    officialSourceUrl: "https://cpplusworld.com/cp-unc-ta61l3c-lq",
    warrantySummary: "Warranty details available on request",
    relatedProductIds: ["cp-unr-4k2161-v2", "netgear-gs108pp"],
    builderCompatibleIds: cameraBuilderIds,
    builderExclusions: cameraBuilderExclusions,
  }),
  exactProduct({
    model: "VEGA+W+POE",
    slug: "essl-vega-w-poe",
    brand: "eSSL",
    category: "Biometric Devices",
    title: "eSSL VEGA+W+POE Fingerprint Attendance and Access Terminal",
    shortDescription:
      "A Linux-based fingerprint, card and password terminal with built-in Wi-Fi and PoE connectivity.",
    longDescription:
      "VEGA+W+POE combines fingerprint, card and password authentication in a compact attendance and access-control terminal. It stores up to 3,000 users and 200,000 transactions, and supports TCP/IP, Wi-Fi, USB host and PoE installation. Door-lock wiring and software licensing should be confirmed for the intended deployment before purchase.",
    images: ["/images/products/ESSL-VEGA-W-POE.png"],
    documents: [
      { type: "datasheet", title: "eSSL catalogue", url: "/docs/datasheets/ESSL-VEGA-W-POE.pdf" },
      { type: "manual", title: "User manual", url: "/docs/manuals/ESSL-VEGA-W-POE-manual.pdf" },
    ],
    specs: {
      Authentication: "Fingerprint, card and password",
      "User capacity": "3,000",
      "Fingerprint capacity": "3,000",
      "Card capacity": "3,000",
      "Transaction capacity": "200,000",
      Display: "2.4 inch TFT colour LCD, 240 × 320",
      Platform: "Linux; dual-core 1.0 GHz CPU",
      Communication: "TCP/IP, Wi-Fi, USB host, PoE",
    },
    highlights: [
      "Wi-Fi and PoE",
      "3,000 fingerprint templates",
      "200,000 transactions",
      "Fingerprint, card and password",
    ],
    useCases: ["Office attendance", "Door access control", "Factories", "Education campuses"],
    sellingPriceInclGstPaise: 1_647_000,
    officialSourceUrl: "https://esslsecurity.com/fingerprint/vegawpoe",
    warrantySummary: "Warranty details available on request",
    relatedProductIds: ["essl-fr1200"],
  }),
  exactProduct({
    model: "MB160",
    brand: "eSSL",
    category: "Biometric Devices",
    title: "eSSL MB160 Multi-Biometric Face and Fingerprint Terminal",
    shortDescription:
      "A face, fingerprint, card and password attendance terminal with access-control interfaces and TCP/IP connectivity.",
    longDescription:
      "The MB160 is designed for time attendance and basic door access control using face, fingerprint, card or password verification. A 2.8-inch display, TCP/IP and USB-host connectivity support local deployments, while compatible software and optional functions must be scoped separately. It is intended for protected indoor installation.",
    images: ["/images/products/ESSL-MB160.png"],
    documents: [
      { type: "datasheet", title: "eSSL catalogue", url: "/docs/datasheets/ESSL-MB160.pdf" },
      { type: "manual", title: "User manual", url: "/docs/manuals/ESSL-MB160-manual.pdf" },
    ],
    specs: {
      Authentication: "Face, fingerprint, card and password",
      "Face capacity": "1,000",
      "Transaction capacity": "80,000",
      Display: "2.8 inch TFT",
      Communication: "TCP/IP and USB host",
      "Access-control interface": "Electric lock, door sensor, exit button and alarm",
      Power: "12 VDC, 1.5 A",
      Dimensions: "167.5 × 148.8 × 32.2 mm",
    },
    highlights: [
      "Face and fingerprint verification",
      "TCP/IP and USB host",
      "Door-control interfaces",
      "2.8 inch display",
    ],
    useCases: ["Office attendance", "Staff entrances", "Factories", "Small institutions"],
    sellingPriceInclGstPaise: 1_185_000,
    officialSourceUrl: "https://esslsecurity.com/face/mb160",
    warrantySummary: "Warranty details available on request",
    relatedProductIds: ["essl-fr1200"],
  }),
  exactProduct({
    model: "MB20",
    brand: "eSSL",
    category: "Biometric Devices",
    title: "eSSL MB20 Face and Fingerprint Attendance Terminal",
    shortDescription:
      "A compact face, fingerprint and card terminal for indoor time-attendance deployments.",
    longDescription:
      "The MB20 combines face, fingerprint and card records in a compact indoor terminal. It supports up to 1,000 users, 2,000 fingerprint templates, 500 faces and 50,000 transactions, with TCP/IP and USB-host communication. Confirm the exact software edition and any door-control requirement before deployment.",
    images: ["/images/products/ESSL-MB20.png"],
    documents: [
      { type: "datasheet", title: "eSSL catalogue", url: "/docs/datasheets/ESSL-MB20.pdf" },
      { type: "manual", title: "User manual", url: "/docs/manuals/ESSL-MB20-manual.pdf" },
    ],
    specs: {
      Authentication: "Face, fingerprint and card",
      "User capacity": "1,000",
      "Face capacity": "500",
      "Fingerprint capacity": "2,000",
      "Transaction capacity": "50,000",
      Display: "2.8 inch colour LCD",
      Communication: "TCP/IP and USB host",
    },
    highlights: [
      "Face and fingerprint verification",
      "Up to 2,000 fingerprints",
      "50,000 transactions",
      "Compact indoor format",
    ],
    useCases: ["Small-office attendance", "Schools", "Clinics", "Retail staff management"],
    sellingPriceInclGstPaise: 1_210_000,
    officialSourceUrl: "https://esslsecurity.com/face/mb20",
    warrantySummary: "Warranty details available on request",
  }),
  exactProduct({
    model: "AiFace Mercury",
    brand: "eSSL",
    category: "Biometric Devices",
    title: "eSSL AiFace Mercury Facial Attendance and Access Terminal",
    shortDescription:
      "A compact visible-light face terminal with Wi-Fi, TCP/IP and anti-spoofing protection.",
    longDescription:
      "AiFace Mercury is a compact indoor facial-recognition terminal for attendance and door access. Its 2.8-inch touch display, adjustable supplementary light and anti-spoofing algorithm support up to 800 faces and 150,000 transactions. It connects through TCP/IP or Wi-Fi and requires a compatible 12 VDC power supply and correctly specified door hardware.",
    images: ["/images/products/ESSL-AIFACE-MERCURY.png"],
    documents: [
      {
        type: "datasheet",
        title: "eSSL catalogue",
        url: "/docs/datasheets/ESSL-AIFACE-MERCURY.pdf",
      },
      { type: "manual", title: "User manual", url: "/docs/manuals/ESSL-AIFACE-MERCURY-manual.pdf" },
    ],
    specs: {
      Authentication: "Visible-light facial recognition",
      "Face capacity": "800",
      "User capacity": "800",
      "Transaction capacity": "150,000",
      Display: "2.8 inch touch screen",
      Camera: "2 MP WDR low-light camera",
      Communication: "TCP/IP and Wi-Fi",
      "Access-control interface": "Lock, door sensor, exit button and no-touch sensor",
      Power: "12 VDC, 2 A",
      Dimensions: "100 × 100.2 × 23.7 mm",
    },
    highlights: [
      "Visible-light recognition",
      "Anti-spoofing",
      "Wi-Fi and TCP/IP",
      "150,000 transactions",
    ],
    useCases: ["Touch-free attendance", "Office access", "Clinics", "Education facilities"],
    sellingPriceInclGstPaise: 1_245_000,
    officialSourceUrl: "https://esslsecurity.com/face/aiface-mercury",
    warrantySummary: "Warranty details available on request",
  }),
  exactProduct({
    model: "AiFace Neptune",
    brand: "eSSL",
    category: "Biometric Devices",
    title: "eSSL AiFace Neptune Facial Attendance and Access Terminal",
    shortDescription:
      "A 4.3-inch facial-recognition terminal with Wi-Fi, TCP/IP, card support and 150,000-transaction capacity.",
    longDescription:
      "AiFace Neptune is an indoor Linux-based terminal for face, optional card and password verification. It stores up to 500 faces, 1,000 users and 150,000 transactions, and communicates over TCP/IP, built-in Wi-Fi or USB host. A binocular camera supports anti-spoofing; compatible software and door hardware remain project-specific.",
    images: ["/images/products/ESSL-AIFACE-NEPTUNE.png"],
    documents: [
      {
        type: "datasheet",
        title: "eSSL catalogue",
        url: "/docs/datasheets/ESSL-AIFACE-NEPTUNE.pdf",
      },
      { type: "manual", title: "User manual", url: "/docs/manuals/ESSL-AIFACE-NEPTUNE-manual.pdf" },
    ],
    specs: {
      Authentication: "Face, card and password",
      "Face capacity": "500",
      "User capacity": "1,000",
      "Card capacity": "1,000",
      "Transaction capacity": "150,000",
      Display: "4.3 inch touch screen",
      Camera: "Binocular camera",
      Communication: "TCP/IP, built-in Wi-Fi and USB host",
      Platform: "Linux; dual-core 1 GHz CPU",
    },
    highlights: [
      "4.3 inch touch screen",
      "Built-in Wi-Fi",
      "Binocular face camera",
      "150,000 transactions",
    ],
    useCases: ["Office attendance", "Touch-free entry", "Factories", "Education campuses"],
    sellingPriceInclGstPaise: 1_585_000,
    officialSourceUrl: "https://esslsecurity.com/face/aiface-neptune",
    warrantySummary: "Warranty details available on request",
  }),
];
