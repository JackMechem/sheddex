/* eslint-disable @next/next/no-img-element -- a user's uploaded banner, from Convex storage */
import { type BannerValue, bannerPreset } from "@/lib/banners";

/** A profile's banner strip: their uploaded image, or a built-in design. Fills its box; give it a
    height with `className`. */
export default function ProfileBanner({ banner, className = "" }: { banner: BannerValue; className?: string }) {
  if (banner && "url" in banner) {
    return (
      <div className={`relative overflow-hidden bg-surface-hover ${className}`}>
        <img src={banner.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
      </div>
    );
  }
  const preset = bannerPreset(banner && "preset" in banner ? banner.preset : null);
  return <div className={`relative overflow-hidden ${className}`} style={preset.style} />;
}
