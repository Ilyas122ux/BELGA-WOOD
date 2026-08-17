import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  ArchiveRestore,
  Box,
  CheckCircle2,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  FolderTree,
  Package,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  categorySchema,
  type Category,
  type PaginatedProducts,
  type Product,
  type ProductImage,
  type Settings,
} from "@jad-home/shared";
import { api, queryString, uploadImageToCloudinary } from "../services/api";
import { formatPrice } from "../utils/cart";
import { useSeo } from "../hooks/useSeo";
import { SafeImage } from "../components/SafeImage";
function PageTitle({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[.2em] text-copper">
          {eyebrow}
        </p>
        <h1 className="mt-1 font-display text-4xl font-semibold sm:text-5xl">
          {title}
        </h1>
      </div>
      {action}
    </div>
  );
}
function Notice({ text, error = false }: { text: string; error?: boolean }) {
  return text ? (
    <div
      role="status"
      className={`mb-6 ${error ? "alert-error" : "alert-success"}`}
    >
      {text}
    </div>
  ) : null;
}

function invalidateCatalogueQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["admin-products"] });
  queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
  queryClient.invalidateQueries({ queryKey: ["products"] });
  queryClient.invalidateQueries({ queryKey: ["categories"] });
  queryClient.invalidateQueries({ queryKey: ["settings"] });
  queryClient.invalidateQueries({ queryKey: ["product"] });
}

