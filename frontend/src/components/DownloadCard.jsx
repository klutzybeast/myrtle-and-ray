import { Link } from "react-router-dom";
import { FileText, Sparkles } from "lucide-react";

export default function DownloadCard({ d, characterImage }) {
  return (
    <Link to={`/downloads/${d.slug}`} className="card-soft block overflow-hidden group" data-testid={`download-card-${d.slug}`}>
      <div className="aspect-[4/3] bg-[#eef9fb] relative overflow-hidden">
        {d.cover_image ? <img src={d.cover_image} alt={d.title} loading="lazy" className="w-full h-full object-contain group-hover:scale-105 transition" /> : <div className="w-full h-full grid place-items-center text-[#8fbfe0] font-accent text-2xl"><FileText className="w-12 h-12" /></div>}
        {d.is_new && <span className="absolute top-3 left-3 bg-[#f0a988] text-white text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full" data-testid="download-new-badge"><Sparkles className="w-3 h-3 inline mr-1" />New</span>}
        {characterImage && <div className="absolute -bottom-4 right-4 portrait-pill" style={{ width: 56, height: 56 }}><img src={characterImage} alt="" /></div>}
      </div>
      <div className="p-5">
        <h3 className="font-accent text-lg font-bold leading-tight text-[#2e3a3a]" data-testid={`download-title-${d.slug}`}>{d.title}</h3>
        <p className="text-sm text-[#4a5568] mt-1 line-clamp-2">{d.short_description}</p>
        <div className="flex flex-wrap gap-1 mt-3">
          {(d.audiences || []).slice(0, 3).map((a) => (
            <span key={a} className="text-[10px] font-bold uppercase tracking-wider bg-[#eef9fb] text-[#5a8a6f] px-2 py-1 rounded-full">{a}</span>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-[#6b7280]">
          <span>{d.age_range || "Ages 3-8"}</span>
          <span className="btn-primary text-sm py-2 px-4">Get It Free →</span>
        </div>
      </div>
    </Link>
  );
}
