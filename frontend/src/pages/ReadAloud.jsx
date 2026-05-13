import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function ReadAloud() {
  const [content, setContent] = useState({});
  useEffect(() => { api.get("/pages/read_aloud").then(({ data }) => setContent(data.content || {})); }, []);
  return (
    <main className="pt-24 pb-12 bg-foam-grad min-h-screen" data-testid="read-aloud-page">
      <div className="max-w-5xl mx-auto px-4 md:px-6">
        <header className="text-center mb-10">
          <h1 className="font-accent text-5xl md:text-6xl font-bold">Read Aloud</h1>
          <p className="text-[#4a5568] mt-2 max-w-2xl mx-auto">{content.intro || "Press play and ride the wave with us."}</p>
        </header>
        <div className="aspect-video rounded-[28px] overflow-hidden bg-[#eef9fb] shadow-2xl" data-testid="read-aloud-video">
          {content.video_url ? (
            <iframe title="Read Aloud" src={content.video_url} className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen />
          ) : (
            <div className="w-full h-full grid place-items-center text-[#4a5568]">
              <div className="text-center">
                <div className="text-6xl mb-2">🎬</div>
                <div className="font-accent text-2xl">Read-aloud video coming soon</div>
                <div className="text-sm mt-1 text-[#6b7280]">The owner can paste a YouTube/Vimeo URL in Admin → Pages.</div>
              </div>
            </div>
          )}
        </div>
        <section className="card-cream p-6 md:p-8 mt-10">
          <h3 className="font-accent text-xl font-bold mb-2">A note for grown-ups</h3>
          <p className="text-[#4a5568] leading-relaxed">{content.parent_note}</p>
        </section>
      </div>
    </main>
  );
}