export function AdminLoginPage() {
  useSeo(
    "Connexion administrateur",
    "Accès sécurisé à l’administration JAD HOME.",
  );
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [show, setShow] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{
    email: string;
    password: string;
  }>();
  const submit = handleSubmit(async (values) => {
    setMessage("");
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(values),
      });
      navigate("/admin");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Connexion impossible.",
      );
    }
  });
  return (
    <div className="grid min-h-screen bg-cream/45 lg:grid-cols-2">
      <div className="hidden bg-charcoal p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <SafeImage
          src="/jad-home-logo-v3.png"
          alt="JAD HOME"
          className="h-24 w-80 object-contain"
        />
        <div>
          <p className="eyebrow text-gold">Espace professionnel</p>
          <h1 className="font-display text-6xl font-semibold leading-none">
            Votre catalogue,
            <br />
            toujours à jour.
          </h1>
          <p className="mt-6 max-w-lg leading-7 text-white/60">
            Produits, catégories, paramètres et sauvegardes réunis dans une
            interface simple, reliée directement à votre fichier Excel.
          </p>
        </div>
        <p className="text-xs text-white/35">
          JAD HOME · Administration sécurisée
        </p>
      </div>
      <div className="flex items-center justify-center p-5">
        <form
          onSubmit={submit}
          className="card w-full max-w-md p-6 sm:p-10"
        >
          <SafeImage
            src="/jad-home-logo-v3.png"
            alt="JAD HOME"
            className="mx-auto h-20 w-64 object-contain lg:hidden"
          />
          <p className="eyebrow mt-8 lg:mt-0">Bienvenue</p>
          <h2 className="font-display text-4xl font-semibold">Connexion</h2>
          <p className="mt-3 text-sm leading-6 text-muted">Utilisez vos identifiants administrateur sécurisés.</p>
          <div className="mt-8 space-y-5">
            <label>
              <span className="label">Adresse email</span>
              <input
                type="email"
                className="field"
                autoComplete="username"
                {...register("email", { required: "Email requis" })}
              />
              {errors.email && (
                <span className="text-xs text-red-600">
                  {errors.email.message}
                </span>
              )}
            </label>
            <label>
              <span className="label">Mot de passe</span>
              <div className="relative">
                <input
                  type={show ? "text" : "password"}
                  className="field pe-12"
                  autoComplete="current-password"
                  {...register("password", {
                    required: "Mot de passe requis",
                    minLength: { value: 8, message: "8 caractères minimum" },
                  })}
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute inset-y-0 right-0 grid w-12 place-items-center"
                  aria-label="Afficher le mot de passe"
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <span className="text-xs text-red-600">
                  {errors.password.message}
                </span>
              )}
            </label>
          </div>
          <Notice text={message} error />
          <button disabled={isSubmitting} className="btn-primary mt-7 w-full">
            {isSubmitting ? "Connexion…" : "Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );
}
type Stats = {
  total: number;
  active: number;
  outOfStock: number;
  promotions: number;
  categories: number;
  latest: Product[];
};
export function AdminDashboard() {
  useSeo("Tableau de bord", "Administration JAD HOME.");
  const stats = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => api<Stats>("/api/admin/dashboard"),
  });
  const cards = [
    [Package, "Produits", stats.data?.total || 0],
    [CheckCircle2, "Actifs", stats.data?.active || 0],
    [Box, "Épuisés", stats.data?.outOfStock || 0],
    [ArchiveRestore, "Promotions", stats.data?.promotions || 0],
    [FolderTree, "Catégories", stats.data?.categories || 0],
  ] as const;
  return (
    <>
      <PageTitle
        eyebrow="Vue d’ensemble"
        title="Tableau de bord"
        action={
          <Link className="btn-primary" to="/admin/produits/nouveau">
            <Plus size={18} />
            Ajouter un produit
          </Link>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(([Icon, label, value]) => (
          <div className="card p-5" key={label}>
            <Icon className="text-copper" size={22} />
            <p className="mt-6 text-xs font-bold uppercase tracking-wider text-muted">
              {label}
            </p>
            <p className="mt-1 font-display text-4xl font-semibold">
              {stats.isLoading ? "—" : value}
            </p>
          </div>
        ))}
      </div>
      <section className="card mt-7 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line p-5">
          <h2 className="font-display text-2xl font-semibold">
            Derniers produits
          </h2>
          <Link
            className="text-sm font-semibold underline"
            to="/admin/produits"
          >
            Tout voir
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-left text-sm">
            <thead className="bg-cream/50 text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="p-4">Produit</th>
                <th className="p-4">Prix</th>
                <th className="p-4">Stock</th>
                <th className="p-4">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {stats.data?.latest.map((product) => (
                <tr key={product.id}>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <SafeImage
                        src={product.images[0]}
                        alt=""
                        className="size-12 rounded-lg bg-cream object-cover"
                      />
                      <strong>{product.name_fr}</strong>
                    </div>
                  </td>
                  <td className="p-4 font-semibold">
                    {formatPrice(product.price)}
                  </td>
                  <td className="p-4">{product.stock_quantity}</td>
                  <td className="p-4">
                    <Status active={product.active} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
export function AdminProducts() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState("");
  const queryClient = useQueryClient();
  const products = useQuery({
    queryKey: ["admin-products", search, page],
    queryFn: () =>
      api<PaginatedProducts>(
        `/api/admin/products${queryString({ search, page, limit: 10, active: true })}`,
      ),
  });
  const action = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, boolean> }) =>
      api(`/api/admin/products/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      setNotice("Statut mis à jour.");
      invalidateCatalogueQueries(queryClient);
    },
  });
  const duplicate = useMutation({
    mutationFn: (id: string) =>
      api(`/api/admin/products/${id}/duplicate`, { method: "POST" }),
    onSuccess: () => {
      setNotice("Produit dupliqué.");
      invalidateCatalogueQueries(queryClient);
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      api(`/api/admin/products/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setNotice("Produit supprime de la liste.");
      invalidateCatalogueQueries(queryClient);
    },
    onError: (error) =>
      setNotice(error instanceof Error ? error.message : "Suppression impossible."),
  });
  return (
    <>
      <PageTitle
        eyebrow="Catalogue"
        title="Produits"
        action={
          <Link className="btn-primary" to="/admin/produits/nouveau">
            <Plus size={18} />
            Ajouter
          </Link>
        }
      />
      <Notice text={notice} />
      <div className="card">
        <div className="flex flex-wrap gap-3 border-b border-line p-4">
          <label className="relative min-w-[240px] flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              size={18}
            />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="field ps-10"
              placeholder="Nom du produit…"
            />
          </label>
          <span className="grid min-h-12 place-items-center px-3 text-sm text-muted">
            {products.data?.total || 0} produit(s)
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-cream/50 text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="p-4">Produit</th>
                <th className="p-4">Catégorie</th>
                <th className="p-4">Prix</th>
                <th className="p-4">Stock</th>
                <th className="p-4">Statuts</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {products.data?.items.map((product) => (
                <tr
                  key={product.id}
                  className={!product.active ? "opacity-55" : ""}
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <SafeImage
                        src={product.images[0]}
                        alt=""
                        className="size-14 rounded-lg bg-cream object-cover"
                      />
                      <strong>{product.name_fr}</strong>
                    </div>
                  </td>
                  <td className="p-4">{product.category?.name_fr}</td>
                  <td className="p-4 font-semibold">
                    {formatPrice(product.price)}
                  </td>
                  <td className="p-4">{product.stock_quantity}</td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {product.featured && <Tag>Vedette</Tag>}
                      {product.promotion && <Tag>Promo</Tag>}
                      {product.new_arrival && <Tag>Nouveau</Tag>}
                      <Status active={product.active} />
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-end gap-1">
                      <a
                        href={`/produit/${product.slug}`}
                        target="_blank"
                        className="icon-btn"
                        aria-label="Prévisualiser"
                      >
                        <ExternalLink size={16} />
                      </a>
                      <button
                        className="icon-btn"
                        onClick={() => duplicate.mutate(product.id)}
                        aria-label="Dupliquer"
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        className="icon-btn"
                        onClick={() =>
                          action.mutate({
                            id: product.id,
                            body: { featured: !product.featured },
                          })
                        }
                        aria-label="Vedette"
                      >
                        <CheckCircle2 size={16} />
                      </button>
                      <Link
                        className="icon-btn"
                        to={`/admin/produits/${product.id}`}
                        aria-label="Modifier"
                      >
                        <Edit3 size={16} />
                      </Link>
                      <button
                        className="icon-btn hover:!bg-red-600"
                        onClick={() => {
                          if (confirm("Supprimer ce produit de la boutique ?"))
                            remove.mutate(product.id);
                        }}
                        aria-label="Supprimer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {products.data && products.data.pages > 1 && (
          <div className="flex justify-center gap-2 border-t border-line p-4">
            {Array.from({ length: products.data.pages }, (_, i) => i + 1).map(
              (value) => (
                <button
                  key={value}
                  className={`size-10 border ${value === page ? "bg-charcoal text-white" : "border-line bg-white"}`}
                  onClick={() => setPage(value)}
                >
                  {value}
                </button>
              ),
            )}
          </div>
        )}
      </div>
    </>
  );
}
const emptyProduct = {
  slug: "",
  name_fr: "",
  name_ar: "",
  short_description_fr: "",
  short_description_ar: "",
  description_fr: "",
  description_ar: "",
  category_id: "",
  price: "",
  old_price: "",
  currency: "MAD",
  stock_quantity: 0,
  featured: false,
  new_arrival: false,
  promotion: false,
  active: true,
  colors: "",
  dimensions: "",
  materials: "",
  existing_images: [],
};

