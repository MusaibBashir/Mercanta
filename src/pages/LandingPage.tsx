import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";

/* ─────────────────────────────────────────────
   DESIGN TOKENS  (Apple SF-scale)
───────────────────────────────────────────── */
const C = {
  white:     "#ffffff",
  offwhite:  "#f5f5f7",
  black:     "#000000",
  dark:      "#1d1d1f",
  mid:       "#6e6e73",
  sep:       "#d2d2d7",
  sepDark:   "#424245",
  blue:      "#0071e3",
  orange:    "#ff6600",
  green:     "#25D366",
};

const F = {
  display:   "clamp(48px, 7vw, 96px)",
  headline:  "clamp(36px, 4.8vw, 64px)",
  title1:    "clamp(28px, 3.2vw, 48px)",
  title2:    "clamp(22px, 2.5vw, 32px)",
  callout:   "19px",
  body:      "17px",
  footnote:  "12px",
  ls:        "-0.015em",
  lsTitle:   "-0.009em",
};

const fontStack = `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif`;

/* ─────────────────────────────────────────────
   HOOKS
───────────────────────────────────────────── */
function useFadeIn(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVis(true); }, { threshold });
    obs.observe(el); return () => obs.disconnect();
  }, [threshold]);
  return { ref, vis };
}

function useIsMobile(bp = 768) {
  const [mobile, setMobile] = useState(() => window.innerWidth <= bp);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth <= bp);
    window.addEventListener("resize", fn, { passive: true });
    return () => window.removeEventListener("resize", fn);
  }, [bp]);
  return mobile;
}

/* ─────────────────────────────────────────────
   PRIMITIVES
───────────────────────────────────────────── */
function Reveal({ children, delay = 0, from = 32, className = "" }: {
  children: React.ReactNode; delay?: number; from?: number; className?: string;
}) {
  const { ref, vis } = useFadeIn();
  return (
    <div ref={ref} className={className} style={{
      opacity: vis ? 1 : 0,
      transform: vis ? "none" : `translateY(${from}px)`,
      transition: `opacity .8s cubic-bezier(.25,.46,.45,.94) ${delay}ms, transform .8s cubic-bezier(.25,.46,.45,.94) ${delay}ms`,
      willChange: "opacity, transform",
    }}>{children}</div>
  );
}

/* Apple-style CTA buttons */
function BtnPrimary({ to, href, children, color = C.blue }: { to?: string; href?: string; children: React.ReactNode; color?: string; }) {
  const style: React.CSSProperties = {
    display: "inline-block", background: color, color: "#fff",
    borderRadius: 980, padding: "10px 20px", fontSize: F.body,
    fontFamily: fontStack, fontWeight: 400, textDecoration: "none",
    whiteSpace: "nowrap", lineHeight: 1.4,
    transition: "opacity .15s",
  };
  if (to) return <Link to={to} style={style}>{children}</Link>;
  return <a href={href} style={style}>{children}</a>;
}

function BtnLink({ to, href, children, color = C.blue }: { to?: string; href?: string; children: React.ReactNode; color?: string }) {
  const style: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 4,
    color, fontSize: F.body, fontFamily: fontStack,
    textDecoration: "none", fontWeight: 400,
  };
  if (to) return <Link to={to} style={style}>{children} <span aria-hidden>›</span></Link>;
  return <a href={href} style={style}>{children} <span aria-hidden>›</span></a>;
}

/* Section separator */
function Sep({ dark = false }) {
  return <div style={{ borderTop: `1px solid ${dark ? C.sepDark : C.sep}`, margin: "0 22px" }} />;
}

/* Eyebrow label above headline */
function Eyebrow({ children, color = C.mid }: { children: React.ReactNode; color?: string }) {
  return (
    <p style={{ fontSize: F.callout, fontWeight: 600, color, fontFamily: fontStack, marginBottom: 8, letterSpacing: 0 }}>
      {children}
    </p>
  );
}

/* Full-bleed screenshot/video placeholder */
function ScreenPlaceholder({ label, dark = true, aspect = "16/9", height }: {
  label: string; dark?: boolean; aspect?: string; height?: number;
}) {
  return (
    <div style={{
      width: "100%", aspectRatio: aspect, height: height ? height : undefined,
      background: dark ? "#1c1c1e" : "#e8e8ed",
      border: `1px solid ${dark ? "#2c2c2e" : "#d1d1d6"}`,
      borderRadius: 12, overflow: "hidden",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10,
    }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="4" width="20" height="14" rx="2" stroke={dark ? "#636366" : "#8e8e93"} strokeWidth="1.5" />
        <path d="M8 19l4 3 4-3" stroke={dark ? "#636366" : "#8e8e93"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p style={{ fontSize: 13, color: dark ? "#636366" : "#8e8e93", fontFamily: fontStack, textAlign: "center", padding: "0 16px" }}>{label}</p>
    </div>
  );
}

/* ─────────────────────────────────────────────
   NAV
───────────────────────────────────────────── */
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const isMobile = useIsMobile();
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 1);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);
  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, height: 48,
      background: scrolled ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.72)",
      backdropFilter: "blur(20px) saturate(180%)",
      WebkitBackdropFilter: "blur(20px) saturate(180%)",
      borderBottom: `1px solid ${scrolled ? C.sep : "transparent"}`,
      transition: "border-color .3s",
    }}>
      <div style={{ maxWidth: 1068, margin: "0 auto", height: "100%", padding: "0 22px", display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: fontStack }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: C.dark, letterSpacing: "-0.01em" }}>Mercanta</span>
        {!isMobile && (
          <div style={{ display: "flex", gap: 28, alignItems: "center" }}>
            {[["#restaurant", "Restaurant"], ["#franchise", "Franchise"], ["#compare", "Compare"]].map(([href, label]) => (
              <a key={href} href={href} style={{ fontSize: 12, color: C.dark, textDecoration: "none", letterSpacing: "0.01em" }}>{label}</a>
            ))}
          </div>
        )}
        <Link to="/login" style={{
          fontSize: 13, fontWeight: 500, color: C.white,
          background: C.blue, borderRadius: 980, padding: "6px 14px",
          textDecoration: "none", letterSpacing: 0,
        }}>Sign in</Link>
      </div>
    </nav>
  );
}

