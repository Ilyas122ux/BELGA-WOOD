import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Edit3, ImagePlus, Save, Trash2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { categorySchema, type Category } from '@jad-home/shared';
import { api, uploadImageToCloudinary } from '../services/api';
import { SafeImage } from '../components/SafeImage';

const defaults = { slug: '', name_fr: '', name_ar: '', description_fr: '', description_ar: '', image: '', display_order: 0, active: true };

function invalidateCatalogueQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
  queryClient.invalidateQueries({ queryKey: ['categories'] });
  queryClient.invalidateQueries({ queryKey: ['products'] });
}

export default function AdminCategoriesPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Category | null>(null);
  const [categoryFile, setCategoryFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [notice, setNotice] = useState('');
  const categories = useQuery({ queryKey: ['admin-categories'], queryFn: () => api<Category[]>('/api/admin/categories') });
  const runtime = useQuery({
    queryKey: ['admin-me'],
    queryFn: () => api<{ email: string; catalogueBackend?: 'excel' | 'google-sheets' }>('/api/auth/me'),
    staleTime: 300_000,
  });
  const canUseLocalUploads = runtime.data?.catalogueBackend === 'excel';
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<any>({ resolver: zodResolver(categorySchema as any), defaultValues: defaults });

  useEffect(() => { if (editing) reset(editing); }, [editing, reset]);
  useEffect(() => {
    if (!categoryFile) { setPreviewUrl(editing?.image || ''); return; }
    const url = URL.createObjectURL(categoryFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [categoryFile, editing?.image]);

  const submit = handleSubmit(async (values) => {
    try {
      let image = values.image as string;
      if (categoryFile) {
        try {
          const uploaded = await uploadImageToCloudinary(categoryFile, 'categories', 0);
          image = uploaded.secureUrl;
        } catch (cloudinaryError) {
          if (!canUseLocalUploads) {
            const reason = cloudinaryError instanceof Error ? cloudinaryError.message : String(cloudinaryError);
            throw new Error(`Upload Cloudinary impossible. La categorie n'a pas ete enregistree pour eviter une image manquante. Detail: ${reason}`);
          }
          if (!String(cloudinaryError).match(/Cloudinary|configure|signature|Upload/i)) throw cloudinaryError;
          const imageForm = new FormData();
          imageForm.append('image', categoryFile);
          const uploaded = await api<{ path: string }>('/api/admin/categories/upload', { method: 'POST', body: imageForm });
          image = uploaded.path;
        }
      }
      await api(editing ? `/api/admin/categories/${editing.id}` : '/api/admin/categories', {
        method: editing ? 'PUT' : 'POST', body: JSON.stringify({ ...values, image }),
      });
      setNotice(editing ? 'Catégorie mise à jour.' : 'Catégorie ajoutée.');
      setEditing(null); setCategoryFile(null); reset(defaults);
      await invalidateCatalogueQueries(queryClient);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Enregistrement impossible.'); }
  });

  const deactivate = async (category: Category) => {
    if (!confirm(`Désactiver ${category.name_fr} ?`)) return;
    try {
      await api(`/api/admin/categories/${category.id}`, { method: 'DELETE' });
      setNotice('Catégorie désactivée.');
      await invalidateCatalogueQueries(queryClient);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Désactivation impossible.'); }
  };

  return <>
    <div className="mb-8"><p className="text-xs font-bold uppercase tracking-[.2em] text-copper">Organisation</p><h1 className="mt-1 font-display text-4xl font-semibold sm:text-5xl">Catégories</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted">Organisez les univers visibles sur la boutique et contrôlez leur ordre d’apparition.</p></div>
    {notice && <div role="status" className={`mb-6 ${/impossible|contient|invalide/i.test(notice) ? 'alert-error' : 'alert-success'}`}>{notice}</div>}
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <div className="card divide-y divide-line overflow-hidden">{categories.data?.map((category) => <div className="grid grid-cols-[64px_1fr] items-center gap-4 p-4 sm:grid-cols-[72px_1fr_auto_auto]" key={category.id}>
        <SafeImage src={category.image} alt="" width="72" height="72" className="size-16 rounded-xl bg-cream object-cover sm:size-[72px]"/>
        <div className="min-w-0"><h2 className="font-semibold">{category.name_fr} <span className="text-muted">·</span> <span dir="rtl">{category.name_ar}</span></h2><p className="mt-1 line-clamp-1 text-xs text-muted">{category.product_count} produit(s) · ordre {category.display_order}</p></div>
        <span className={`badge col-start-2 w-fit sm:col-start-auto ${category.active ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>{category.active ? 'Actif' : 'Inactif'}</span>
        <div className="col-span-2 flex justify-end gap-2 sm:col-span-1"><button className="icon-btn" onClick={() => { setEditing(category); setCategoryFile(null); }} aria-label="Modifier"><Edit3 size={16}/></button>
        <button className="icon-btn hover:!bg-red-600" onClick={() => deactivate(category)} aria-label="Désactiver"><Trash2 size={16}/></button></div>
      </div>)}</div>
      <form onSubmit={submit} className="card h-fit p-6 xl:sticky xl:top-24">
        <h2 className="font-display text-3xl font-semibold">{editing ? 'Modifier' : 'Ajouter'} une catégorie</h2>
        <div className="mt-6 space-y-4">
          <Field label="Nom français" error={errors.name_fr?.message}><input className="field" {...register('name_fr')}/></Field>
          <Field label="Nom arabe" error={errors.name_ar?.message}><input dir="rtl" className="field" {...register('name_ar')}/></Field>
          <Field label="Slug" error={errors.slug?.message}><input className="field" {...register('slug')}/></Field>
          <Field label="Description française" error={errors.description_fr?.message}><textarea className="field min-h-20 py-3" {...register('description_fr')}/></Field>
          <Field label="Description arabe" error={errors.description_ar?.message}><textarea dir="rtl" className="field min-h-20 py-3" {...register('description_ar')}/></Field>
          <label className="relative grid min-h-36 cursor-pointer place-items-center overflow-hidden rounded-xl border-2 border-dashed border-line bg-ivory p-4 text-center transition hover:border-copper"><input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setCategoryFile(event.target.files?.[0] || null)}/>{previewUrl&&<SafeImage src={previewUrl} alt="Aperçu" className="absolute inset-0 h-full w-full object-cover opacity-25"/>}<span className="relative rounded-xl bg-ivory/90 p-3"><ImagePlus className="mx-auto" size={21}/><strong className="mt-2 block text-sm">{categoryFile?.name || (previewUrl?'Remplacer l’image':'Choisir une image')}</strong><span className="text-xs text-muted">Conversion WebP automatique</span></span></label>
          <input type="hidden" {...register('image')}/>
          <Field label="Ordre d’affichage"><input type="number" className="field" {...register('display_order')}/></Field>
          <label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" className="size-5 accent-charcoal" {...register('active')}/>Active</label>
        </div>
        <button disabled={isSubmitting} className="btn-primary mt-6 w-full"><Save size={17}/>{isSubmitting ? 'Enregistrement…' : 'Enregistrer'}</button>
        {editing && <button type="button" className="mt-2 min-h-11 w-full text-sm underline" onClick={() => { setEditing(null); setCategoryFile(null); reset(defaults); }}>Annuler</button>}
      </form>
    </div>
  </>;
}

function Field({ label, error, children }: { label: string; error?: unknown; children: React.ReactNode }) { return <label><span className="label">{label}</span>{children}{typeof error==='string'&&error&&<span className="mt-1 block text-xs text-red-700">{error}</span>}</label>; }
