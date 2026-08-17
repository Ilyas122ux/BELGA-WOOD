import type { ApiResponse, CloudinaryImage } from '@jad-home/shared';

export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }

export async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const isForm = options.body instanceof FormData;
  const response = await fetch(url, {
    credentials: 'include',
    ...options,
    headers: isForm ? options.headers : { 'Content-Type': 'application/json', ...options.headers },
  });
  const payload = await response.json().catch(() => ({ success: false, message: 'Réponse serveur invalide.', data: null })) as ApiResponse<T>;
  if (!response.ok || !payload.success) throw new ApiError(payload.message || 'La requête a échoué.', response.status);
  return payload.data;
}

export function queryString(values: Record<string, unknown>): string {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && value !== false) params.set(key, String(value));
  });
  const result = params.toString();
  return result ? `?${result}` : '';
}

type UploadSignature = {
  signatureVersion?: number;
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  publicId: string;
  maxBytes: number;
  allowedFormats: string[];
};

export async function uploadImageToCloudinary(file: File, folder: 'products' | 'categories', displayOrder = 0): Promise<CloudinaryImage> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new ApiError('Format image non autorise.', 400);
  const signature = await api<UploadSignature>('/api/admin/cloudinary/signature', {
    method: 'POST',
    body: JSON.stringify({ folder }),
  });
  if (file.size > signature.maxBytes) throw new ApiError('Une image depasse 8 Mo.', 400);
  if (signature.signatureVersion !== 2 || signature.publicId.includes('/')) {
    throw new ApiError('Ancienne signature Cloudinary detectee. Redemarrez le serveur API puis reessayez.', 409);
  }
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', signature.apiKey);
  form.append('timestamp', String(signature.timestamp));
  form.append('signature', signature.signature);
  form.append('folder', signature.folder);
  form.append('public_id', signature.publicId);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`, { method: 'POST', body: form });
  const payload = await response.json();
  if (!response.ok) throw new ApiError(payload?.error?.message || 'Upload Cloudinary impossible.', response.status);
  return {
    publicId: payload.public_id,
    secureUrl: payload.secure_url,
    width: payload.width,
    height: payload.height,
    format: payload.format,
    bytes: payload.bytes,
    altFr: file.name.replace(/\.[^.]+$/, ''),
    altAr: '',
    displayOrder,
  };
}
