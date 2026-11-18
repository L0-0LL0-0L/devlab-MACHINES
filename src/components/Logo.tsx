import wordmark from "@/assets/biocraft_wordmark.png.asset.json";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center ${className ?? ""}`}>
      <img src={wordmark.url} alt="biocraft" className="h-7 w-auto" width={143} height={28} />
    </span>
  );
}
