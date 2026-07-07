import PlanoraLogo from "@/components/brand/PlanoraLogo";

interface BrandLogoProps {
  title: string;
  subtitle?: string;
}

export default function BrandLogo({ title, subtitle }: BrandLogoProps) {
  return (
    <div className="flex flex-col items-center gap-3 mb-8">
      <PlanoraLogo
        width={180}
        style={{ filter: "drop-shadow(0 4px 16px rgba(152,16,250,0.18))" }}
      />
      <h1 className="text-[22px] font-bold text-gray-900 tracking-tight mt-1">
        {title}
      </h1>
      {subtitle ? (
        <p className="text-sm text-gray-400 text-center">{subtitle}</p>
      ) : null}
    </div>
  );
}
