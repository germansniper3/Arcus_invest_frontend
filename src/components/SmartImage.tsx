import { useState } from 'react';

export function SmartImage({ src, alt, className, style }: { src: string; alt: string; className?: string; style?: React.CSSProperties }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className={`image-fallback ${className ?? ''}`} style={style} role="img" aria-label={alt} />;
  return <img src={src} alt={alt} className={className} style={style} onError={() => setFailed(true)} />;
}
