import { useEffect } from 'react';

export function useSeo(title: string, description: string, structuredData?: Record<string, unknown>, siteUrl?: string) {
  useEffect(() => {
    document.title = `${title} | BELGA WOOD`;
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!meta) { meta = document.createElement('meta'); meta.name = 'description'; document.head.append(meta); }
    meta.content = description;
    const setProperty = (property: string, content: string) => {
      let element = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
      if (!element) { element = document.createElement('meta'); element.setAttribute('property', property); document.head.append(element); }
      element.content = content;
    };
    setProperty('og:title', `${title} | BELGA WOOD`);
    setProperty('og:description', description);
    const canonicalUrl = new URL(window.location.pathname, siteUrl || window.location.origin).toString();
    setProperty('og:url', canonicalUrl);
    setProperty('og:type', structuredData?.['@type'] === 'Product' ? 'product' : 'website');
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.append(canonical); }
    canonical.href = canonicalUrl;
    const id = 'belga-wood-structured-data';
    document.getElementById(id)?.remove();
    if (structuredData) { const script = document.createElement('script'); script.id = id; script.type = 'application/ld+json'; script.text = JSON.stringify(structuredData); document.head.append(script); }
    return () => document.getElementById(id)?.remove();
  }, [title, description, structuredData, siteUrl]);
}
