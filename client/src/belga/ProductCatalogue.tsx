/* eslint-disable react-refresh/only-export-components */
import { useMemo, useState } from "react";
import { ArrowRight, MessageCircle, Search, SlidersHorizontal } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useSeo } from "../hooks/useSeo";
import { useBelgaData } from "./data";
import type { Category, Product } from "./model";

export const formatPrice = (product: Product) => {
  if (product.priceType === "on_request") return "Prix sur demande";
  const amount = `${Number(product.price || 0).toLocaleString("fr-FR")} ${product.currency || "DH"}`;
  return product.priceType === "starting_from" ? `À partir de ${amount}` : amount;
};
const whatsappNumber = (value?: string) => (value || "+212 706-379794").replace(/\D/g, "");
export const productWhatsAppUrl = (product: Product, number?: string, siteUrl?: string) => {
  const productUrl = new URL(`/produits/${product.slug}`, siteUrl || window.location.origin).toString();
  const message = `Bonjour BELGA WOOD,\n\nJe suis intéressé(e) par le produit :\n${product.name}\n\nPrix : ${product.priceType === "on_request" ? "Sur demande" : formatPrice(product)}\n\nLien :\n${productUrl}`;
  return `https://wa.me/${whatsappNumber(number)}?text=${encodeURIComponent(message)}`;
};
const discount = (product: Product) => product.price > 0 && product.oldPrice > product.price ? Math.round((1-product.price/product.oldPrice)*100) : 0;

export function ProductPrice({ product }: { product: Product }) {
  const reduction = discount(product);
  return <div className="product-price"><strong>{formatPrice(product)}</strong>{reduction > 0 && <><del>{product.oldPrice.toLocaleString("fr-FR")} {product.currency || "DH"}</del><span>-{reduction}%</span></>}</div>;
}
export function ProductCard({ product, category }: { product: Product; category?: Category }) {
  const { settings } = useBelgaData();
  return <article className="catalog-product-card"><Link className="catalog-product-image" to={`/produits/${product.slug}`}><img src={product.coverImageUrl} alt={product.name} loading="lazy"/>{discount(product)>0&&<span className="discount-badge">-{discount(product)}%</span>}</Link><div className="catalog-product-body"><p>{category?.name || "Collection BELGA WOOD"}</p><Link to={`/produits/${product.slug}`}><h3>{product.name}</h3></Link><ProductPrice product={product}/><p className="product-excerpt">{product.shortDescription}</p><div className="product-card-actions"><Link to={`/produits/${product.slug}`}>Voir les détails <ArrowRight/></Link><a href={productWhatsAppUrl(product,settings.whatsapp,settings.siteUrl)} target="_blank" rel="noreferrer" aria-label={`Demander ${product.name} sur WhatsApp`}><MessageCircle/></a></div></div></article>;
}

export function FeaturedProducts() {
  const { products, categories } = useBelgaData();
  const featured = products.filter((product)=>product.featured).slice(0,4);
  if (!featured.length) return null;
  return <section className="featured-products section"><header className="catalog-section-heading"><div><p className="eyebrow">Sélection</p><h2>Nos produits signature.</h2></div><Link to="/produits">Découvrir le catalogue <ArrowRight/></Link></header><div className="catalog-grid">{featured.map(product=><ProductCard key={product.id} product={product} category={categories.find(category=>category.id===product.categoryId)}/>)}</div></section>;
}

