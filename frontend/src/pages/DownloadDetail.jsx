import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useSite } from "../lib/site";
import DownloadCard from "../components/DownloadCard";
import EmailCaptureModal from "../components/EmailCaptureModal";
import { FileText, Download as DLIcon, Printer, Share2, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export default function DownloadDetail() {
  const { slug } = useParams();
  const site = useSite();
  const [data, setData] = useState(null);
  const [showGate, setShowGate] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [chars, setChars] = useState([]);

  useEffect(() => {
    setData(null);
    api.get(`/downloads/${slug}`).then(({ data }) => setData(data)).catch(() => setData("notfound"));
    api.get("/characters").then(({ data }) => setChars(data));
  }, [slug]);

  if (!data) return <main className="pt-24 text-center">Loading...</main>;
  if (data === "notfound") return <main className="pt-24 text-center">Download not found.</main>;

  const d = data.download;
  const char = chars.find((c) => c.slug === d.character_slug);
  const gate = d.email_gate_override == null ? site.email_gate_enabled : d.email_gate_override;

  const triggerDownload = (file) => {
    api.post(`/downloads/${slug}/track`).catch(() => {});
    if (file?.url) {
      const a = document.createElement("a");
      a.href = file.url.startsWith("http") ? file.url : `${process.env.REACT_APP_BACKEND_URL}${file.url}`;
      a.download = file.filename || d.title;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Your download is starting!");
    }
  };

  const onDownloadClick = (file) => {
    if (gate) { setPendingFile(file); setShowGate(true); }
    else triggerDownload(file);
  };

  return (
    <main className="pt-24 pb-12 bg-[#fffbf3] min-h-screen" data-testid="download-detail-page">
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        <nav className="text-sm text-[#6b7280] mb-4 flex items-center gap-1 flex-wrap">
          <Link to="/">Home</Link><ChevronRight className="w-4 h-4" />
          <Link to="/downloads">Downloads</Link><ChevronRight className="w-4 h-4" />
          <span className="text-[#2e3a3a] font-semibold">{d.title}</span>
        </nav>

        <div className="grid lg:grid-cols-2 gap-10">
          <div className="aspect-[4/3] bg-[#eef9fb] rounded-[28px] overflow-hidden">
            {d.cover_image ? <img src={d.cover_image} alt={d.title} className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center"><FileText className="w-16 h-16 text-[#8fbfe0]" /></div>}
          </div>
          <div>
            <h1 className="font-accent text-4xl md:text-5xl font-bold leading-tight" data-testid="download-title">{d.title}</h1>
            <div className="flex flex-wrap gap-2 mt-3">
              {d.is_new && <span className="bg-[#f0a988] text-white text-xs font-bold uppercase px-2 py-1 rounded-full">New</span>}
              {(d.audiences || []).map((a) => <span key={a} className="bg-[#eef9fb] text-[#5a8a6f] text-xs font-bold uppercase px-2 py-1 rounded-full">{a}</span>)}
              {(d.wave_values || []).map((w) => <span key={w} className="bg-[#fff5ec] text-[#e89bab] text-xs font-bold uppercase px-2 py-1 rounded-full">{w}</span>)}
            </div>
            {char && (
              <Link to={`/story#${char.slug}`} className="mt-3 inline-flex items-center gap-2 text-sm text-[#7cbf94] font-semibold">
                <div className="gradient-ring" style={{ width: 32, height: 32 }}><img src={char.image_url} alt="" className="w-full h-full rounded-full object-cover bg-white" /></div>
                Featuring {char.name}
              </Link>
            )}
            <p className="text-[#4a5568] mt-4 text-lg leading-relaxed whitespace-pre-line">{d.long_description || d.short_description}</p>
            <div className="mt-2 text-sm text-[#6b7280]">Age range: {d.age_range || "Ages 3-8"}</div>

            <div className="mt-6 space-y-2" data-testid="download-files">
              {(d.files || []).map((f, i) => (
                <button key={i} onClick={() => onDownloadClick(f)} className="w-full flex items-center justify-between p-4 rounded-2xl bg-[#fffbf3] border-2 border-[#f4e4c6] hover:border-[#7fcfc7] transition" data-testid={`download-file-${i}`}>
                  <div className="flex items-center gap-3">
                    <FileText className="w-6 h-6 text-[#f0a988]" />
                    <div className="text-left">
                      <div className="font-bold text-[#2e3a3a]">{f.label || f.filename || `File ${i + 1}`}</div>
                      <div className="text-xs text-[#6b7280]">{f.page_count ? `${f.page_count} page${f.page_count > 1 ? "s" : ""}` : f.mime}{f.size_kb ? ` · ${(f.size_kb / 1024).toFixed(1)} MB` : ""}</div>
                    </div>
                  </div>
                  <span className="btn-primary py-2 px-4 text-sm"><DLIcon className="w-4 h-4" />Download</span>
                </button>
              ))}
              {(!d.files || d.files.length === 0) && <div className="text-[#6b7280] text-sm">No files attached yet.</div>}
            </div>

            <div className="mt-6 flex gap-3 flex-wrap">
              <button onClick={() => window.print()} className="btn-ghost"><Printer className="w-5 h-5" />Print this page</button>
              <button onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link copied"); }} className="btn-ghost"><Share2 className="w-5 h-5" />Share</button>
            </div>
          </div>
        </div>

        {data.related?.length > 0 && (
          <section className="mt-16">
            <h2 className="font-accent text-3xl font-bold mb-6">More like this</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {data.related.map((r) => <DownloadCard key={r.slug} d={r} characterImage={chars.find((c) => c.slug === r.character_slug)?.image_url} />)}
            </div>
          </section>
        )}
      </div>

      <EmailCaptureModal
        open={showGate}
        onClose={() => setShowGate(false)}
        downloadSlug={d.slug}
        downloadTitle={d.title}
        onSuccess={() => triggerDownload(pendingFile)}
      />
    </main>
  );
}
