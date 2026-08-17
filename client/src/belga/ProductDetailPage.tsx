import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, MapPin, Maximize2, MessageCircle, MessagesSquare, Ruler, Wrench, X } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useSeo } from "../hooks/useSeo";
import { useBelgaData } from "./data";
import { formatPrice, productWhatsAppUrl, ProductPrice } from "./ProductCatalogue";
import type { Product } from "./model";

const optimized = (url: string, width: number) => url.includes("res.cloudinary.com")
  ? url.replace("/upload/", `/upload/f_auto,q_auto,w_${width},c_limit/`)
  : url;

function RelatedProduct({ product, category }: { product: Product; category: string }) {
  return <Link className="related-editorial-card" to={`/produits/${product.slug}`}>
    <div><img src={optimized(product.coverImageUrl, 760)} alt={product.name} loading="lazy"/><span>Découvrir <ArrowRight/></span></div>
    <p>{category}</p><h3>{product.name}</h3><strong>{formatPrice(product)}</strong>
  </Link>;
}

export default function ProductDetailPage() {
  const { slug } = useParams();
  const { products, categories, settings } = useBelgaData();
  const product = products.find((item) => item.slug === slug);
  const category = categories.find((item) => item.id === product?.categoryId);
  const gallery = useMemo(() => product ? [product.coverImageUrl, ...product.images.map((image) => image.imageUrl)].filter((image, index, all) => Boolean(image) && all.indexOf(image) === index) : [], [product]);
  const [selected, setSelected] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const galleryTrigger = useRef<HTMLButtonElement>(null);
  const lightboxDialog = useRef<HTMLDivElement>(null);
  const related = products
    .filter((item) => item.id !== product?.id)
    .sort((left, right) => Number(right.categoryId === product?.categoryId) - Number(left.categoryId === product?.categoryId))
    .slice(0, 4);

  useEffect(() => { setSelected(0); setLightbox(false); }, [slug]);
  useEffect(() => {
    if (!lightbox) return;
    const trigger = galleryTrigger.current;
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightbox(false);
      if (event.key === "ArrowLeft") setSelected((value) => (value - 1 + gallery.length) % gallery.length);
      if (event.key === "ArrowRight") setSelected((value) => (value + 1) % gallery.length);
      if (event.key === "Tab") {
        const controls = [...(lightboxDialog.current?.querySelectorAll<HTMLElement>("button") || [])];
        if (!controls.length) return;
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.body.style.overflow = "hidden";
    lightboxDialog.current?.querySelector<HTMLElement>(".lightbox-close")?.focus();
    window.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", keydown);
      trigger?.focus();
    };
  }, [gallery.length, lightbox]);

  const absoluteProductUrl = product ? new URL(`/produits/${product.slug}`, settings.siteUrl || window.location.origin).toString() : "";
  useSeo(product?.name || "Produit", product?.shortDescription || "Produit sur mesure BELGA WOOD à Casablanca.", product ? {
    "@context": "https://schema.org", "@type": "Product", name: product.name,
    description: product.shortDescription, image: gallery, url: absoluteProductUrl,
  } : undefined, settings.siteUrl);

  if (!product) return <main className="product-not-found section"><p className="eyebrow">Erreur 404</p><h1>Produit introuvable</h1><p>Ce produit n’est pas disponible ou n’existe plus dans notre catalogue.</p><Link className="button button-dark" to="/produits"><ArrowLeft/> Retour aux produits</Link></main>;
  const whatsappUrl = productWhatsAppUrl(product, settings.whatsapp, settings.siteUrl);
  const previous = () => setSelected((value) => (value - 1 + gallery.length) % gallery.length);
  const next = () => setSelected((value) => (value + 1) % gallery.length);

  return <main className="luxury-product-page">
    <nav className="luxury-breadcrumb" aria-label="Fil d’Ariane"><Link to="/">Accueil</Link><span>/</span><Link to="/produits">Produits</Link>{category&&<><span>/</span><Link to={`/produits?categorie=${category.slug}`}>{category.name}</Link></>}<span>/</span><strong>{product.name}</strong></nav>

    <section className="luxury-product-hero">
      <div className="luxury-gallery">
        <button ref={galleryTrigger} className="luxury-main-image" onClick={() => setLightbox(true)} aria-label="Afficher l’image en plein écran">
          <img key={gallery[selected]} src={optimized(gallery[selected], 1800)} alt={`${product.name} — vue ${selected + 1}`}/><span><Maximize2/> Plein écran</span>
        </button>
        {gallery.length > 1 && <div className="luxury-thumbnails" role="tablist" aria-label="Images du produit">{gallery.map((image, index) => <button role="tab" aria-selected={selected === index} className={selected === index ? "active" : ""} onClick={() => setSelected(index)} key={image}><img src={optimized(image, 240)} alt={`Vue ${index + 1} de ${product.name}`}/><span>0{index + 1}</span></button>)}</div>}
        {gallery.length === 1 && <p className="single-image-note">Vue principale · Photographie produit BELGA WOOD</p>}
      </div>

      <aside className="luxury-product-info"><div className="sticky-product-info">
        <Link className="back-catalogue" to="/produits"><ArrowLeft/> Retour aux produits</Link>
        <p className="product-category-label">{category?.name || "Collection BELGA WOOD"}</p>
        <h1>{product.name}</h1>
        <ProductPrice product={product}/>
        <p className="luxury-product-lead">{product.shortDescription}</p>
        <div className="luxury-product-actions"><a className="premium-whatsapp" href={whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle/> Demander sur WhatsApp</a><Link className="premium-quote" to="/demande-de-devis">Demander un devis <ArrowRight/></Link></div>
        <div className="product-reassurance" aria-label="Services inclus"><div><Ruler/><span>Fabrication<strong>Sur mesure</strong></span></div><div><MessagesSquare/><span>Accompagnement<strong>Personnalisé</strong></span></div><div><Wrench/><span>Pose<strong>Professionnelle</strong></span></div><div><MapPin/><span>Zone<strong>{settings.city || "Casablanca"}</strong></span></div></div>
      </div></aside>
    </section>

    <section className="product-story-editorial"><div className="story-index"><span>01</span><p>Le produit</p></div><div className="story-heading"><p className="eyebrow">Pensé dans le détail</p><h2>{product.shortDescription}</h2></div><div className="story-copy"><p>{product.description}</p><blockquote>Chaque configuration est adaptée aux proportions de votre espace et à vos usages.</blockquote></div></section>

    {gallery.length > 1 && <section className="product-editorial-gallery"><header><p className="eyebrow">Détails & perspectives</p><h2>La matière sous tous ses angles.</h2></header><div>{gallery.slice(1).map((image, index) => <button onClick={() => { setSelected(index + 1); setLightbox(true); }} key={image}><img src={optimized(image, index % 3 === 0 ? 1600 : 1000)} alt={`${product.name} — détail ${index + 1}`} loading="lazy"/></button>)}</div></section>}

    {related.length > 0 && <section className="related-editorial section"><header><div><p className="eyebrow">Même univers</p><h2>Vous aimerez aussi.</h2></div><Link to="/produits">Voir tout le catalogue <ArrowRight/></Link></header><div>{related.map((item) => <RelatedProduct product={item} category={categories.find((cat) => cat.id === item.categoryId)?.name || "BELGA WOOD"} key={item.id}/>)}</div></section>}

    <section className="product-final-cta"><div><p className="eyebrow">Votre projet</p><h2>Un espace en tête&nbsp;?</h2><p>Parlez-nous de vos dimensions, de votre intérieur et du style recherché. Nous vous accompagnons vers une réalisation vraiment sur mesure.</p></div><div><a href={whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle/> Échanger sur WhatsApp</a><Link to="/demande-de-devis">Préparer ma demande <ArrowRight/></Link></div></section>

    <div className="mobile-product-bar"><div><span>Prix indicatif</span><strong>{formatPrice(product)}</strong></div><a href={whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle/> WhatsApp</a></div>

    {lightbox && <div ref={lightboxDialog} className="product-lightbox" role="dialog" aria-modal="true" aria-label={`Galerie ${product.name}`}><button className="lightbox-close" onClick={() => setLightbox(false)} aria-label="Fermer"><X/></button>{gallery.length > 1&&<button className="lightbox-prev" onClick={previous} aria-label="Image précédente"><ChevronLeft/></button>}<figure><img src={optimized(gallery[selected], 2200)} alt={`${product.name} — vue ${selected + 1}`}/><figcaption>{product.name}<span>{selected + 1} / {gallery.length}</span></figcaption></figure>{gallery.length > 1&&<button className="lightbox-next" onClick={next} aria-label="Image suivante"><ChevronRight/></button>}</div>}
  </main>;
}
