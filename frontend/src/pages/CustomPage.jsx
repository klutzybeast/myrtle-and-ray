import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import { renderBlock } from "./admin/BlockPreview";
import SEO from "../components/SEO";
import Lightbox from "../components/Lightbox";

export default function CustomPage() {
  const { slug } = useParams();
  const [page, setPage] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  useEffect(() => {
    setPage(null);
    api.get(`/custom-pages/${slug}`).then(({ data }) => setPage(data)).catch(() => setPage("notfound"));
  }, [slug]);

  if (!page) return <main className="pt-24 text-center text-[#5a6b76]">Loading...</main>;
  if (page === "notfound") return <main className="pt-24 text-center"><div className="font-accent text-3xl">This page can't be found.</div></main>;

  return (
    <main className="pt-24 pb-12 bg-foam-grad min-h-screen" data-testid="custom-page-public">
      <SEO title={page.seo_title || page.title} description={page.meta_description || page.intro || ""} image={page.og_image || page.hero_image} />
      {page.hero_image && (
        <div className="max-w-7xl mx-auto px-4 md:px-6 mb-8">
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="rounded-[28px] overflow-hidden shadow-2xl border-4 border-white block w-full cursor-zoom-in"
            data-testid="custom-page-hero"
            aria-label="View larger image"
          >
            <img src={page.hero_image} alt={page.title} className="w-full h-auto block" />
          </button>
          {lightboxOpen && <Lightbox images={[page.hero_image]} index={0} onClose={() => setLightboxOpen(false)} alt={page.title} />}
        </div>
      )}
      <header className="text-center mb-8 max-w-3xl mx-auto px-4">
        <h1 className="font-accent text-5xl md:text-6xl font-bold">{page.title}</h1>
        {page.meta_description && <p className="text-[#5a6b76] mt-3 text-lg">{page.meta_description}</p>}
      </header>
      <article className="max-w-4xl mx-auto px-4 md:px-6 space-y-6">
        {(page.blocks || []).map((b, i) => <div key={b.id || i}>{renderBlock(b)}</div>)}
      </article>
    </main>
  );
}
