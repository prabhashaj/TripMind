"use client";

import { useState } from "react";

export function TravelImage({ src, alt, className = "", ...props }: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [failed, setFailed] = useState(false);
  return <img src={failed ? "/placeholder-travel.jpg" : src} alt={alt} className={className} onError={() => setFailed(true)} {...props} />;
}
