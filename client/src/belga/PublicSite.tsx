import { useEffect, useState } from "react";
import { Link, NavLink, Route, Routes, useLocation, useParams, useSearchParams } from "react-router-dom";
import { ArrowRight, Menu, MessageCircle, X } from "lucide-react";
import { DataProvider, useBelgaData } from "./data";
import { FeaturedProducts, ProductCatalogue } from "./ProductCatalogue";
import ProductDetailPage from "./ProductDetailPage";
import { useSeo } from "../hooks/useSeo";
const nav = [
  ["/", "Accueil"],
  ["/produits", "Produits"],
  ["/services", "Services"],
  ["/realisations", "Réalisations"],
  ["/a-propos", "À propos"],
  ["/contact", "Contact"],
];
function Header() {
  const [o, setO] = useState(false);
  const { settings } = useBelgaData();
  const whatsapp = (settings.whatsapp || "+212 706-379794").replace(/\D/g, "");
  return (
    <header className="site-header">
      <Link className="brand" to="/">
        <img src="/images/belga-wood-logo.png" alt="BELGA WOOD" />
      </Link>
      <nav>
        {nav.map(([u, l]) => (
          <NavLink end={u === "/"} to={u} key={u}>
            {l}
          </NavLink>
        ))}
      </nav>
      <Link className="button button-gold desktop-cta" to="/demande-de-devis">
        Demander un devis
      </Link>
      <button className="menu-button" onClick={() => setO(true)} aria-label="Ouvrir le menu" aria-expanded={o}>
        <Menu />
      </button>
      {o && (
        <div className="mobile-menu">
          <button onClick={() => setO(false)} aria-label="Fermer le menu">
            <X />
          </button>
          <img src="/images/belga-wood-logo.png" alt="BELGA WOOD" />
          {nav.map(([u, l]) => (
            <Link onClick={() => setO(false)} to={u} key={u}>
              {l}
            </Link>
          ))}
          <a className="mobile-whatsapp" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer"><MessageCircle/> WhatsApp</a>
        </div>
      )}
    </header>
  );
}
function Footer() {
  const { settings } = useBelgaData();
  return (
    <footer>
      <div className="footer-main">
        <img src="/images/belga-wood-logo.png" alt="BELGA WOOD" />
        <p>
          {settings.aboutText ||
            "Agencement intérieur, menuiserie et mobilier sur mesure à Casablanca."}
        </p>
        <div>
          {nav.slice(1).map(([u, l]) => (
            <Link to={u} key={u}>
              {l}
            </Link>
          ))}
        </div>
        <div>
          <strong>{settings.companyName}</strong>
          <span>{settings.city || "Casablanca"}, Maroc</span>
          {settings.phone && (
            <a href={`tel:${settings.phone}`}>{settings.phone}</a>
          )}
        </div>
      </div>
      <small>© {new Date().getFullYear()} BELGA WOOD.</small>
    </footer>
  );
}
function Hero() {
  const { settings } = useBelgaData();
  return (
    <section className="hero">
      <img
        src="/images/belga-wood-hero.png"
        alt="Cuisine contemporaine sur mesure"
      />
      <div className="hero-shade" />
      <div className="hero-content">
        <p className="eyebrow">Menuiserie · Agencement · Casablanca</p>
        <h1>{settings.heroTitle}</h1>
        <p>{settings.heroSubtitle}</p>
        <div>
          <Link className="button button-gold" to="/demande-de-devis">
            Demander un devis <ArrowRight />
          </Link>
          <Link className="button button-ghost" to="/realisations">
            Voir nos réalisations
          </Link>
        </div>
      </div>
    </section>
  );
}
function Services({ limit }: { limit?: number }) {
  const { services } = useBelgaData(),
    list = limit
      ? services.filter((s) => s.featured).slice(0, limit)
      : services;
  return list.length ? (
    <div className="service-grid">
      {list.map((s, i) => (
        <Link
          className={i === 0 ? "service-card featured" : "service-card"}
          to={`/services/${s.slug}`}
          key={s.id}
        >
          {s.imageUrl ? <img src={s.imageUrl} alt="" /> : <div className="service-image-fallback" aria-hidden="true"><span>BW</span></div>}
          <span>0{i + 1}</span>
          <div>
            <h3>{s.title}</h3>
            <p>{s.shortDescription}</p>
            <b>
              Découvrir <ArrowRight />
            </b>
          </div>
        </Link>
      ))}
    </div>
  ) : (
    <Empty text="Aucun service disponible." />
  );
}
function Projects({ featured = false }: { featured?: boolean }) {
  const { projects, categories } = useBelgaData();
  const [params, setParams] = useSearchParams();
  const [f, setF] = useState(() => {
    const slug = params.get("categorie");
    return categories.find((category) => category.slug === slug)?.id || "";
  });
  const requestedCategory = params.get("categorie");
  useEffect(() => {
    if (!f && requestedCategory) {
      const category = categories.find((item) => item.slug === requestedCategory);
      if (category) setF(category.id);
    }
  }, [categories, f, requestedCategory]);
  const chooseCategory = (id: string) => {
    setF(id);
    if (!featured) {
      const category = categories.find((item) => item.id === id);
      setParams(category ? { categorie: category.slug } : {}, { replace: true });
    }
  };
  const list = projects.filter(
    (p) => (!featured || p.featured) && (!f || p.categoryId === f),
  );
  return (
    <main className="section">
      {!featured && (
        <div className="filters">
          <button onClick={() => chooseCategory("")} className={!f ? "active" : ""}>
            Tous
          </button>
          {categories.map((c) => (
            <button
              onClick={() => chooseCategory(c.id)}
              className={f === c.id ? "active" : ""}
              key={c.id}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
      {list.length ? (
        <div className="portfolio-grid">
          {list.map((p, index) => (
            <Link
              className={`project-card project-card-${index + 1}`}
              to={`/realisations/${p.slug}`}
              key={p.id}
            >
              <img
                src={p.coverImageUrl || "/images/belga-wood-hero.png"}
                alt={p.title}
              />
              <div>
                <span>{categories.find((category) => category.id === p.categoryId)?.name}</span>
                <h3>{p.title}</h3>
                <p>{p.location}</p>
                <b>Voir le projet <ArrowRight /></b>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <Empty text="Aucune réalisation disponible pour le moment." />
      )}
    </main>
  );
}
const categoryCopy: Record<string, string> = {
  cuisines: "Cuisines pensées autour de vos usages et de votre manière de recevoir.",
  placards: "Rangements intégrés qui libèrent l’espace avec discrétion.",
  dressings: "Volumes organisés, finitions précises et confort quotidien.",
  "meubles-tv": "Compositions murales qui structurent le séjour.",
  portes: "Portes sur mesure aux proportions et matières maîtrisées.",
  "amenagement-interieur": "Une vision cohérente de l’espace, du dessin à la pose.",
  "autres-realisations": "Bibliothèques, bureaux et pièces uniques sur mesure.",
};
function CategoriesShowcase() {
  const { categories } = useBelgaData();
  return <section className="home-categories section"><div className="category-heading"><Title k="Collections" t="Un savoir-faire pour chaque espace."/><p>Découvrez nos univers sur mesure, dessinés pour votre intérieur et réalisés avec exigence à Casablanca.</p></div><div className="category-editorial-grid">{categories.map((category,index)=><Link className={`category-editorial-card category-${index+1}`} to={`/realisations?categorie=${category.slug}`} key={category.id}><img src={category.imageUrl || "/images/belga-wood-hero.png"} alt={category.name} loading="lazy"/><span className="category-number">0{index+1}</span><div><p>{category.projectCount || 0} réalisation{category.projectCount === 1 ? "" : "s"}</p><h3>{category.name}</h3><span>{category.description || categoryCopy[category.slug] || "Créations sur mesure BELGA WOOD."}</span><b>Explorer <ArrowRight/></b></div></Link>)}</div></section>;
}
function Home() {
  const { testimonials, settings } = useBelgaData();
  useSeo(
    settings.seoTitle || "Menuiserie sur mesure à Casablanca",
    settings.seoDescription || settings.heroSubtitle,
    { "@context": "https://schema.org", "@type": "Organization", name: settings.companyName || "BELGA WOOD", url: settings.siteUrl || window.location.origin },
    settings.siteUrl,
  );
  return (
    <>
      <Hero />
      <section className="trust">
        {[
          "Sur mesure",
          "Finitions soignées",
          "Installation professionnelle",
          "Accompagnement personnalisé",
        ].map((x, i) => (
          <div key={x}>
            <span>0{i + 1}</span>
            <strong>{x}</strong>
          </div>
        ))}
      </section>
      <CategoriesShowcase />
      <FeaturedProducts />
      <section className="portfolio-dark">
        <div className="section-title"><div><p className="eyebrow">Réalisations</p><h2>Des espaces conçus pour durer.</h2></div><Link to="/realisations">Voir tout le portfolio <ArrowRight/></Link></div>
        <Projects featured />
      </section>
      <section className="section home-services">
        <Title k="Expertises" t="Chaque détail compte." />
        <Services limit={6} />
      </section>
      <section className="section intro">
        <p className="eyebrow">Notre approche</p>
        <div><h2>{settings.aboutTitle}</h2><p>{settings.aboutText}</p></div>
      </section>
      <section className="section process">
        <Title k="Méthode" t="Du premier trait à la pose." />
        <div>{[["01","Écoute","Comprendre votre espace, vos usages et vos envies."],["02","Conception","Composer une réponse sur mesure, juste et durable."],["03","Réalisation","Fabriquer, ajuster et installer avec précision."]].map(([n,t,p])=><article key={n}><span>{n}</span><h3>{t}</h3><p>{p}</p></article>)}</div>
      </section>
      {testimonials.length > 0 && (
        <section className="section testimonials">
          <Title k="Avis clients" t="Ils nous ont confié leur intérieur." />
          <div className="testimonial-grid">{testimonials.map((item)=><blockquote key={item.id}><p>“{item.content}”</p><footer>{item.clientName}{item.clientLocation ? ` · ${item.clientLocation}` : ""}</footer></blockquote>)}</div>
        </section>
      )}
      <Cta />
    </>
  );
}
function ServicePage() {
  const { slug } = useParams(),
    { services } = useBelgaData(),
    s = services.find((x) => x.slug === slug);
  const { settings } = useBelgaData();
  useSeo(s?.title || "Service introuvable", s?.shortDescription || "Services BELGA WOOD à Casablanca.", undefined, settings.siteUrl);
  return s ? (
    <>
      <PageHero k="Service" t={s.title} />
      <main className="section prose">
        <h2>{s.shortDescription}</h2>
        <p>{s.description}</p>
        <Link className="button button-dark" to="/demande-de-devis">
          Parler de mon projet
        </Link>
      </main>
    </>
  ) : <DetailNotFound eyebrow="Erreur 404" title="Service introuvable" text="Ce service n’est pas disponible ou n’existe plus." to="/services" action="Voir nos services" />;
}
function ProjectPage() {
  const { slug } = useParams(),
    { projects, categories } = useBelgaData(),
    p = projects.find((x) => x.slug === slug);
  const { settings } = useBelgaData();
  const projectUrl = p ? new URL(`/realisations/${p.slug}`, settings.siteUrl || window.location.origin).toString() : "";
  useSeo(p?.title || "Réalisation introuvable", p?.shortDescription || "Réalisations BELGA WOOD à Casablanca.", p ? { "@context": "https://schema.org", "@type": "CreativeWork", name: p.title, description: p.shortDescription, image: [p.coverImageUrl, ...p.images.map((image) => image.imageUrl)], url: projectUrl } : undefined, settings.siteUrl);
  if (!p) return <DetailNotFound eyebrow="Erreur 404" title="Réalisation introuvable" text="Le projet demandé n’est pas disponible dans notre portfolio." to="/realisations" action="Retour aux réalisations" />;
  const related = projects
    .filter((project) => project.id !== p.id)
    .sort((left, right) => Number(right.categoryId === p.categoryId) - Number(left.categoryId === p.categoryId))
    .slice(0, 3);
  return (
    <>
      <section className="project-hero"><img src={p.coverImageUrl || "/images/belga-wood-hero.png"} alt={p.title}/><div><p className="eyebrow">{categories.find((c) => c.id === p.categoryId)?.name || "Réalisation"}</p><h1>{p.title}</h1><span>{p.location}</span></div></section>
      <main className="section project-story">
        <div><p className="eyebrow">Le projet</p><h2>{p.shortDescription}</h2></div>
        <p>{p.description}</p>
        {p.images?.length > 0 && <div className="project-gallery">{p.images.map((i) => <img key={i.id} src={i.imageUrl} alt={i.altText || p.title} loading="lazy" />)}</div>}
      </main>
      {related.length > 0 && <section className="related-projects section"><div className="section-title"><div><p className="eyebrow">À découvrir</p><h2>Projets similaires</h2></div><Link to="/realisations">Voir toutes les réalisations <ArrowRight/></Link></div><div className="related-project-grid">{related.map((project) => <Link to={`/realisations/${project.slug}`} key={project.id}><img src={project.coverImageUrl} alt={project.title} loading="lazy"/><span>{categories.find((category) => category.id === project.categoryId)?.name}</span><h3>{project.title}</h3><p>{project.location}</p></Link>)}</div></section>}
      <Cta />
    </>
  );
}
function Quote() {
  const { services } = useBelgaData();
  const [state, setState] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("loading");
    const body = Object.fromEntries(new FormData(e.currentTarget));
    body.clientRequestId = crypto.randomUUID();
    try {
      const r = await fetch("/api/quotes", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
        x = await r.json();
      setState(x.success ? "success" : x.message || "Envoi impossible.");
    } catch {
      setState("Le service est momentanément indisponible. Veuillez réessayer.");
    }
  }
  return (
    <>
      <PageHero
        k="Votre projet"
        t="Construisons un intérieur qui vous ressemble."
      />
      <main className="section form-layout">
        <div>
          <h2>Parlez-nous de votre besoin.</h2>
        </div>
        {state === "success" ? (
          <div className="success">
            <h3>Merci. Votre demande a bien été envoyée.</h3>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label>
              Nom complet
              <input required name="fullName" />
            </label>
            <div className="form-row">
              <label>
                Téléphone
                <input required name="phone" type="tel" inputMode="tel" pattern="[+0-9 ()-]{8,24}" />
              </label>
              <label>
                Email
                <input type="email" name="email" />
              </label>
            </div>
            <label>
              Ville
              <input required name="city" />
            </label>
            <label>
              Service
              <select name="serviceId">
                <option value="">Sélectionner</option>
                {services.map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Type de projet
              <input name="projectType" />
            </label>
            <label>
              Budget approximatif
              <input name="budgetRange" />
            </label>
            <label>
              Description
              <textarea required name="message" rows={6} />
            </label>
            {state && state !== "loading" && <p role="alert">{state}</p>}
            <button
              disabled={state === "loading"}
              className="button button-dark"
            >
              {state === "loading" ? "Envoi&" : "Envoyer ma demande"}
            </button>
          </form>
        )}
      </main>
    </>
  );
}
function Contact() {
  const { settings } = useBelgaData();
  return (
    <>
      <PageHero k="Contact" t="Une idée, un espace, un projet ?" />
      <main className="section contact">
        <h2>Rencontrons-nous.</h2>
        <div className="contact-list">
          {settings.phone && (
            <article>
              <span>Téléphone</span>
              <a href={`tel:${settings.phone}`}><strong>{settings.phone}</strong></a>
            </article>
          )}
          {settings.email && (
            <article>
              <span>Email</span>
              <a href={`mailto:${settings.email}`}><strong>{settings.email}</strong></a>
            </article>
          )}
          <article>
            <span>Zone</span>
            <strong>{settings.city || "Casablanca"}, Maroc</strong>
          </article>
        </div>
      </main>
    </>
  );
}
const PageHero = ({ k, t }: { k: string; t: string }) => (
  <section className="page-hero">
    <p className="eyebrow">{k}</p>
    <h1>{t}</h1>
  </section>
);
const Title = ({ k, t }: { k: string; t: string }) => (
  <div className="section-title">
    <div>
      <p className="eyebrow">{k}</p>
      <h2>{t}</h2>
    </div>
  </div>
);
const Empty = ({ text }: { text: string }) => (
  <div className="empty-art light">
    <span>{text}</span>
  </div>
);
const DetailNotFound = ({ eyebrow, title, text, to, action }: { eyebrow: string; title: string; text: string; to: string; action: string }) => (
  <main className="detail-not-found section">
    <p className="eyebrow">{eyebrow}</p>
    <h1>{title}</h1>
    <p>{text}</p>
    <Link className="button button-dark" to={to}>{action} <ArrowRight/></Link>
  </main>
);
const NotFound = () => (
  <main className="product-not-found section">
    <p className="eyebrow">Erreur 404</p>
    <h1>Page introuvable.</h1>
    <Link to="/"><ArrowRight /> Retour à l’accueil</Link>
  </main>
);
const Cta = () => (
  <section className="cta section">
    <h2>Transformons votre idée en un espace singulier.</h2>
    <Link className="button button-gold" to="/demande-de-devis">
      Demander un devis
    </Link>
  </section>
);
function PageSeo({ title, description }: { title: string; description: string }) {
  const { settings } = useBelgaData();
  useSeo(title, description, undefined, settings.siteUrl);
  return null;
}
function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname, search]);

  return null;
}
function Inner() {
  const { settings } = useBelgaData();
  return (
    <>
      <ScrollToTop />
      <Header />
      <Routes>
        <Route index element={<Home />} />
        <Route
          path="services"
          element={
            <>
              <PageSeo title="Services" description="Découvrez les services de menuiserie et d’aménagement sur mesure BELGA WOOD à Casablanca." />
              <PageHero k="Expertises" t="Nos services" />
              <main className="section">
                <Services />
              </main>
            </>
          }
        />
        <Route path="services/:slug" element={<ServicePage />} />
        <Route path="produits" element={<ProductCatalogue />} />
        <Route path="produits/:slug" element={<ProductDetailPage />} />
        <Route
          path="realisations"
          element={
            <>
              <PageSeo title="Réalisations" description="Découvrez les cuisines, dressings et aménagements réalisés par BELGA WOOD à Casablanca." />
              <PageHero k="Portfolio" t="Nos réalisations" />
              <Projects />
            </>
          }
        />
        <Route path="realisations/:slug" element={<ProjectPage />} />
        <Route
          path="a-propos"
          element={
            <>
              <PageSeo title="À propos" description="Découvrez l’approche et le savoir-faire sur mesure de BELGA WOOD." />
              <PageHero k="À propos" t="Le sur-mesure au cœur du projet." />
              <main className="section prose">
                <p>{settings.aboutText}</p>
              </main>
            </>
          }
        />
        <Route path="contact" element={<><PageSeo title="Contact" description="Contactez BELGA WOOD pour votre projet d’aménagement sur mesure à Casablanca."/><Contact /></>} />
        <Route path="demande-de-devis" element={<><PageSeo title="Demande de devis" description="Présentez votre projet sur mesure à BELGA WOOD et demandez un devis."/><Quote /></>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <a className="whatsapp" aria-label="Contacter BELGA WOOD sur WhatsApp" href={`https://wa.me/${(settings.whatsapp || "+212 706-379794").replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
          <MessageCircle />
      </a>
      <Footer />
    </>
  );
}
export default function PublicSite() {
  return (
    <DataProvider>
      <Inner />
    </DataProvider>
  );
}