function cleanSlug(value: unknown, fallback: unknown): string {
  const source = String(value || fallback || "produit").trim().toLowerCase();
  const slug = source
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return slug || `produit-${Date.now()}`;
}

function prepareProductPayload(values: Record<string, unknown>, existingImages: ProductImage[]) {
  const nameFr = String(values.name_fr || "").trim();
  const nameAr = String(values.name_ar || nameFr).trim();
  return {
    ...values,
    slug: cleanSlug(values.slug, nameFr),
    name_fr: nameFr,
    name_ar: nameAr,
    short_description_fr: String(values.short_description_fr || "").trim(),
    short_description_ar: String(values.short_description_ar || "").trim(),
    description_fr: String(values.description_fr || "").trim(),
    description_ar: String(values.description_ar || "").trim(),
    category_id: String(values.category_id || "").trim(),
    currency: String(values.currency || "MAD").trim() || "MAD",
    price: values.price === "" || values.price === null || values.price === undefined ? 0 : values.price,
    old_price: values.old_price === "" || values.old_price === null || values.old_price === undefined ? "" : values.old_price,
    stock_quantity: values.stock_quantity === "" || values.stock_quantity === null || values.stock_quantity === undefined ? 0 : values.stock_quantity,
    colors: values.colors || "",
    materials: values.materials || "",
    dimensions: String(values.dimensions || "").trim(),
    existing_images: existingImages,
  };
}

