import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";

export default function CustomPage() {
  const { slug } = useParams();
  const [page, setPage] = useState(null);
  useEffect(() => {
    setPage(null);
    api.get(`/custom-pages/${slug}`).then(({ data }) => setPage(data)).catch(() => setPage("notfound"));
  }, [slug]);

  if (!page) return <main className="pt-24 text-center text-[#5a6b76]">Loading...</main>;
  if (page === "notfound") return <main className="pt-24 text-center"><div className="font-accent text-3xl">This page can't be found.</div></main>;

  return (
    <main className="pt-24 pb-12 bg-foam-grad min-h-screen" data-testid="custom-page-public">
      {page.hero_image && (
        <div className="max-w-7xl mx-auto px-4 md:px-6 mb-8">
          <div className="rounded-[28px] overflow-hidden shadow-2xl border-4 border-white">
            <img src={page.hero_image} alt={page.title} className="w-full h-auto block" />
          </div>
        </div>
      )}
      <header className="text-center mb-8 max-w-3xl mx-auto px-4">
        <h1 className="font-accent text-5xl md:text-6xl font-bold">{page.title}</h1>
        {page.meta_description && <p className="text-[#5a6b76] mt-3 text-lg">{page.meta_description}</p>}
      </header>

      <article className="max-w-4xl mx-auto px-4 md:px-6 space-y-6">
        {(page.blocks || []).map((b) => <Block key={b.id} block={b} />)}
      </article>
    </main>
  );
}

function alignClass(a) {
  return a === "center" ? "text-center" : a === "right" ? "text-right" : "text-left";
}

function Block({ block }) {
  const d = block.data || {};
  switch (block.type) {
    case "heading": {
      const Tag = `h${d.level || 2}`;
      const size = (d.level || 2) === 1 ? "text-4xl md:text-5xl" : (d.level || 2) === 2 ? "text-3xl md:text-4xl" : "text-2xl md:text-3xl";
      return <Tag className={`font-accent font-bold ${size} ${alignClass(d.align)}`}>{d.text}</Tag>;
    }
    case "paragraph": {
      const paras = (d.text || "").split(/\n\n+/);
      return (
        <div className={`text-lg leading-relaxed text-[#3a4a55] space-y-3 ${alignClass(d.align)}`}>
          {paras.map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}
        </div>
      );
    }
    case "image": {
      const widthCls = d.width === "narrow" ? "max-w-xl mx-auto" : d.width === "wide" ? "max-w-5xl mx-auto" : "";
      return (
        <figure className={widthCls}>
          {d.src && <img src={d.src} alt={d.alt || ""} loading="lazy" className="w-full rounded-2xl shadow-md" />}
          {d.caption && <figcaption className="text-center text-sm text-[#5a6b76] mt-2">{d.caption}</figcaption>}
        </figure>
      );
    }
    case "gallery": {
      const cols = d.columns || 3;
      const colCls = cols === 2 ? "sm:grid-cols-2" : cols === 4 ? "sm:grid-cols-2 md:grid-cols-4" : "sm:grid-cols-2 md:grid-cols-3";
      return (
        <div className={`grid grid-cols-2 ${colCls} gap-3`} data-testid="gallery-block">
          {(d.items || []).map((it, i) => (
            <figure key={i} className="overflow-hidden rounded-2xl shadow-sm">
              {it.src && <img src={it.src} alt={it.alt || ""} loading="lazy" className="w-full aspect-square object-cover hover:scale-105 transition" />}
              {it.caption && <figcaption className="text-xs text-center text-[#5a6b76] py-2 bg-white">{it.caption}</figcaption>}
            </figure>
          ))}
        </div>
      );
    }
    case "video":
      if (!d.url) return null;
      return (
        <figure>
          <div className="aspect-video rounded-2xl overflow-hidden shadow-md bg-black">
            <iframe src={d.url} title={d.caption || "Video"} className="w-full h-full" frameBorder="0" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
          </div>
          {d.caption && <figcaption className="text-center text-sm text-[#5a6b76] mt-2">{d.caption}</figcaption>}
        </figure>
      );
    case "button": {
      const cls = d.style === "secondary" ? "btn-secondary" : d.style === "ghost" ? "btn-ghost" : "btn-primary";
      return (
        <div className={alignClass(d.align)}>
          <a href={d.href || "#"} target={(d.href || "").startsWith("http") ? "_blank" : "_self"} rel="noopener noreferrer" className={cls}>{d.label || "Button"}</a>
        </div>
      );
    }
    case "quote":
      return (
        <blockquote className="border-l-4 border-[#fcd5b4] pl-5 italic text-xl text-[#3a4a55]">
          “{d.text}”
          {d.author && <footer className="text-sm not-italic text-[#5a6b76] mt-2">— {d.author}</footer>}
        </blockquote>
      );
    case "spacer":
      return <div style={{ height: d.height || 32 }} />;
    case "html":
      return <div dangerouslySetInnerHTML={{ __html: d.html || "" }} />;
    default:
      return null;
  }
}