/* ─────────────────────────────────────────────
   HERO SECTION
───────────────────────────────────────────── */
function Hero() {
  return (
    <section style={{ background: C.white, paddingTop: 48, paddingBottom: 0, textAlign: "center", fontFamily: fontStack }}>
      <div style={{ maxWidth: 1068, margin: "0 auto", padding: "80px 22px 0" }}>
        <Reveal>
          <p style={{ fontSize: F.callout, fontWeight: 600, color: C.mid, marginBottom: 12 }}>Introducing</p>
        </Reveal>
        <Reveal delay={60}>
          <h1 style={{ fontSize: F.display, fontWeight: 700, letterSpacing: F.ls, lineHeight: 1.05, color: C.dark, margin: "0 0 20px" }}>
            Hello, Mercanta.
          </h1>
        </Reveal>
        <Reveal delay={120}>
          <p style={{ fontSize: F.title2, fontWeight: 400, color: C.mid, letterSpacing: F.lsTitle, lineHeight: 1.4, maxWidth: 600, margin: "0 auto 32px" }}>
            Restaurant operations and franchise management,<br />fully connected.
          </p>
        </Reveal>
        <Reveal delay={180}>
          <div style={{ display: "flex", gap: 20, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
            <BtnPrimary to="/login">Get started</BtnPrimary>
            <BtnLink href="#highlights">Learn more</BtnLink>
          </div>
        </Reveal>
      </div>
      {/* Hero visual */}
      <Reveal delay={240} from={20} className="relative">
        <div style={{ marginTop: 56, overflow: "hidden", margin: "0 auto", maxWidth: 1200 }}>
          <img 
            src="images/hero_dashboard_screenshot.jpeg" 
            alt="Mercanta dashboard" 
            style={{ width: "100%", height: "auto", borderRadius: 12 }}
          />
        </div>
      </Reveal>
    </section>
  );
}

/* ─────────────────────────────────────────────
   MODULAR / MIX & MATCH SECTION
───────────────────────────────────────────── */
const ALL_MODULES = [
  "Menu Management", "Point of Sale", "Kitchen Display",
  "WhatsApp Ordering", "Token Tracker", "Customer Loyalty",
  "Franchise Dashboard", "Inventory Management", "Stock Orders",
  "Financial Reports", "Sales Forecasting", "Multi-Location",
];

const COMBOS = [
  {
    name: "Just the counter",
    desc: "Fast, simple order-taking without the extras.",
    accent: C.orange,
    modules: ["Menu Management", "Point of Sale", "Token Tracker"],
  },
  {
    name: "Restaurant, fully connected",
    desc: "The complete kitchen — from menu to customer notification.",
    accent: C.orange,
    modules: ["Menu Management", "Point of Sale", "Kitchen Display", "WhatsApp Ordering", "Token Tracker", "Customer Loyalty"],
  },
  {
    name: "Franchise operations",
    desc: "Central oversight across every location.",
    accent: C.blue,
    modules: ["Franchise Dashboard", "Inventory Management", "Stock Orders", "Financial Reports"],
  },
  {
    name: "Admin + franchise + restaurant",
    desc: "The full platform — every tool, every role.",
    accent: C.dark,
    modules: ["Menu Management", "Point of Sale", "Kitchen Display", "WhatsApp Ordering", "Franchise Dashboard", "Inventory Management", "Stock Orders", "Financial Reports", "Sales Forecasting"],
  },
];

function ModularSection() {
  const [hoveredCombo, setHoveredCombo] = useState<number | null>(null);
  const activeMods = hoveredCombo !== null ? new Set(COMBOS[hoveredCombo].modules) : new Set<string>();

  return (
    <section style={{ background: C.white, padding: "100px 22px", fontFamily: fontStack }}>
      <div style={{ maxWidth: 1068, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ maxWidth: 640, margin: "0 auto 64px", textAlign: "center" }}>
          <Reveal>
            <p style={{ fontSize: F.callout, fontWeight: 600, color: C.mid, marginBottom: 8 }}>Flexible by design</p>
          </Reveal>
          <Reveal delay={60}>
            <h2 style={{ fontSize: F.headline, fontWeight: 700, letterSpacing: F.ls, lineHeight: 1.07, color: C.dark, margin: "0 0 20px" }}>
              Take only what you need.
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <p style={{ fontSize: F.body, color: C.mid, lineHeight: 1.65, margin: 0 }}>
              Every feature is independent. Start with just a point of sale, add the kitchen display later, bolt on WhatsApp ordering when you're ready — or run the whole platform from day one. Your business, your setup.
            </p>
          </Reveal>
        </div>

        {/* Module pill cloud */}
        <Reveal delay={80}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginBottom: 56 }}>
            {ALL_MODULES.map((mod) => {
              const highlighted = activeMods.size > 0 && activeMods.has(mod);
              const dimmed = activeMods.size > 0 && !activeMods.has(mod);
              const comboAccent = hoveredCombo !== null ? COMBOS[hoveredCombo].accent : C.mid;
              return (
                <div key={mod} style={{
                  padding: "8px 16px", borderRadius: 980,
                  fontSize: 14, fontWeight: highlighted ? 600 : 400,
                  fontFamily: fontStack,
                  background: highlighted ? comboAccent : "transparent",
                  color: highlighted ? "#fff" : dimmed ? "#c7c7cc" : C.dark,
                  border: `1.5px solid ${highlighted ? comboAccent : dimmed ? "#e5e5ea" : C.sep}`,
                  transition: "all .25s cubic-bezier(.25,.46,.45,.94)",
                  whiteSpace: "nowrap",
                }}>
                  {mod}
                </div>
              );
            })}
          </div>
        </Reveal>

        {/* Combo cards */}
        <ComboCardsGrid hoveredCombo={hoveredCombo} setHoveredCombo={setHoveredCombo} />

        <Reveal delay={200}>
          <p style={{ textAlign: "center", marginTop: 36, fontSize: F.body, color: C.mid }}>
            Hover any card to see which modules it uses.{" "}
            <a href="/login" style={{ color: C.blue, textDecoration: "none" }}>Talk to us about your setup ›</a>
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function ComboCardsGrid({ hoveredCombo, setHoveredCombo }: { hoveredCombo: number | null; setHoveredCombo: (i: number | null) => void }) {
  const isMobile = useIsMobile();
  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
      {COMBOS.map((combo, i) => (
        <Reveal key={i} delay={i * 60}>
          <div
            onMouseEnter={() => setHoveredCombo(i)}
            onMouseLeave={() => setHoveredCombo(null)}
            style={{
              padding: "28px 28px",
              borderRadius: 18,
              border: `1.5px solid ${hoveredCombo === i ? combo.accent : C.sep}`,
              background: hoveredCombo === i ? (combo.accent === C.orange ? "#fff7f0" : combo.accent === C.blue ? "#f0f4ff" : "#f8f8f8") : C.white,
              cursor: "default",
              transition: "all .25s cubic-bezier(.25,.46,.45,.94)",
            }}
          >
            <p style={{ fontSize: 13, fontWeight: 600, color: combo.accent, marginBottom: 6, letterSpacing: "0.03em", textTransform: "uppercase" }}>
              Example
            </p>
            <h4 style={{ fontSize: 20, fontWeight: 700, letterSpacing: F.lsTitle, color: C.dark, margin: "0 0 6px" }}>{combo.name}</h4>
            <p style={{ fontSize: 14, color: C.mid, margin: "0 0 16px", lineHeight: 1.5 }}>{combo.desc}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {combo.modules.map((m) => (
                <span key={m} style={{
                  fontSize: 12, padding: "3px 10px", borderRadius: 980,
                  background: hoveredCombo === i ? combo.accent : C.offwhite,
                  color: hoveredCombo === i ? "#fff" : C.mid,
                  border: `1px solid ${hoveredCombo === i ? combo.accent : C.sep}`,
                  transition: "all .25s",
                }}>{m}</span>
              ))}
            </div>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
   TWO PRODUCTS SECTION
───────────────────────────────────────────── */
function TwoProducts() {
  const isMobile = useIsMobile();
  return (
    <section style={{ background: C.offwhite, padding: isMobile ? "60px 16px" : "80px 22px", fontFamily: fontStack }}>
      <div style={{ maxWidth: 1068, margin: "0 auto" }}>
        <Reveal>
          <p style={{ fontSize: F.callout, fontWeight: 600, color: C.mid, textAlign: "center", marginBottom: 8 }}>Two solutions. One platform.</p>
        </Reveal>
        <Reveal delay={60}>
          <h2 style={{ fontSize: F.headline, fontWeight: 700, letterSpacing: F.ls, lineHeight: 1.07, color: C.dark, textAlign: "center", margin: "0 0 64px" }}>
            Built for every kind of business.
          </h2>
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20 }}>
          {/* Restaurant card */}
          <Reveal delay={0}>
            <div style={{ background: C.white, borderRadius: 20, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ background: "#fff7f0", padding: isMobile ? "32px 24px 24px" : "48px 40px 32px", flex: 1 }}>
                <img 
                  src="images/restaurant_dashboard_screenshot.jpeg" 
                  alt="Restaurant dashboard" 
                  style={{ width: "100%", height: "auto", borderRadius: 12 }}
                />
              </div>
              <div style={{ padding: isMobile ? "24px 24px 28px" : "36px 40px 40px" }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.orange, marginBottom: 8, letterSpacing: "0.04em", textTransform: "uppercase" }}>Restaurant Suite</p>
                <h3 style={{ fontSize: F.title1, fontWeight: 700, letterSpacing: F.lsTitle, lineHeight: 1.1, color: C.dark, margin: "0 0 12px" }}>
                  The complete kitchen system.
                </h3>
                <p style={{ fontSize: F.body, color: C.mid, lineHeight: 1.6, margin: "0 0 28px" }}>
                  Menu management, point of sale, live kitchen display, and WhatsApp ordering — built to run together seamlessly.
                </p>
                <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
                  <BtnPrimary to="/login" color={C.orange}>Get started</BtnPrimary>
                  <BtnLink href="#restaurant" color={C.orange}>Learn more</BtnLink>
                </div>
              </div>
            </div>
          </Reveal>
          {/* Franchise card */}
          <Reveal delay={isMobile ? 0 : 80}>
            <div style={{ background: C.white, borderRadius: 20, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ background: "#f0f4ff", padding: isMobile ? "32px 24px 24px" : "48px 40px 32px", flex: 1 }}>
                <img 
                  src="images/Franchise_dashboard_screenshot.jpeg" 
                  alt="Mercanta dashboard" 
                  style={{ width: "100%", height: "auto", borderRadius: 12 }}
                />
              </div>
              <div style={{ padding: isMobile ? "24px 24px 28px" : "36px 40px 40px" }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.blue, marginBottom: 8, letterSpacing: "0.04em", textTransform: "uppercase" }}>Franchise Manager</p>
                <h3 style={{ fontSize: F.title1, fontWeight: 700, letterSpacing: F.lsTitle, lineHeight: 1.1, color: C.dark, margin: "0 0 12px" }}>
                  Command every location.
                </h3>
                <p style={{ fontSize: F.body, color: C.mid, lineHeight: 1.6, margin: "0 0 28px" }}>
                  Multi-location oversight, inventory tracking, stock ordering, and financial reporting — all in one place.
                </p>
                <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
                  <BtnPrimary to="/login" color={C.blue}>Get started</BtnPrimary>
                  <BtnLink href="#franchise" color={C.blue}>Learn more</BtnLink>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   GET THE HIGHLIGHTS  (split by product)
───────────────────────────────────────────── */
const RESTAURANT_TABS = [
  {
    label: "Menu",
    headline: "Your menu, live on every screen.",
    body: "Add dishes, set prices, toggle availability. The moment you make a change, it's reflected everywhere — at the counter, in the kitchen, and on WhatsApp.",
    image: "/images/menu_management_screenshot.jpeg",
    dark: false,
  },
  {
    label: "Point of Sale",
    headline: "Take orders in seconds.",
    body: "Staff tap items, add special notes, look up returning customers by phone, and complete payments with cash, UPI, or card — all from a single screen.",
    image: "/images/point_of_sale_screenshot.jpeg",
    dark: false,
  },
  {
    label: "Kitchen Display",
    headline: "No paper. No shouting.",
    body: "Every order appears on the kitchen screen the instant it's placed. One tap moves it from Ordered to Preparing to Ready — live across every device.",
    image: "/images/kitchen_display_screenshot.jpeg",
    dark: true,
  },
  {
    label: "WhatsApp Ordering",
    headline: "Order placed. Kitchen notified. Customer updated.",
    body: "Customers text your WhatsApp number, get the live menu, pay via the link, and receive an automatic message when their order is ready.",
    image: "/images/whatsapp_ordering_screenshot.png",
    dark: true,
  },
];

const FRANCHISE_TABS = [
  {
    label: "Overview",
    headline: "See everything from one seat.",
    body: "Your admin dashboard shows live sales, activity, and inventory alerts across every franchise location — in real time, without switching accounts.",
    image: "/images/Admin_multilocation.jpg",
    dark: false,
  },
  {
    label: "Inventory",
    headline: "Stocked. Tracked. Ordered.",
    body: "Franchise locations submit stock orders in-app. You approve, dispatch, and track from the central admin — with a full audit history of every request.",
    image: "/images/inventory_managemtn.jpg",
    dark: false,
  },
  {
    label: "Stock Orders",
    headline: "Requests approved with a tap.",
    body: "When a location runs low, they submit a stock request. You review and approve from the admin panel — no emails, no calls, no back-and-forth.",
    image: "/images/stock_orders.jpg",
    dark: false,
  },
  {
    label: "Reports",
    headline: "Numbers that tell the story.",
    body: "Sales trends, revenue breakdowns, year-over-year growth, and regional performance — visualised clearly so you can make decisions fast.",
    image: "/images/Financial_reports.jpg",
    dark: false,
  },
];

function Highlights() {
  const [product, setProduct] = useState<"restaurant" | "franchise">("restaurant");
  const [activeTab, setActiveTab] = useState(0);

  const isRestaurant = product === "restaurant";
  const tabs = isRestaurant ? RESTAURANT_TABS : FRANCHISE_TABS;
  const accent = isRestaurant ? C.orange : C.blue;
  const h = tabs[activeTab] ?? tabs[0];

  function switchProduct(p: "restaurant" | "franchise") {
    setProduct(p);
    setActiveTab(0);
  }

  return (
    <section id="highlights" style={{ background: C.white, paddingBottom: 80, fontFamily: fontStack }}>
      {/* Header + segmented control */}
      <div style={{ maxWidth: 1068, margin: "0 auto", padding: "80px 22px 48px", textAlign: "center" }}>
        <Reveal>
          <p style={{ fontSize: F.callout, fontWeight: 600, color: C.mid, marginBottom: 8 }}>Overview</p>
        </Reveal>
        <Reveal delay={60}>
          <h2 style={{ fontSize: F.headline, fontWeight: 700, letterSpacing: F.ls, lineHeight: 1.07, color: C.dark, margin: "0 0 40px" }}>
            Get the highlights.
          </h2>
        </Reveal>
        {/* Segmented control */}
        <Reveal delay={120}>
          <div style={{ display: "inline-flex", background: C.offwhite, borderRadius: 12, padding: 4, gap: 2 }}>
            {(["restaurant", "franchise"] as const).map((p) => {
              const active = product === p;
              const col = p === "restaurant" ? C.orange : C.blue;
              return (
                <button key={p} onClick={() => switchProduct(p)} style={{
                  background: active ? C.white : "transparent",
                  border: "none", cursor: "pointer",
                  padding: "8px 22px", borderRadius: 9,
                  fontSize: 14, fontWeight: active ? 600 : 400,
                  color: active ? col : C.mid,
                  fontFamily: fontStack,
                  boxShadow: active ? "0 1px 4px rgba(0,0,0,0.12)" : "none",
                  transition: "all .2s cubic-bezier(.25,.46,.45,.94)",
                }}>
                  {p === "restaurant" ? "Restaurant Suite" : "Franchise Manager"}
                </button>
              );
            })}
          </div>
        </Reveal>
      </div>

      {/* Sticky tab bar */}
      <div style={{
        position: "sticky", top: 48, zIndex: 50,
        background: "rgba(255,255,255,0.85)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderBottom: `1px solid ${C.sep}`, borderTop: `1px solid ${C.sep}`,
      }}>
        <div style={{ maxWidth: 1068, margin: "0 auto", padding: "0 22px", display: "flex", overflowX: "auto" }}>
          {tabs.map((t, i) => (
            <button key={`${product}-${i}`} onClick={() => setActiveTab(i)} style={{
              background: "none", border: "none", cursor: "pointer", padding: "14px 22px",
              fontSize: 13, fontWeight: activeTab === i ? 600 : 400,
              color: activeTab === i ? C.dark : C.mid, fontFamily: fontStack,
              borderBottom: activeTab === i ? `2px solid ${accent}` : "2px solid transparent",
              whiteSpace: "nowrap", transition: "color .2s, border-color .2s",
            }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ maxWidth: 1068, margin: "0 auto", padding: "64px 22px 0" }}>
        <div key={`${product}-${activeTab}`} style={{ animation: "fadeUp .45s cubic-bezier(.25,.46,.45,.94) both" }}>
          <div style={{ borderRadius: 20, overflow: "hidden", marginBottom: 40 }}>
            {h.image ? (
              <img 
                src={h.image} 
                alt={h.label}
                style={{ width: "100%", height: "auto", display: "block", borderRadius: 12 }}
              />
            ) : (
              <ScreenPlaceholder label={h.placeholder || "Feature screenshot"} dark={h.dark} aspect="16/7" />
            )}
          </div>
          <div style={{ textAlign: "center", maxWidth: 680, margin: "0 auto" }}>
            <div style={{ display: "inline-block", padding: "3px 12px", borderRadius: 980, background: isRestaurant ? "#fff4ee" : "#eff4ff", marginBottom: 14 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: accent, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                {isRestaurant ? "Restaurant Suite" : "Franchise Manager"}
              </span>
            </div>
            <h3 style={{ fontSize: F.title1, fontWeight: 700, letterSpacing: F.lsTitle, lineHeight: 1.1, color: C.dark, margin: "0 0 16px" }}>
              {h.headline}
            </h3>
            <p style={{ fontSize: F.body, color: C.mid, lineHeight: 1.65, margin: 0 }}>{h.body}</p>
          </div>
        </div>
      </div>

      <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:none; } }`}</style>
    </section>
  );
}

/* ─────────────────────────────────────────────
   FULL-BLEED FEATURE  (dark cinematic section)
───────────────────────────────────────────── */
function FullBleedDark({ eyebrow, headline, sub, placeholder, image, accentColor = C.orange }: {
  eyebrow: string; headline: string; sub: string; placeholder?: string; image?: string; accentColor?: string;
}) {
  return (
    <section style={{ background: C.black, padding: "100px 0 0", fontFamily: fontStack, overflow: "hidden" }}>
      <div style={{ maxWidth: 1068, margin: "0 auto", padding: "0 22px 60px", textAlign: "center" }}>
        <Reveal>
          <p style={{ fontSize: F.callout, fontWeight: 600, color: accentColor, marginBottom: 8 }}>{eyebrow}</p>
        </Reveal>
        <Reveal delay={60}>
          <h2 style={{ fontSize: F.headline, fontWeight: 700, letterSpacing: F.ls, lineHeight: 1.07, color: "#f5f5f7", margin: "0 0 20px" }}>
            {headline}
          </h2>
        </Reveal>
        <Reveal delay={120}>
          <p style={{ fontSize: F.title2, fontWeight: 400, color: "rgba(245,245,247,0.6)", lineHeight: 1.5, maxWidth: 600, margin: "0 auto" }}>
            {sub}
          </p>
        </Reveal>
      </div>
      <Reveal delay={180} from={24}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {image ? (
            <img 
              src={image} 
              alt={headline}
              style={{ width: "100%", height: "auto", display: "block", borderRadius: 12 }}
            />
          ) : (
            <ScreenPlaceholder label={placeholder || "Feature screenshot"} dark aspect="21/9" />
          )}
        </div>
      </Reveal>
    </section>
  );
}

/* ─────────────────────────────────────────────
   SPLIT FEATURE  (image + text, alternating)
───────────────────────────────────────────── */
function SplitFeature({ eyebrow, headline, body, bullets, placeholder, image, reverse = false, bg = C.white, accentColor = C.orange }: {
  eyebrow: string; headline: string; body: string; bullets: string[];
  placeholder?: string; image?: string; reverse?: boolean; bg?: string; accentColor?: string;
}) {
  const isMobile = useIsMobile();
  return (
    <section style={{ background: bg, padding: isMobile ? "60px 16px" : "100px 22px", fontFamily: fontStack }}>
      <div style={{
        maxWidth: 1068, margin: "0 auto",
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
        gap: isMobile ? 32 : 72,
        alignItems: "center",
        direction: (!isMobile && reverse) ? "rtl" : "ltr",
      }}>
        <div style={{ direction: "ltr" }}>
          <Reveal>
            {image ? (
              <img 
                src={image} 
                alt={headline}
                style={{ width: "100%", height: "auto", display: "block", borderRadius: 12 }}
              />
            ) : (
              <ScreenPlaceholder label={placeholder || "Feature screenshot"} dark={bg === C.black} />
            )}
          </Reveal>
        </div>
        <div style={{ direction: "ltr" }}>
          <Reveal delay={80}>
            <Eyebrow color={accentColor}>{eyebrow}</Eyebrow>
          </Reveal>
          <Reveal delay={140}>
            <h2 style={{ fontSize: F.title1, fontWeight: 700, letterSpacing: F.lsTitle, lineHeight: 1.1, color: bg === C.black ? "#f5f5f7" : C.dark, margin: "0 0 16px" }}>
              {headline}
            </h2>
          </Reveal>
          <Reveal delay={200}>
            <p style={{ fontSize: F.body, color: bg === C.black ? "rgba(245,245,247,0.65)" : C.mid, lineHeight: 1.65, margin: "0 0 28px" }}>
              {body}
            </p>
          </Reveal>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {bullets.map((b, i) => (
              <Reveal key={i} delay={260 + i * 60}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                    <circle cx="9" cy="9" r="9" fill={accentColor} opacity={0.12} />
                    <path d="M5 9l3 3 5-5" stroke={accentColor} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <p style={{ fontSize: 15, color: bg === C.black ? "rgba(245,245,247,0.7)" : C.mid, lineHeight: 1.5, margin: 0 }}>{b}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   IPHONE WHATSAPP MOCKUP
───────────────────────────────────────────── */
const WA_MSGS = [
  { me: false, text: "👋 Hi! Text menu to see today's full menu.", time: "9:38" },
  { me: true,  text: "menu", time: "9:39", ticks: 2 },
  { me: false, text: "🍽 Today's Menu\n\nPaneer Tikka — ₹280\nButter Chicken — ₹320\nGarlic Naan — ₹60\nGulab Jamun — ₹80\n\nReply: buy [item] [qty]", time: "9:39" },
  { me: true,  text: "buy Paneer Tikka 2", time: "9:41", ticks: 2 },
  { me: false, text: "✅ Order received!\n\nPaneer Tikka × 2 — ₹560\n\nPay securely here:\npay.razorpay.com/mercanta-t012", time: "9:41" },
  { me: false, text: "🎉 Your order T012 is ready for pickup!", time: "9:58" },
];

function DoubleTick({ n }: { n: number }) {
  return (
    <svg width="14" height="10" viewBox="0 0 14 10" fill="none" style={{ display: "inline-block", verticalAlign: "middle", marginLeft: 3 }}>
      {n >= 1 && <path d="M1 5l3 3 5-5" stroke="#a8d5b5" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />}
      {n === 2 && <path d="M5 5l3 3 5-5" stroke="#a8d5b5" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

function IPhoneWhatsApp() {
  /* WA dark-mode palette */
  const phone  = { bg: "#1b1b1b", border: "#3a3a3c" };
  const waChat = "#0b141a";
  const waIn   = "#202c33";   /* incoming bubble */
  const waOut  = "#005c4b";   /* outgoing bubble */
  const waText = "#e9edef";
  const waTime = "#8696a0";

  return (
    <div style={{
      width: 300,
      borderRadius: 50,
      border: `10px solid ${phone.border}`,
      background: phone.bg,
      boxShadow: "0 40px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04), inset 0 0 0 1px rgba(255,255,255,0.06)",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      position: "relative",
    }}>
      {/* ── Status bar ── */}
      <div style={{ background: waChat, padding: "10px 20px 4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: waText, letterSpacing: 0.2 }}>9:41</span>
        {/* Dynamic island */}
        <div style={{ width: 72, height: 20, borderRadius: 10, background: "#000", position: "absolute", left: "50%", transform: "translateX(-50%)", top: 10 }} />
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          {/* Signal */}
          <svg width="16" height="11" viewBox="0 0 16 11" fill={waText}>
            <rect x="0" y="6" width="3" height="5" rx="0.5" opacity="1" />
            <rect x="4.5" y="4" width="3" height="7" rx="0.5" opacity="1" />
            <rect x="9" y="2" width="3" height="9" rx="0.5" opacity="1" />
            <rect x="13.5" y="0" width="2.5" height="11" rx="0.5" opacity="0.35" />
          </svg>
          {/* WiFi */}
          <svg width="14" height="11" viewBox="0 0 14 11" fill="none">
            <path d="M7 9.5a1 1 0 110-2 1 1 0 010 2z" fill={waText} />
            <path d="M4.2 7.1A3.9 3.9 0 017 5.9a3.9 3.9 0 012.8 1.2" stroke={waText} strokeWidth="1.2" strokeLinecap="round" fill="none"/>
            <path d="M1.5 4.5A7 7 0 017 2.5a7 7 0 015.5 2" stroke={waText} strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.5"/>
          </svg>
          {/* Battery */}
          <div style={{ display: "flex", alignItems: "center", gap: 1 }}>
            <div style={{ width: 22, height: 11, borderRadius: 3, border: `1.5px solid ${waText}`, padding: 1.5, display: "flex" }}>
              <div style={{ flex: 1, background: waText, borderRadius: 1.5 }} />
            </div>
            <div style={{ width: 2, height: 5, background: waText, borderRadius: "0 1px 1px 0", opacity: 0.4 }} />
          </div>
        </div>
      </div>

      {/* ── WA Header bar ── */}
      <div style={{
        background: "#1f2c34",
        padding: "8px 14px",
        display: "flex", alignItems: "center", gap: 10,
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}>
        {/* Back arrow */}
        <svg width="10" height="17" viewBox="0 0 10 17" fill="none">
          <path d="M9 1L1.5 8.5 9 16" stroke={C.green} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {/* Avatar */}
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #25D366, #128C7E)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ color: "white", fontWeight: 800, fontSize: 15, letterSpacing: "-0.5px" }}>M</span>
        </div>
        {/* Name + status */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: waText, lineHeight: 1.2 }}>Mercanta Orders</p>
          <p style={{ margin: 0, fontSize: 10, color: C.green, lineHeight: 1.3 }}>online</p>
        </div>
        {/* Icons */}
        <div style={{ display: "flex", gap: 14 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={waText} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity={0.7}>
            <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
          </svg>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={waText} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity={0.7}>
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.87 19.75 19.75 0 01.06 1.24 2 2 0 012 .06h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14.92z"/>
          </svg>
        </div>
      </div>

      {/* ── Chat area ── */}
      <div style={{ background: waChat, padding: "10px 10px 8px", display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        {/* Date stamp */}
        <div style={{ textAlign: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 10, color: waTime, background: "rgba(17,27,33,0.6)", padding: "2px 8px", borderRadius: 5 }}>TODAY</span>
        </div>

        {WA_MSGS.map((msg, i) => {
          const isMe = msg.me;
          const lines = msg.text.split("\n");
          return (
            <div key={i} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", marginBottom: 2 }}>
              <div style={{
                background: isMe ? waOut : waIn,
                borderRadius: isMe ? "10px 10px 2px 10px" : "10px 10px 10px 2px",
                padding: "6px 10px 4px",
                maxWidth: "82%",
                boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
                position: "relative",
              }}>
                {lines.map((line, li) => (
                  <p key={li} style={{ margin: li < lines.length - 1 ? "0 0 2px" : 0, fontSize: 11.5, color: waText, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>{line}</p>
                ))}
                <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 2, marginTop: 3 }}>
                  <span style={{ fontSize: 9.5, color: waTime }}>{msg.time}</span>
                  {isMe && <DoubleTick n={msg.ticks ?? 0} />}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Input bar ── */}
      <div style={{
        background: "#1f2c34",
        padding: "8px 10px",
        display: "flex", alignItems: "center", gap: 8,
        borderTop: "1px solid rgba(255,255,255,0.05)",
      }}>
        {/* Attachment */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={waTime} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
        {/* Input pill */}
        <div style={{ flex: 1, background: "#2a3942", borderRadius: 20, padding: "7px 12px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: waTime, flex: 1 }}>Message</span>
          {/* Emoji */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={waTime} strokeWidth="1.6">
            <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
          </svg>
        </div>
        {/* Mic */}
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: C.green, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="14" height="18" viewBox="0 0 14 18" fill="none">
            <rect x="4" y="1" width="6" height="10" rx="3" fill="white"/>
            <path d="M1 8c0 3.3 2.7 6 6 6s6-2.7 6-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
            <line x1="7" y1="14" x2="7" y2="17" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
      </div>

      {/* Home indicator */}
      <div style={{ background: waChat, paddingBottom: 8, display: "flex", justifyContent: "center", paddingTop: 4 }}>
        <div style={{ width: 80, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.2)" }} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   WHATSAPP SECTION  (cinematic, dark)
───────────────────────────────────────────── */
function WhatsAppSection() {
  const isMobile = useIsMobile();
  const steps = [
    { n: "01", title: 'Customer texts "menu"', desc: 'Your customer messages your WhatsApp number. Within seconds they get your full live menu pulled directly from Mercanta.' },
    { n: "02", title: "They order and pay", desc: 'They reply "buy Paneer Tikka 2". The system generates a Razorpay payment link and sends it back instantly — no staff involvement.' },
    { n: "03", title: "Kitchen token auto-created", desc: "The moment payment is confirmed, the sale is recorded and a token is sent to the kitchen. Everything happens automatically." },
    { n: "04", title: "Customer gets a pickup alert", desc: 'When the kitchen marks the order ready, your customer receives a WhatsApp message: "Your order T012 is ready for pickup!"' },
  ];
  return (
    <section style={{ background: C.black, padding: "100px 22px", fontFamily: fontStack }}>
      <div style={{ maxWidth: 1068, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 80 }}>
          <Reveal>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.2)", borderRadius: 980, padding: "6px 16px", marginBottom: 20 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill={C.green}>
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>WhatsApp Automation</span>
            </div>
          </Reveal>
          <Reveal delay={60}>
            <h2 style={{ fontSize: F.headline, fontWeight: 700, letterSpacing: F.ls, lineHeight: 1.07, color: "#f5f5f7", margin: "0 0 20px" }}>
              From message to kitchen.<br />Automatically.
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <p style={{ fontSize: F.title2, fontWeight: 400, color: "rgba(245,245,247,0.55)", lineHeight: 1.5, maxWidth: 520, margin: "0 auto" }}>
              No app. No website. Customers order on WhatsApp — the app they already have open all day.
            </p>
          </Reveal>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 48 : 80, alignItems: "center" }}>
          {/* Phone visual */}
          <Reveal>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <IPhoneWhatsApp />
            </div>
          </Reveal>

          {/* Steps */}
          <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
            {steps.map((s, i) => (
              <Reveal key={i} delay={i * 80}>
                <div style={{ display: "flex", gap: 20 }}>
                  <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: "50%", border: `1.5px solid ${C.green}`, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.green }}>{s.n}</span>
                  </div>
                  <div>
                    <h4 style={{ fontSize: 19, fontWeight: 600, color: "#f5f5f7", margin: "0 0 6px" }}>{s.title}</h4>
                    <p style={{ fontSize: 15, color: "rgba(245,245,247,0.55)", lineHeight: 1.6, margin: 0 }}>{s.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   STAT BAR
───────────────────────────────────────────── */
function StatBar({ dark = false, stats }: { dark?: boolean; stats: { num: string; label: string }[] }) {
  const isMobile = useIsMobile();
  const bg = dark ? C.black : C.offwhite;
  const textColor = dark ? "#f5f5f7" : C.dark;
  const subColor = dark ? "rgba(245,245,247,0.5)" : C.mid;
  const borderColor = dark ? C.sepDark : C.sep;
  return (
    <section style={{ background: bg, borderTop: `1px solid ${borderColor}`, borderBottom: `1px solid ${borderColor}`, fontFamily: fontStack }}>
      <div style={{
        maxWidth: 1068, margin: "0 auto", padding: "48px 22px",
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : `repeat(${stats.length}, 1fr)`,
        gap: isMobile ? 28 : 0,
      }}>
        {stats.map((s, i) => (
          <div key={i} style={{
            textAlign: "center", padding: isMobile ? "0" : "0 20px",
            borderRight: (!isMobile && i < stats.length - 1) ? `1px solid ${borderColor}` : "none",
            borderBottom: (isMobile && i < stats.length - 1) ? `1px solid ${borderColor}` : "none",
            paddingBottom: (isMobile && i < stats.length - 1) ? 28 : undefined,
          }}>
            <Reveal delay={i * 60}>
              <p style={{ fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 700, letterSpacing: F.ls, color: textColor, margin: "0 0 6px", lineHeight: 1 }}>{s.num}</p>
              <p style={{ fontSize: 14, color: subColor, margin: 0 }}>{s.label}</p>
            </Reveal>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   COMPARE CARDS  ("Keep Exploring" analog)
───────────────────────────────────────────── */
function CompareCards() {
  // isMobile used below (after cards array)
  const cards = [
    {
      badge: "Restaurant Suite",
      accentColor: C.orange,
      headline: "The complete kitchen system.",
      tagline: "For individual restaurants ready to modernise operations.",
      features: [
        { label: "Live menu management" },
        { label: "Kitchen Display System" },
        { label: "Point of sale with Razorpay" },
        { label: "WhatsApp ordering & notifications" },
        { label: "Token tracker for pickups" },
        { label: "Customer loyalty lookup" },
      ],
      cta: "Get started",
      ctaLink: "/login",
    },
    {
      badge: "Franchise Manager",
      accentColor: C.blue,
      headline: "Command every location.",
      tagline: "For franchise operators managing multiple outlets.",
      features: [
        { label: "Multi-location dashboard" },
        { label: "Central inventory management" },
        { label: "Stock order approvals" },
        { label: "Financial reports & analytics" },
        { label: "Franchise account management" },
        { label: "Year-on-year growth tracking" },
      ],
      cta: "Get started",
      ctaLink: "/login",
    },
  ];
  const isMobile = useIsMobile();
  return (
    <section id="compare" style={{ background: C.offwhite, padding: isMobile ? "60px 16px" : "100px 22px", fontFamily: fontStack }}>
      <div style={{ maxWidth: 1068, margin: "0 auto" }}>
        <Reveal>
          <p style={{ fontSize: F.callout, fontWeight: 600, color: C.mid, textAlign: "center", marginBottom: 8 }}>Find your fit</p>
        </Reveal>
        <Reveal delay={60}>
          <h2 style={{ fontSize: F.headline, fontWeight: 700, letterSpacing: F.ls, lineHeight: 1.07, color: C.dark, textAlign: "center", margin: "0 0 64px" }}>
            Which is right for you?
          </h2>
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20, marginBottom: 24 }}>
          {cards.map((card, i) => (
            <Reveal key={i} delay={i * 80}>
              <div style={{ background: C.white, borderRadius: 20, padding: isMobile ? "24px" : "40px", display: "flex", flexDirection: "column", gap: 0 }}>
                {/* Visual */}
                <div style={{ background: i === 0 ? "#fff7f0" : "#f0f4ff", borderRadius: 12, padding: isMobile ? 16 : 24, marginBottom: 24 }}>
                  <ScreenPlaceholder label={`${card.badge} — screenshot`} dark={false} aspect="4/3" />
                </div>
                {/* Label */}
                <p style={{ fontSize: 13, fontWeight: 600, color: card.accentColor, marginBottom: 8, letterSpacing: "0.04em", textTransform: "uppercase" }}>{card.badge}</p>
                <h3 style={{ fontSize: 28, fontWeight: 700, letterSpacing: F.lsTitle, lineHeight: 1.1, color: C.dark, margin: "0 0 10px" }}>{card.headline}</h3>
                <p style={{ fontSize: F.body, color: C.mid, lineHeight: 1.5, margin: "0 0 28px" }}>{card.tagline}</p>
                {/* Features list */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 36, borderTop: `1px solid ${C.sep}`, paddingTop: 24 }}>
                  {card.features.map((f, fi) => (
                    <div key={fi} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                        <circle cx="8" cy="8" r="8" fill={card.accentColor} opacity={0.1} />
                        <path d="M4.5 8l2.5 2.5 4.5-4.5" stroke={card.accentColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span style={{ fontSize: 15, color: C.mid }}>{f.label}</span>
                    </div>
                  ))}
                </div>
                {/* CTA */}
                <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                  <BtnPrimary to={card.ctaLink} color={card.accentColor}>{card.cta}</BtnPrimary>
                  <BtnLink href={i === 0 ? "#restaurant" : "#franchise"} color={card.accentColor}>Learn more</BtnLink>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal>
          <p style={{ textAlign: "center" }}>
            <a href="#highlights" style={{ fontSize: F.body, color: C.blue, textDecoration: "none" }}>Compare all features ›</a>
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   FOOTER
───────────────────────────────────────────── */
function Footer() {
  return (
    <footer style={{ background: C.offwhite, fontFamily: fontStack }}>
      <Sep />
      {/* CTA row */}
      <div style={{ maxWidth: 1068, margin: "0 auto", padding: "56px 22px 40px", textAlign: "center" }}>
        <Reveal>
          <h2 style={{ fontSize: F.title1, fontWeight: 700, letterSpacing: F.ls, color: C.dark, margin: "0 0 12px" }}>
            Ready to get started?
          </h2>
        </Reveal>
        <Reveal delay={60}>
          <p style={{ fontSize: F.body, color: C.mid, margin: "0 0 28px" }}>
            Join restaurants and franchise operators already running on Mercanta.
          </p>
        </Reveal>
        <Reveal delay={120}>
          <BtnPrimary to="/login" color={C.blue}>Get started free</BtnPrimary>
        </Reveal>
      </div>
      <Sep />
      {/* Links */}
      <div style={{ maxWidth: 1068, margin: "0 auto", padding: "20px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <p style={{ fontSize: 13, color: C.mid, margin: 0 }}>Copyright © 2026 Mercanta. All rights reserved.</p>
        <div style={{ display: "flex", gap: 20 }}>
          {[["#restaurant", "Restaurant"], ["#franchise", "Franchise"], ["/login", "Sign in"]].map(([href, label]) => (
            href.startsWith("#")
              ? <a key={href} href={href} style={{ fontSize: 13, color: C.mid, textDecoration: "none" }}>{label}</a>
              : <Link key={href} to={href} style={{ fontSize: 13, color: C.mid, textDecoration: "none" }}>{label}</Link>
          ))}
        </div>
      </div>
    </footer>
  );
}

/* ─────────────────────────────────────────────
   ROOT PAGE
───────────────────────────────────────────── */
export function LandingPage() {
  return (
    <div style={{ fontFamily: fontStack, WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale" }}>
      <Nav />

      {/* Push content below fixed nav */}
      <div style={{ paddingTop: 0 }}>

        {/* ── HERO ── */}
        <Hero />

        {/* ── MODULAR ── */}
        <ModularSection />

        {/* ── TWO PRODUCTS ── */}
        <TwoProducts />

        {/* ── HIGHLIGHTS ── */}
        <Highlights />

        {/* ═══ RESTAURANT SECTION ═══ */}
        <div id="restaurant">
          <FullBleedDark
            eyebrow="Restaurant Suite"
            headline="The restaurant, connected."
            sub="Every part of your operation — menu, counter, kitchen, customer — talking to each other in real time."
            image="/images/restaurant_dashboard_screenshot.jpeg"
            accentColor={C.orange}
          />

          <StatBar stats={[
            { num: "0", label: "phone calls to take an order" },
            { num: "1 tap", label: "to update your live menu" },
            { num: "Real-time", label: "kitchen and customer sync" },
          ]} dark />

          <SplitFeature
            eyebrow="Menu Management"
            headline="Your menu, always live."
            body="Add dishes, set prices, mark dietary info, and toggle availability. One change updates every screen — the counter, the kitchen, and WhatsApp — instantly."
            bullets={[
              "Organise into categories: Starters, Mains, Desserts",
              "Mark items vegetarian, spicy, or unavailable",
              "Set individual prep times per dish",
              "Changes take effect immediately across all devices",
            ]}
            image="/images/menu_management_screenshot.jpeg"
            bg={C.white}
            accentColor={C.orange}
          />

          <SplitFeature
            eyebrow="Point of Sale"
            headline="Every order, in seconds."
            body="Staff select items from your live menu, add special notes, look up returning customers by phone number, and process payment — all from one clean screen."
            bullets={[
              "Accept cash, UPI, card, or split payments",
              "Built-in Razorpay for instant digital payments",
              "Customer lookup — name and points fill in automatically",
              "Order token sent to kitchen the moment payment clears",
            ]}
            image="/images/point_of_sale_screenshot.jpeg"
            reverse
            bg={C.offwhite}
            accentColor={C.orange}
          />

          <FullBleedDark
            eyebrow="Kitchen Display System"
            headline="No paper. No shouting."
            sub="Live orders appear on the kitchen screen the instant they're placed. One tap moves an order from Confirmed to Preparing to Ready."
            image="/images/kitchen_display_screenshot.jpeg"
            accentColor="#30d158"
          />

          <WhatsAppSection />
        </div>

        {/* ═══ FRANCHISE SECTION ═══ */}
        <div id="franchise">
          <FullBleedDark
            eyebrow="Franchise Manager"
            headline="Command every location."
            sub="A single dashboard giving you live visibility across every franchise — sales, inventory, orders, and performance at a glance."
            image="/images/Franchise_dashboard_screenshot.jpeg"
            accentColor={C.blue}
          />

          <StatBar stats={[
            { num: "1 screen", label: "to oversee all locations" },
            { num: "Live", label: "sales and inventory updates" },
            { num: "Full", label: "financial reporting built in" },
          ]} dark />

          <SplitFeature
            eyebrow="Multi-Location Dashboard"
            headline="See everything from one seat."
            body="Your admin dashboard shows live activity, sales totals, and inventory alerts across every franchise location — in real time, without switching accounts."
            bullets={[
              "Live sales across every outlet",
              "Per-location performance comparison",
              "Inventory alerts and low-stock warnings",
              "One login for the whole business",
            ]}
            image="/images/Admin_multilocation.jpg"
            bg={C.white}
            accentColor={C.blue}
          />

          <SplitFeature
            eyebrow="Inventory & Stock"
            headline="Stocked. Tracked. Ordered."
            body="Franchise locations submit stock orders directly through the app. You approve, dispatch, and track from the central admin — with a full history of every request."
            bullets={[
              "Franchise owners request stock in-app",
              "Admin approves and tracks orders centrally",
              "Full audit history of every stock movement",
              "Automatic low-stock notifications",
            ]}
            image="/images/inventory_managemtn.jpg"
            reverse
            bg={C.offwhite}
            accentColor={C.blue}
          />

          <FullBleedDark
            eyebrow="Financial Reports"
            headline="Numbers that tell the story."
            sub="Sales trends, revenue breakdowns, year-over-year growth, and regional performance — visualised clearly so you can make decisions fast."
            image="/images/Financial_reports.jpg"
            accentColor={C.blue}
          />
        </div>

        {/* ── COMPARE ── */}
        <CompareCards />

        {/* ── FOOTER ── */}
        <Footer />
      </div>
    </div>
  );
}