export function ProductCatalogue() {
  const { products, categories, settings } = useBelgaData();
  const [query,setQuery]=useState(""),[category,setCategory]=useState(""),[priceType,setPriceType]=useState(""),[sort,setSort]=useState("recommended");
  useSeo("Produits sur mesure", "Découvrez les cuisines, dressings, placards, meubles TV, portes et mobilier BELGA WOOD avec prix visibles à Casablanca.", undefined, settings.siteUrl);
  const list=useMemo(()=>products.filter(product=>{
    const cat=categories.find(item=>item.id===product.categoryId);
    const text=`${product.name} ${product.shortDescription} ${cat?.name||""}`.toLowerCase();
    return text.includes(query.toLowerCase())&&(!category||product.categoryId===category)&&(!priceType||product.priceType===priceType);
  }).sort((a,b)=>sort==="price-asc"?(a.priceType==="on_request"?Infinity:a.price)-(b.priceType==="on_request"?Infinity:b.price):sort==="price-desc"?(b.priceType==="on_request"?-1:b.price)-(a.priceType==="on_request"?-1:a.price):sort==="newest"?String(b.createdAt).localeCompare(String(a.createdAt)):Number(b.featured)-Number(a.featured)||a.displayOrder-b.displayOrder),[products,categories,query,category,priceType,sort]);
  const filters=<><label>Catégorie<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">Toutes les catégories</option>{categories.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Type de prix<select value={priceType} onChange={e=>setPriceType(e.target.value)}><option value="">Tous les prix</option><option value="fixed">Prix fixe</option><option value="starting_from">À partir de</option><option value="on_request">Sur demande</option></select></label><button className="clear-filters" onClick={()=>{setCategory("");setPriceType("");setQuery("")}}>Effacer les filtres</button></>;
  return <main className="catalog-page"><section className="catalog-hero"><p className="eyebrow">Catalogue BELGA WOOD</p><h1>Des pièces pensées pour votre intérieur.</h1><p>Explorez nos modèles, découvrez leurs prix indicatifs et contactez-nous pour les adapter à votre espace.</p></section><section className="catalog-layout section"><aside className="catalog-sidebar"><h2>Filtrer</h2>{filters}</aside><div className="catalog-results"><div className="catalog-toolbar"><label className="catalog-search"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher un produit…"/></label><details className="mobile-filters"><summary><SlidersHorizontal/> Filtres</summary><div>{filters}</div></details><label className="catalog-sort">Trier<select value={sort} onChange={e=>setSort(e.target.value)}><option value="recommended">Recommandés</option><option value="price-asc">Prix croissant</option><option value="price-desc">Prix décroissant</option><option value="newest">Nouveautés</option></select></label></div><p className="catalog-count">{list.length} produit{list.length!==1?"s":""}</p>{list.length?<div className="catalog-grid">{list.map(product=><ProductCard key={product.id} product={product} category={categories.find(item=>item.id===product.categoryId)}/>)}</div>:<div className="catalog-empty">Aucun produit ne correspond à votre recherche.</div>}</div></section></main>;
}

export function ProductDetail() {
  const {slug}=useParams(),{products,categories,settings}=useBelgaData(); const product=products.find(item=>item.slug===slug); const [selected,setSelected]=useState(0);
  useSeo(product?.name||"Produit",product?.shortDescription||"Produit sur mesure BELGA WOOD à Casablanca.",product?{"@context":"https://schema.org","@type":"Product",name:product.name,description:product.shortDescription,image:[product.coverImageUrl,...product.images.map(image=>image.imageUrl)]}:undefined);
  if(!product)return <main className="section"><h1>Produit introuvable.</h1></main>;
  const category=categories.find(item=>item.id===product.categoryId),gallery=[product.coverImageUrl,...product.images.map(image=>image.imageUrl)].filter(Boolean),related=products.filter(item=>item.id!==product.id&&item.categoryId===product.categoryId).slice(0,4);
  return <main className="product-detail-page"><nav className="breadcrumb"><Link to="/">Accueil</Link><span>/</span><Link to="/produits">Produits</Link><span>/</span><strong>{product.name}</strong></nav><section className="product-detail-main"><div className="product-gallery-commercial"><img className="product-main-image" src={gallery[selected]} alt={product.name}/>{gallery.length>1&&<div>{gallery.map((image,index)=><button className={selected===index?"active":""} onClick={()=>setSelected(index)} key={image}><img src={image} alt=""/></button>)}</div>}</div><div className="product-buy-panel"><p className="eyebrow">{category?.name}</p><h1>{product.name}</h1><ProductPrice product={product}/><p className="product-lead">{product.shortDescription}</p><div className="product-conversion"><a className="button whatsapp-button" href={productWhatsAppUrl(product,settings.whatsapp)} target="_blank" rel="noreferrer"><MessageCircle/> Demander sur WhatsApp</a><Link className="button button-dark" to="/demande-de-devis">Demander un devis</Link></div><div className="product-detail-copy"><h2>Détails du produit</h2><p>{product.description}</p><ul><li>Fabrication et dimensions adaptables</li><li>Choix de finitions selon votre projet</li><li>Étude et installation par BELGA WOOD</li></ul></div></div></section>{related.length>0&&<section className="related-products section"><header className="catalog-section-heading"><div><p className="eyebrow">À découvrir</p><h2>Dans la même collection.</h2></div></header><div className="catalog-grid">{related.map(item=><ProductCard key={item.id} product={item} category={category}/>)}</div></section>}</main>;
}
