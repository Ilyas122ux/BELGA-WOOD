import { useEffect, useState, type FormEvent } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
/* eslint-disable react-hooks/exhaustive-deps */
import {
  BriefcaseBusiness,
  FolderKanban,
  Grid2X2,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareQuote,
  Plus,
  Settings,
  Star,
  X,
} from "lucide-react";
type Row = Record<string, string | number | boolean>;
type Api<T> = { success: boolean; data: T; message: string };
async function api<T>(url: string, init?: RequestInit) {
  const r = await fetch(`/api${url}`, {
    credentials: "include",
    headers:
      init?.body instanceof FormData
        ? undefined
        : { "content-type": "application/json" },
    ...init,
  });
  const x = (await r.json()) as Api<T>;
  if (!r.ok || !x.success)
    throw new Error(x.message || "Opération impossible.");
  return x.data;
}
const items = [
  ["", "Vue d’ensemble", LayoutDashboard],
  ["products", "Produits", BriefcaseBusiness],
  ["categories", "Catégories", Grid2X2],
  ["projects", "Réalisations", FolderKanban],
  ["services", "Services", BriefcaseBusiness],
  ["testimonials", "Avis clients", Star],
  ["quotes", "Demandes de devis", MessageSquareQuote],
  ["settings", "Paramètres du site", Settings],
] as const;
function Login({ onSuccess }: { onSuccess?: () => void }) {
  const nav = useNavigate(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const d = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api("/auth/login", { method: "POST", body: JSON.stringify(d) });
      if (onSuccess) onSuccess();
      else nav("/admin", { replace: true });
    } catch (x) {
      setError(x instanceof Error ? x.message : "Connexion impossible.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="admin-login">
      <section>
        <img src="/images/belga-wood-hero.png" alt="Intérieur BELGA WOOD" />
        <div>
          <img src="/images/belga-wood-logo.png" alt="BELGA WOOD" />
          <p>Administration du portfolio et des demandes clients.</p>
        </div>
      </section>
      <form onSubmit={submit}>
        <p className="eyebrow">Espace sécurisé</p>
        <h1>Bienvenue.</h1>
        <label>
          Adresse e-mail
          <input required name="email" type="email" />
        </label>
        <label>
          Mot de passe
          <input required name="password" type="password" />
        </label>
        {error && <p role="alert">{error}</p>}
        <button disabled={busy} className="button button-dark">
          {busy ? "Connexion&" : "Se connecter"}
        </button>
      </form>
    </main>
  );
}
function Dashboard() {
  const [d, setD] = useState<Row | null>(null);
  useEffect(() => {
    api<Row>("/admin/dashboard")
      .then(setD)
      .catch(() => setD(null));
  }, []);
  const cards = [
    ["Produits actifs", "activeProducts"],
    ["Produits mis en avant", "featuredProducts"],
    ["Réalisations publiées", "publishedProjects"],
    ["Services actifs", "activeServices"],
    ["Nouvelles demandes", "newQuotes"],
  ];
  return (
    <div className="admin-page">
      <Title t="Vue d’ensemble" />
      <div className="stats">
        {cards.map(([l, k]) => (
          <article key={k}>
            <span>{l}</span>
            <strong>{d?.[k] ?? ""}</strong>
          </article>
        ))}
      </div>
      <div className="admin-columns">
        <section className="panel">
          <h2>Demandes récentes</h2>
          <Empty
            text={
              d
                ? "Les demandes récentes sont synchronisées avec Google Sheets."
                : "Chargement…"
            }
          />
        </section>
        <section className="panel">
          <h2>Actions rapides</h2>
          <div className="quick">
            <Link to="/admin/products"><Plus />Nouveau produit</Link>
            <Link to="/admin/projects">
              <Plus />
              Nouvelle réalisation
            </Link>
            <Link to="/admin/services">
              <Plus />
              Nouveau service
            </Link>
            <Link to="/admin/quotes">
              <MessageSquareQuote />
              Voir les demandes
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
const config: Record<string, { title: string; label: string; field: string }> =
  {
    products: { title: "Produits", label: "Nom", field: "name" },
    projects: { title: "Réalisations", label: "Titre", field: "title" },
    services: { title: "Services", label: "Titre", field: "title" },
    categories: { title: "Catégories", label: "Nom", field: "name" },
    testimonials: {
      title: "Avis clients",
      label: "Client",
      field: "clientName",
    },
    quotes: { title: "Demandes de devis", label: "Nom", field: "fullName" },
  };
function Manager({ kind }: { kind: string }) {
  const c = config[kind]!,
    [rows, setRows] = useState<Row[]>([]),
    [error, setError] = useState(""),
    [adding, setAdding] = useState(false),
    [editing, setEditing] = useState<Row | null>(null),
    [categories, setCategories] = useState<Row[]>([]),
    [productImages, setProductImages] = useState<Row[]>([]),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("all"),
    [sort, setSort] = useState("displayOrder"),
    [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const load = () =>
    api<Row[]>(`/admin/${kind}`)
      .then(setRows)
      .catch((e) => setError(String(e.message)));
  useEffect(() => {
    void load();
    if (["projects", "products"].includes(kind)) void api<Row[]>("/admin/categories").then(setCategories);
    if (kind === "products") void api<Row[]>("/admin/product-images").then(setProductImages);
  }, [kind]);
  const visibleRows = rows.filter((row) => {
    const haystack = `${row.title || row.name || row.clientName || row.fullName || ""} ${row.location || ""}`.toLowerCase();
    if (!haystack.includes(search.toLowerCase())) return false;
    if (status === "published" && row.published !== true) return false;
    if (status === "draft" && row.published === true) return false;
    if (status === "featured" && row.featured !== true) return false;
    if (status === "active" && row.active !== true) return false;
    if (status === "inactive" && row.active === true) return false;
    return status === "all" || ["published", "draft", "featured", "active", "inactive"].includes(status) || row.categoryId === status;
  }).sort((a,b) => sort === "title" ? String(a.title || a.name).localeCompare(String(b.title || b.name), "fr") : sort === "updatedAt" ? String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")) : Number(a.displayOrder || 0) - Number(b.displayOrder || 0));
  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api(`/admin/${kind}`, {
        method: "POST",
        body: JSON.stringify({
          ...d,
          active: true,
          published: false,
          displayOrder: rows.length + 1,
        }),
      });
      setAdding(false);
      load();
    } catch (x) {
      setError(x instanceof Error ? x.message : "Erreur");
    }
  }
  async function update(id: string, values: Row) {
    try {
      await api(`/admin/${kind}/${id}`, {
        method: "PUT",
        body: JSON.stringify(values),
      });
      await load();
    } catch (x) {
      setError(x instanceof Error ? x.message : "Erreur");
    }
  }
  async function remove(id: string) {
    try {
      await api(`/admin/${kind}/${id}`, { method: "DELETE" });
      setPendingDelete(null);
      await load();
    } catch (x) {
      setError(x instanceof Error ? x.message : "Erreur");
    }
  }
  async function saveEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const form = new FormData(e.currentTarget);
    const values = Object.fromEntries(form) as Row;
    values.featured = form.has("featured");
    values.published = form.has("published");
    values.active = form.has("active");
    await update(String(editing.id), values);
    setEditing(null);
  }
  async function uploadImage(id: string, file: File) {
    const entity =
      kind === "projects"
        ? "project"
        : kind === "products"
          ? "product"
        : kind === "services"
          ? "service"
          : kind === "categories"
            ? "category"
            : "";
    if (!entity) return;
    const form = new FormData();
    form.set("image", file);
    form.set("folder", kind);
    form.set("entityType", entity);
    form.set("entityId", id);
    try {
      await api("/admin/media/upload", { method: "POST", body: form });
      await load();
    } catch (x) {
      setError(x instanceof Error ? x.message : "Upload impossible");
    }
  }
  async function uploadProductGallery(id: string, file: File) {
    const form = new FormData();
    form.set("image", file); form.set("folder", "products"); form.set("entityType", "product-gallery"); form.set("entityId", id);
    form.set("displayOrder", String(productImages.filter(image=>image.productId===id).length+1));
    try { await api("/admin/media/upload", {method:"POST",body:form}); setProductImages(await api<Row[]>("/admin/product-images")); }
    catch(x){setError(x instanceof Error?x.message:"Upload impossible");}
  }
  async function deleteProductGallery(image: Row) {
    if (!window.confirm("Supprimer définitivement cette image de la galerie ?")) return;
    try { await api("/admin/media", {method:"DELETE",body:JSON.stringify({publicId:image.imagePublicId,sheet:"ProductImages",recordId:image.id})}); setProductImages(await api<Row[]>("/admin/product-images")); }
    catch(x){setError(x instanceof Error?x.message:"Suppression impossible");}
  }
  return (
    <div className="admin-page">
      <Title t={c.title} action={() => setAdding(true)} />
      {kind === "products" && <p className="admin-content-warning" role="note"><strong>Validation client requise :</strong> les prix actuellement affichés sont des valeurs de démonstration et ne doivent pas être considérés comme définitifs avant confirmation de BELGA WOOD.</p>}
      {kind === "products" && <div className="toolbar"><input aria-label="Rechercher" placeholder="Rechercher un produit…" value={search} onChange={(e)=>setSearch(e.target.value)}/><select value={status} onChange={(e)=>setStatus(e.target.value)}><option value="all">Tous les produits</option><option value="active">Actifs</option><option value="inactive">Inactifs</option><option value="featured">Mis en avant</option>{categories.map(item=><option value={String(item.id)} key={String(item.id)}>{item.name}</option>)}</select><select value={sort} onChange={(e)=>setSort(e.target.value)}><option value="displayOrder">Ordre d’affichage</option><option value="updatedAt">Modification récente</option><option value="title">Nom A–Z</option></select></div>}
      {kind === "projects" && <div className="toolbar"><input aria-label="Rechercher" placeholder="Rechercher par titre ou localisation…" value={search} onChange={(e)=>setSearch(e.target.value)}/><select aria-label="Filtrer" value={status} onChange={(e)=>setStatus(e.target.value)}><option value="all">Tous les projets</option><option value="published">Publiés</option><option value="draft">Non publiés</option><option value="featured">Mis en avant</option>{categories.map((category)=><option key={String(category.id)} value={String(category.id)}>{category.name}</option>)}</select><select aria-label="Trier" value={sort} onChange={(e)=>setSort(e.target.value)}><option value="displayOrder">Ordre d’affichage</option><option value="updatedAt">Modification récente</option><option value="title">Titre A–Z</option></select></div>}
      {adding && (
        <form className="panel settings-form" onSubmit={add}>
          <h2>Nouvel élément</h2>
          <label>
            {c.label}
            <input required name={c.field} />
          </label>
          {kind === "projects" && (
            <>
              <label>Catégorie<select required name="categoryId" defaultValue=""><option value="">Sélectionner une catégorie</option>{categories.filter((x)=>x.active === true).map((x)=><option key={String(x.id)} value={String(x.id)}>{x.name}</option>)}</select></label>
              <label>
                Localisation
                <input name="location" />
              </label>
              <label>Description courte<input name="shortDescription" maxLength={220}/></label>
              <label>Description détaillée<textarea name="description" rows={6}/></label>
            </>
          )}
          {kind === "products" && <><label>Catégorie<select required name="categoryId" defaultValue=""><option value="">Sélectionner une catégorie</option>{categories.filter(x=>x.active===true).map(x=><option value={String(x.id)} key={String(x.id)}>{x.name}</option>)}</select></label><label>Description courte<input name="shortDescription" required maxLength={220}/></label><label>Description complète<textarea name="description" rows={6} required/></label><div><label>Type de prix<select name="priceType" defaultValue="starting_from"><option value="fixed">Prix fixe</option><option value="starting_from">À partir de</option><option value="on_request">Sur demande</option></select></label><label>Prix<input name="price" type="number" min="0" step="1"/></label></div><div><label>Ancien prix<input name="oldPrice" type="number" min="0" step="1"/></label><label>Devise<input name="currency" defaultValue="DH"/></label></div></>}
          <div>
            <button className="button button-dark">Enregistrer</button>
            <button type="button" onClick={() => setAdding(false)}>
              Annuler
            </button>
          </div>
        </form>
      )}
      {editing && kind === "projects" && <form className="panel settings-form" onSubmit={saveEdit}><h2>Modifier la réalisation</h2><div><label>Titre<input required name="title" defaultValue={String(editing.title || "")}/></label><label>Catégorie<select required name="categoryId" defaultValue={String(editing.categoryId || "")}>{categories.map((x)=><option key={String(x.id)} value={String(x.id)}>{x.name}</option>)}</select></label></div><div><label>Localisation<input name="location" defaultValue={String(editing.location || "")}/></label><label>Ordre d’affichage<input type="number" min="0" name="displayOrder" defaultValue={String(editing.displayOrder || 0)}/></label></div><label>Description courte<input name="shortDescription" defaultValue={String(editing.shortDescription || "")}/></label><label>Description détaillée<textarea rows={7} name="description" defaultValue={String(editing.description || "")}/></label><div><label><input type="checkbox" name="published" defaultChecked={editing.published === true}/> Publié</label><label><input type="checkbox" name="featured" defaultChecked={editing.featured === true}/> Mis en avant</label></div><div><button className="button button-dark">Enregistrer les modifications</button><button type="button" onClick={()=>setEditing(null)}>Annuler</button></div></form>}
      {editing && kind === "products" && <form className="panel settings-form product-admin-editor" onSubmit={saveEdit}><h2>Modifier le produit</h2><p className="form-section-label">Informations principales</p><div><label>Nom<input required name="name" defaultValue={String(editing.name||"")}/></label><label>Catégorie<select required name="categoryId" defaultValue={String(editing.categoryId||"")}>{categories.map(x=><option value={String(x.id)} key={String(x.id)}>{x.name}</option>)}</select></label></div><label>Description courte<input required name="shortDescription" defaultValue={String(editing.shortDescription||"")}/></label><label>Description complète<textarea required rows={7} name="description" defaultValue={String(editing.description||"")}/></label><p className="form-section-label">Prix</p><div><label>Type de prix<select name="priceType" defaultValue={String(editing.priceType||"starting_from")}><option value="fixed">Prix fixe</option><option value="starting_from">À partir de</option><option value="on_request">Sur demande</option></select></label><label>Prix<input type="number" min="0" name="price" defaultValue={String(editing.price||0)}/></label></div><div><label>Ancien prix<input type="number" min="0" name="oldPrice" defaultValue={String(editing.oldPrice||0)}/></label><label>Devise<input name="currency" defaultValue={String(editing.currency||"DH")}/></label></div><p className="form-section-label">Publication</p><div><label><input type="checkbox" name="active" defaultChecked={editing.active===true}/> Actif</label><label><input type="checkbox" name="featured" defaultChecked={editing.featured===true}/> Mis en avant</label><label>Ordre<input type="number" min="0" name="displayOrder" defaultValue={String(editing.displayOrder||0)}/></label></div><div><button className="button button-dark">Enregistrer</button><button type="button" onClick={()=>setEditing(null)}>Annuler</button></div></form>}
      <section className="panel">
        {error && <p role="alert">{error}</p>}
        {rows.length ? (
          <div className="admin-list">
            {visibleRows.map((r) => (
              <article key={String(r.id)}>
                {["projects", "products", "categories", "services"].includes(kind) && <img className="admin-thumb" src={String((["projects","products"].includes(kind) ? r.coverImageUrl : r.imageUrl) || "/images/belga-wood-hero.png")} alt=""/>}<div>
                  <strong>{String(r[c.field] || "Sans titre")}</strong>
                  <small>{String(r.location || r.status || r.slug || "")}{r.updatedAt ? ` · Modifié ${new Date(String(r.updatedAt)).toLocaleDateString("fr-FR")}` : ""}</small>
                </div>
                <span>
                  {kind === "products" ? (r.priceType === "on_request" ? "Sur demande" : `${r.priceType === "starting_from" ? "À partir de " : ""}${Number(r.price||0).toLocaleString("fr-FR")} ${r.currency||"DH"}`) : ""}
                  {r.published === true
                    ? "Publié"
                    : r.active === false
                      ? "Inactif"
                      : ""}
                </span>
                <div className="admin-actions">
                  {["projects", "products", "services", "categories"].includes(kind) && (
                    <label className="upload-small">
                      Image
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void uploadImage(String(r.id), f);
                        }}
                      />
                    </label>
                  )}
                  {kind === "projects" && (
                    <><a href={`/realisations/${r.slug}`} target="_blank" rel="noreferrer">Voir</a><button onClick={()=>setEditing(r)}>Modifier</button><button
                      onClick={() =>
                        update(String(r.id), {
                          published: r.published !== true,
                        })
                      }
                    >
                      {r.published === true ? "Dépublier" : "Publier"}
                    </button>
                    <button onClick={()=>update(String(r.id), {featured:r.featured !== true})}>{r.featured === true ? "Retirer de la une" : "Mettre en avant"}</button></>
                  )}
                  {kind === "products" && <><a href={`/produits/${r.slug}`} target="_blank" rel="noreferrer">Voir</a><button onClick={()=>setEditing(r)}>Modifier</button><button onClick={()=>update(String(r.id),{active:r.active!==true})}>{r.active===true?"Désactiver":"Activer"}</button><button onClick={()=>update(String(r.id),{featured:r.featured!==true})}>{r.featured===true?"Retirer de la une":"Mettre en avant"}</button></>}
                  {kind === "products" && <label className="upload-small">+ Galerie<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{const file=e.target.files?.[0];if(file)void uploadProductGallery(String(r.id),file)}}/></label>}
                  {["services", "categories"].includes(kind) && (
                    <button
                      onClick={() =>
                        update(String(r.id), { active: r.active !== true })
                      }
                    >
                      {r.active === true ? "Désactiver" : "Activer"}
                    </button>
                  )}
                  {kind === "quotes" && (
                    <select
                      value={String(r.status || "new")}
                      onChange={(e) =>
                        update(String(r.id), { status: e.target.value })
                      }
                    >
                      {[
                        "new",
                        "contacted",
                        "qualified",
                        "in_progress",
                        "completed",
                        "archived",
                      ].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  )}
                  {kind !== "quotes" &&
                    (pendingDelete === String(r.id) ? (
                      <>
                        <button
                          className="danger"
                          onClick={() => remove(String(r.id))}
                        >
                          Confirmer
                        </button>
                        <button onClick={() => setPendingDelete(null)}>
                          Annuler
                        </button>
                      </>
                    ) : (
                      <button onClick={() => setPendingDelete(String(r.id))}>
                        Supprimer
                      </button>
                    ))}
                </div>
                {kind === "products" && productImages.some(image=>image.productId===r.id) && <div className="admin-gallery-strip">{productImages.filter(image=>image.productId===r.id).sort((a,b)=>Number(a.displayOrder)-Number(b.displayOrder)).map(image=><figure key={String(image.id)}><img src={String(image.imageUrl)} alt=""/><button onClick={()=>deleteProductGallery(image)}>×</button></figure>)}</div>}
              </article>
            ))}
          </div>
        ) : (
          <Empty text={`Aucun élément dans ${c.title.toLowerCase()}.`} />
        )}
      </section>
    </div>
  );
}
function SettingsPage() {
  const [d, setD] = useState<Row>({}),
    [msg, setMsg] = useState("");
  useEffect(() => {
    api<Row>("/admin/settings").then(setD);
  }, []);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg("Enregistrement…");
    try {
      setD(
        await api("/admin/settings", {
          method: "PUT",
          body: JSON.stringify(
            Object.fromEntries(new FormData(e.currentTarget)),
          ),
        }),
      );
      setMsg("Paramètres enregistrés.");
    } catch (x) {
      setMsg(x instanceof Error ? x.message : "Erreur");
    }
  }
  return (
    <div className="admin-page">
      <Title t="Paramètres du site" />
      <form className="panel settings-form" onSubmit={save}>
        {[
          "companyName",
          "heroTitle",
          "heroSubtitle",
          "aboutTitle",
          "aboutText",
          "phone",
          "whatsapp",
          "email",
          "address",
          "city",
          "googleMapsUrl",
          "instagram",
          "facebook",
          "tiktok",
          "workingHours",
          "seoTitle",
          "seoDescription",
        ].map((k) => (
          <label key={k}>
            {k}
            <input name={k} defaultValue={String(d[k] || "")} />
          </label>
        ))}
        <button className="button button-dark">Enregistrer</button>
        <p>{msg}</p>
      </form>
    </div>
  );
}
function Title({ t, action }: { t: string; action?: () => void }) {
  return (
    <header className="admin-title">
      <div>
        <p className="eyebrow">Administration</p>
        <h1>{t}</h1>
      </div>
      {action && (
        <button onClick={action} className="button button-dark">
          <Plus />
          Ajouter
        </button>
      )}
    </header>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="admin-empty">
      <FolderKanban />
      <h3>{text}</h3>
    </div>
  );
}
function Shell() {
  const [o, setO] = useState(false),
    [ready, setReady] = useState<boolean | null>(null),
    [sheetUrl, setSheetUrl] = useState("");
  const route = useLocation();
  useEffect(() => {
    api("/auth/session")
      .then(() => {
        setReady(true);
        return api<{ url: string }>("/admin/google-sheet")
          .then((x) => setSheetUrl(x.url))
          .catch(() => setSheetUrl(""));
      })
      .catch(() => setReady(false));
  }, []);
  if (ready === false) return <Login onSuccess={() => setReady(true)} />;
  return (
    <div className="admin-shell">
      <aside className={o ? "open" : ""}>
        <div className="admin-brand">
          <img src="/images/belga-wood-logo.png" alt="BELGA WOOD" />
          <button onClick={() => setO(false)} aria-label="Fermer le menu d’administration">
            <X />
          </button>
        </div>
        <nav>
          {items.map(([u, l, I]) => (
            <NavLink
              end={!u}
              onClick={() => setO(false)}
              to={`/admin/${u}`}
              key={u}
            >
              <I />
              {l}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={() =>
            api("/auth/logout", { method: "POST" }).then(() =>
              location.assign("/admin/connexion"),
            )
          }
        >
          <LogOut />
          Déconnexion
        </button>
      </aside>
      <main className="admin-main">
        <header>
          <button onClick={() => setO(true)} aria-label="Ouvrir le menu d’administration" aria-expanded={o}>
            <Menu />
          </button>
          <strong>BELGA WOOD</strong>
          {sheetUrl && (
            <a
              className="sheet-link"
              href={sheetUrl}
              target="_blank"
              rel="noreferrer"
            >
              Ouvrir Google Sheets
            </a>
          )}
        </header>
        {route.pathname === "/admin/" || route.pathname === "/admin" ? (
          <Dashboard />
        ) : route.pathname.endsWith("/settings") ? (
          <SettingsPage />
        ) : (
          <Manager kind={route.pathname.split("/").pop() || "projects"} />
        )}
      </main>
    </div>
  );
}
export default function AdminPortal({ login = false }: { login?: boolean }) {
  useEffect(() => {
    const existing = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const meta = existing || document.createElement("meta");
    const previous = existing?.content;
    meta.name = "robots";
    meta.content = "noindex, nofollow, noarchive";
    if (!existing) document.head.append(meta);
    return () => {
      if (existing) meta.content = previous || "";
      else meta.remove();
    };
  }, []);
  return login ? <Login /> : <Shell />;
}
