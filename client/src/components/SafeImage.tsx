import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import { imageUrl, type ProductImage } from '@jad-home/shared';

type SafeImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src?: string | ProductImage;
  fallback?: string;
};

export function SafeImage({ src, fallback = '/jad-home-icon-v3.png', alt, onError, ...props }: SafeImageProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const original = typeof src === 'string' ? src : imageUrl(src);
  const resolved = !original || failed ? fallback : original;

  return <img
    {...props}
    src={resolved}
    alt={alt}
    loading={props.loading || 'lazy'}
    decoding={props.decoding || 'async'}
    onError={(event) => {
      if (!failed) setFailed(true);
      onError?.(event);
    }}
  />;
}