export function AdminProductForm() {
  const { id } = useParams();
  const edit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<ProductImage[]>([]);
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState("");
  const product = useQuery({
    queryKey: ["admin-product", id],
    queryFn: () => api<Product>(`/api/admin/products/${id}`),
    enabled: edit,
  });
  const categories = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => api<Category[]>("/api/admin/categories"),
  });
  const runtime = useQuery({
    queryKey: ["admin-me"],
    queryFn: () => api<{ email: string; catalogueBackend?: "excel" | "google-sheets" }>("/api/auth/me"),
    staleTime: 300_000,
  });
  const canUseLocalUploads = runtime.data?.catalogueBackend === "excel";
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<any>({
    defaultValues: emptyProduct,
  });
  useEffect(() => {
    if (product.data) {
      reset({
        ...product.data,
        colors: product.data.colors.join(", "),
        materials: product.data.materials.join(", "),
        existing_images: product.data.images,
      });
      setExistingImages(product.data.images);
    }
  }, [product.data, reset]);
  const previews = useMemo(
    () => files.map((file) => URL.createObjectURL(file)),
    [files],
  );
  useEffect(
    () => () => previews.forEach((url) => URL.revokeObjectURL(url)),
    [previews],
  );
  const submit = handleSubmit(async (values) => {
    setNotice("");
    setProgress(15);
    try {
      try {
        const uploaded = await Promise.all(files.map((file, index) => uploadImageToCloudinary(file, 'products', existingImages.length + index)));
        setProgress(70);
        await api<Product>(
          edit ? `/api/admin/products/${id}` : "/api/admin/products",
          {
            method: edit ? "PUT" : "POST",
            body: JSON.stringify({ ...prepareProductPayload(values, existingImages), cloudinary_images: uploaded }),
          },
        );
        setProgress(100);
        setNotice(edit ? "Produit enregistré." : "Produit ajouté.");
        invalidateCatalogueQueries(queryClient);
        await queryClient.invalidateQueries({ queryKey: ["admin-products"] });
        setTimeout(() => navigate("/admin/produits"), 500);
        return;
      } catch (cloudinaryError) {
        if (files.length && !canUseLocalUploads) {
          const reason = cloudinaryError instanceof Error ? cloudinaryError.message : String(cloudinaryError);
          throw new Error(`Upload Cloudinary impossible. Le produit n'a pas ete enregistre pour eviter une fiche sans image. Detail: ${reason}`);
        }
        if (files.length && !String(cloudinaryError).match(/Cloudinary|configure|signature|Upload/i)) throw cloudinaryError;
      }
      const form = new FormData();
      form.append(
        "product",
        JSON.stringify(prepareProductPayload(values, existingImages)),
      );
      files.forEach((file) => form.append("images", file));
      setProgress(55);
      await api<Product>(
        edit ? `/api/admin/products/${id}` : "/api/admin/products",
        { method: edit ? "PUT" : "POST", body: form },
      );
      setProgress(100);
      setNotice(edit ? "Produit enregistré." : "Produit ajouté.");
      invalidateCatalogueQueries(queryClient);
      await queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      setTimeout(() => navigate("/admin/produits"), 500);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Enregistrement impossible.",
      );
      setProgress(0);
    }
  }, (invalid) => {
    const firstError = Object.values(invalid)[0];
    const message = typeof firstError?.message === "string"
      ? firstError.message
      : "Verifiez les champs obligatoires avant d'enregistrer.";
    setNotice(`Enregistrement bloque: ${message}`);
    setProgress(0);
  });
  const move = (index: number, direction: number) => {
    const next = [...existingImages];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setExistingImages(next);
  };
  const error = (name: string) => {
    const message = errors[name]?.message;
    return typeof message === "string" ? message : undefined;
  };
  return (
    <>
      <PageTitle
        eyebrow={edit ? "Modification" : "Nouveau produit"}
        title={edit ? product.data?.name_fr || "Produit" : "Ajouter un produit"}
        action={
          <Link className="btn-secondary" to="/admin/produits">
            Retour à la liste
          </Link>
        }
      />
      <Notice
        text={notice}
        error={Boolean(notice && !/enregistré|ajouté/.test(notice))}
      />
      {progress > 0 && progress < 100 && (
        <div className="mb-6 h-2 bg-line">
          <div
            className="h-full bg-gold transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      <form onSubmit={submit} className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <FormSection title="Informations principales">
            <div className="grid gap-5 sm:grid-cols-2">
              <AdminField label="Nom français" error={error("name_fr")}>
                <input className="field" {...register("name_fr")} />
              </AdminField>
              <AdminField label="Nom arabe" error={error("name_ar")}>
                <input className="field" dir="rtl" {...register("name_ar")} />
              </AdminField>
              <AdminField label="Slug" error={error("slug")}>
                <input className="field" {...register("slug")} />
              </AdminField>
              <AdminField label="Catégorie" error={error("category_id")}>
                <select className="field" {...register("category_id")}>
                  <option value="">Sélectionner</option>
                  {categories.data?.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name_fr}
                    </option>
                  ))}
                </select>
              </AdminField>
              <AdminField label="Devise">
                <input className="field" {...register("currency")} />
              </AdminField>
            </div>
          </FormSection>
          <FormSection title="Descriptions">
            <div className="grid gap-5 sm:grid-cols-2">
              <AdminField label="Résumé français">
                <textarea
                  className="field min-h-24 py-3"
                  {...register("short_description_fr")}
                />
              </AdminField>
              <AdminField label="Résumé arabe">
                <textarea
                  dir="rtl"
                  className="field min-h-24 py-3"
                  {...register("short_description_ar")}
                />
              </AdminField>
              <AdminField label="Description française">
                <textarea
                  className="field min-h-40 py-3"
                  {...register("description_fr")}
                />
              </AdminField>
              <AdminField label="Description arabe">
                <textarea
                  dir="rtl"
                  className="field min-h-40 py-3"
                  {...register("description_ar")}
                />
              </AdminField>
            </div>
          </FormSection>
          <FormSection title="Images">
            <label className="grid min-h-40 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-line bg-ivory p-6 text-center transition hover:border-copper">
              <input
                className="sr-only"
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) =>
                  setFiles(
                    Array.from(e.target.files || []).slice(
                      0,
                      Math.max(0, 6 - existingImages.length),
                    ),
                  )
                }
              />
              <span>
                <UploadCloud className="mx-auto" />
                <strong className="mt-3 block">
                  Glissez ou choisissez jusqu’à 6 images
                </strong>
                <span className="mt-1 block text-xs text-muted">
                  JPG, PNG ou WebP · 8 Mo maximum · conversion WebP automatique
                </span>
              </span>
            </label>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {existingImages.map((image, index) => (
                <div className="relative" key={typeof image === "string" ? image : image.publicId}>
                  <SafeImage
                    src={image}
                    alt=""
                    className="aspect-square w-full rounded-xl bg-cream object-cover"
                  />
                  <div className="absolute inset-x-1 bottom-1 flex justify-center gap-1">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      className="size-8 bg-white text-xs"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setExistingImages(
                          existingImages.filter((_, i) => i !== index),
                        )
                      }
                      className="size-8 bg-white text-red-600"
                    >
                      <Trash2 className="mx-auto" size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      className="size-8 bg-white text-xs"
                    >
                      →
                    </button>
                  </div>
                </div>
              ))}
              {previews.map((image, index) => (
                <div className="relative" key={image}>
                  <SafeImage
                    src={image}
                    alt={`Nouvelle image ${index + 1}`}
                    className="aspect-square w-full rounded-xl bg-cream object-cover"
                  />
                  <span className="absolute left-1 top-1 bg-gold px-2 py-1 text-[10px] font-bold">
                    NOUVELLE
                  </span>
                </div>
              ))}
            </div>
          </FormSection>
        </div>
        <aside className="space-y-6">
          <FormSection title="Prix & stock">
            <div className="space-y-4">
              <AdminField label="Prix actuel">
                <input
                  type="number"
                  step="0.01"
                  className="field"
                  {...register("price")}
                />
              </AdminField>
              <AdminField label="Ancien prix">
                <input
                  type="number"
                  step="0.01"
                  className="field"
                  {...register("old_price")}
                />
              </AdminField>
              <AdminField label="Quantité en stock">
                <input
                  type="number"
                  className="field"
                  {...register("stock_quantity")}
                />
              </AdminField>
            </div>
          </FormSection>
          <FormSection title="Caractéristiques">
            <div className="space-y-4">
              <AdminField label="Couleurs (séparées par virgule)">
                <input className="field" {...register("colors")} />
              </AdminField>
              <AdminField label="Matières (séparées par virgule)">
                <input className="field" {...register("materials")} />
              </AdminField>
              <AdminField label="Dimensions">
                <input className="field" {...register("dimensions")} />
              </AdminField>
            </div>
          </FormSection>
          <FormSection title="Visibilité">
            <div className="space-y-3">
              {[
                ["active", "Produit actif"],
                ["featured", "Produit vedette"],
                ["new_arrival", "Nouveauté"],
                ["promotion", "En promotion"],
              ].map(([name, label]) => (
                <label
                  className="flex min-h-10 cursor-pointer items-center justify-between text-sm font-semibold"
                  key={name}
                >
                  <span>{label}</span>
                  <input
                    type="checkbox"
                    className="size-5 accent-charcoal"
                    {...register(name)}
                  />
                </label>
              ))}
            </div>
          </FormSection>
          <button disabled={isSubmitting} className="btn-primary w-full">
            <Save size={18} />
            {isSubmitting ? "Enregistrement…" : "Enregistrer le produit"}
          </button>
        </aside>
      </form>
    </>
  );
}
export function AdminCategories() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Category | null>(null);
  const [notice, setNotice] = useState("");
  const categories = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => api<Category[]>("/api/admin/categories"),
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<any>({
    resolver: zodResolver(categorySchema as any),
    defaultValues: {
      slug: "",
      name_fr: "",
      name_ar: "",
      description_fr: "",
      description_ar: "",
      image: "",
      display_order: 0,
      active: true,
    },
  });
  useEffect(() => {
    if (editing) reset(editing);
  }, [editing, reset]);
  const submit = handleSubmit(async (values) => {
    try {
      await api(
        editing
          ? `/api/admin/categories/${editing.id}`
          : "/api/admin/categories",
        { method: editing ? "PUT" : "POST", body: JSON.stringify(values) },
      );
      setNotice(editing ? "Catégorie mise à jour." : "Catégorie ajoutée.");
      setEditing(null);
      reset({
        slug: "",
        name_fr: "",
        name_ar: "",
        description_fr: "",
        description_ar: "",
        image: "",
        display_order: 0,
        active: true,
      });
      invalidateCatalogueQueries(queryClient);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Erreur.");
    }
  });
  const remove = async (category: Category) => {
    if (!confirm(`Désactiver ${category.name_fr} ?`)) return;
    try {
      await api(`/api/admin/categories/${category.id}`, { method: "DELETE" });
      setNotice("Catégorie désactivée.");
      invalidateCatalogueQueries(queryClient);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Suppression impossible.");
    }
  };
  return (
    <>
      <PageTitle eyebrow="Organisation" title="Catégories" />
      <Notice
        text={notice}
        error={/contient|impossible|erreur/i.test(notice)}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <div className="card overflow-hidden">
          <div className="divide-y divide-line">
            {categories.data?.map((category) => (
              <div className="flex items-center gap-4 p-4" key={category.id}>
                <SafeImage
                  src={category.image}
                  alt=""
                  className="size-16 rounded-xl bg-cream object-cover"
                />
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold">
                    {category.name_fr} · {category.name_ar}
                  </h3>
                  <p className="mt-1 text-xs text-muted">
                    /{category.slug} · {category.product_count} produit(s) ·
                    ordre {category.display_order}
                  </p>
                </div>
                <Status active={category.active} />
                <button
                  className="icon-btn"
                  onClick={() => setEditing(category)}
                  aria-label="Modifier"
                >
                  <Edit3 size={16} />
                </button>
                <button
                  className="icon-btn hover:!bg-red-600"
                  onClick={() => remove(category)}
                  aria-label="Désactiver"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
        <form onSubmit={submit} className="card h-fit p-6 xl:sticky xl:top-24">
          <h2 className="font-display text-3xl font-semibold">
            {editing ? "Modifier" : "Ajouter"} une catégorie
          </h2>
          <div className="mt-6 space-y-4">
            <AdminField label="Nom français">
              <input className="field" {...register("name_fr")} />
            </AdminField>
            <AdminField label="Nom arabe">
              <input dir="rtl" className="field" {...register("name_ar")} />
            </AdminField>
            <AdminField label="Slug">
              <input className="field" {...register("slug")} />
            </AdminField>
            <AdminField label="Description française">
              <textarea
                className="field min-h-20 py-3"
                {...register("description_fr")}
              />
            </AdminField>
            <AdminField label="Description arabe">
              <textarea
                dir="rtl"
                className="field min-h-20 py-3"
                {...register("description_ar")}
              />
            </AdminField>
            <AdminField label="Chemin de l’image">
              <input
                className="field"
                placeholder="/uploads/categories/image.webp"
                {...register("image")}
              />
            </AdminField>
            <AdminField label="Ordre">
              <input
                type="number"
                className="field"
                {...register("display_order")}
              />
            </AdminField>
            <label className="flex items-center gap-3 text-sm font-semibold">
              <input
                type="checkbox"
                className="size-5 accent-charcoal"
                {...register("active")}
              />
              Active
            </label>
          </div>
          <button disabled={isSubmitting} className="btn-primary mt-6 w-full">
            <Save size={17} />
            Enregistrer
          </button>
          {editing && (
            <button
              type="button"
              className="mt-2 min-h-11 w-full text-sm underline"
              onClick={() => {
                setEditing(null);
                reset();
              }}
            >
              Annuler
            </button>
          )}
        </form>
      </div>
    </>
  );
}
export function AdminSettings() {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState("");
  const settings = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => api<Settings>("/api/admin/settings"),
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<Settings>();
  useEffect(() => {
    if (settings.data) reset(settings.data);
  }, [settings.data, reset]);
  const submit = handleSubmit(async (values) => {
    try {
      await api("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify(values),
      });
      setNotice("Paramètres enregistrés.");
      invalidateCatalogueQueries(queryClient);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Erreur.");
    }
  });
  const fields = [
    ["business_name", "Nom commercial"],
    ["slogan", "Slogan"],
    ["whatsapp_number", "Numéro WhatsApp (format international)"],
    ["phone_number", "Téléphone"],
    ["email", "Email"],
    ["address", "Adresse"],
    ["instagram_url", "Instagram"],
    ["facebook_url", "Facebook"],
    ["tiktok_url", "TikTok"],
    ["currency", "Devise"],
    ["delivery_fee", "Frais de livraison (MAD)"],
    ["default_language", "Langue par défaut"],
  ];
  return (
    <>
      <PageTitle eyebrow="Configuration" title="Paramètres" />
      <Notice text={notice} />
      <form onSubmit={submit} className="grid gap-6 xl:grid-cols-2">
        <FormSection title="Entreprise & contact">
          <div className="grid gap-5 sm:grid-cols-2">
            {fields.map(([name, label]) => (
              <AdminField label={label} key={name}>
                <input className="field" {...register(name)} />
              </AdminField>
            ))}
          </div>
        </FormSection>
        <FormSection title="Informations de livraison">
          <div className="space-y-5">
            <AdminField label="Texte français">
              <textarea
                className="field min-h-32 py-3"
                {...register("delivery_text_fr")}
              />
            </AdminField>
            <AdminField label="Texte arabe">
              <textarea
                dir="rtl"
                className="field min-h-32 py-3"
                {...register("delivery_text_ar")}
              />
            </AdminField>
          </div>
        </FormSection>
        <button
          disabled={isSubmitting}
          className="btn-primary xl:col-span-2 xl:w-fit"
        >
          <Save size={18} />
          Enregistrer les paramètres
        </button>
      </form>
    </>
  );
}
type Backup = {
  name: string;
  size: number;
  date: string;
};
export function AdminBackups() {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState("");
  const runtime = useQuery({
    queryKey: ["admin-me"],
    queryFn: () => api<{ email: string; catalogueBackend?: "excel" | "google-sheets" }>("/api/auth/me"),
  });
  const isGoogleSheets = runtime.data?.catalogueBackend === "google-sheets";
  const backups = useQuery({
    queryKey: ["admin-backups"],
    queryFn: () => api<Backup[]>("/api/admin/backups"),
    enabled: !isGoogleSheets,
  });
  const create = useMutation({
    mutationFn: () => api("/api/admin/backups", { method: "POST" }),
    onSuccess: () => {
      setNotice("Sauvegarde créée.");
      queryClient.invalidateQueries({ queryKey: ["admin-backups"] });
    },
  });
  const restore = async (name: string) => {
    if (
      !confirm(
        `Restaurer ${name} ? Une sauvegarde du catalogue actuel sera créée avant la restauration.`,
      )
    )
      return;
    try {
      await api(`/api/admin/backups/${encodeURIComponent(name)}/restore`, {
        method: "POST",
      });
      setNotice(
        "Sauvegarde restaurée. Rechargez la boutique pour voir les données.",
      );
      queryClient.invalidateQueries();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Restauration impossible.");
    }
  };
  if (isGoogleSheets) {
    return (
      <>
        <PageTitle
          eyebrow="Export Google Sheets"
          title="Sauvegardes"
          action={
            <a className="btn-primary" href="/api/admin/backups/export">
              <Download size={18} />
              Exporter JSON
            </a>
          }
        />
        <Notice text={notice} />
        <div className="mb-6 rounded-xl border border-gold/30 bg-gold/10 p-4 text-sm leading-6">
          Catalogue Google Sheets synchronisé. Les sauvegardes Excel ne sont pas la sauvegarde active dans ce mode.
          Utilisez l'export JSON manuel et la sauvegarde hebdomadaire Google Drive documentée.
        </div>
      </>
    );
  }
  return (
    <>
      <PageTitle
        eyebrow="Sécurité Excel"
        title="Sauvegardes"
        action={
          <button
            onClick={() => create.mutate()}
            disabled={create.isPending}
            className="btn-primary"
          >
            <Plus size={18} />
            Créer une sauvegarde
          </button>
        }
      />
      <Notice text={notice} />
      <div className="mb-6 rounded-xl border border-gold/30 bg-gold/10 p-4 text-sm leading-6">
        Chaque écriture crée automatiquement une sauvegarde. Les 20 plus
        récentes sont conservées. La restauration crée d’abord une copie de
        sécurité de l’état actuel.
      </div>
      <div className="card divide-y divide-line">
        {backups.isLoading ? (
          <div className="p-6">Chargement…</div>
        ) : backups.data?.length ? (
          backups.data.map((backup) => (
            <div
              className="flex flex-wrap items-center gap-4 p-4 sm:p-5"
              key={backup.name}
            >
              <span className="grid size-11 place-items-center rounded-xl bg-cream">
                <ArchiveRestore size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{backup.name}</p>
                <p className="mt-1 text-xs text-muted">
                  {new Date(backup.date).toLocaleString("fr-MA")} ·{" "}
                  {(backup.size / 1024).toFixed(1)} Ko
                </p>
              </div>
              <a
                className="icon-btn"
                href={`/api/admin/backups/${encodeURIComponent(backup.name)}/download`}
                aria-label="Télécharger"
              >
                <Download size={17} />
              </a>
              <button
                className="btn-secondary px-4"
                onClick={() => restore(backup.name)}
              >
                <RotateCcw size={16} />
                Restaurer
              </button>
            </div>
          ))
        ) : (
          <div className="p-10 text-center text-muted">
            Aucune sauvegarde pour le moment.
          </div>
        )}
      </div>
    </>
  );
}
function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-5 sm:p-7">
      <h2 className="mb-6 font-display text-3xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}
function AdminField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      <span className="label">{label}</span>
      {children}
      {error && (
        <span className="mt-1 block text-xs text-red-600">{String(error)}</span>
      )}
    </label>
  );
}
function Status({ active }: { active: boolean }) {
  return (
    <span
      className={`badge ${active ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"}`}
    >
      {active ? "Actif" : "Inactif"}
    </span>
  );
}
function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="badge bg-gold/20 text-charcoal">
      {children}
    </span>
  );
}
