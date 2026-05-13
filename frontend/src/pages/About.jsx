import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function About() {
  const [content, setContent] = useState({});
  useEffect(() => { api.get("/pages/about").then(({ data }) => setContent(data.content || {})); }, []);
  return (
    <main className="pt-24 pb-12 bg-[#fff9f0] min-h-screen" data-testid="about-page">
      <div className="max-w-5xl mx-auto px-4 md:px-6">
        <header className="text-center mb-10">
          <h1 className="font-accent text-5xl md:text-6xl font-bold">About the Book</h1>
          <p className="text-[#4a5568] mt-3 max-w-3xl mx-auto text-lg">{content.intro}</p>
        </header>
        <div className="grid sm:grid-cols-2 gap-6 mb-10">
          {(content.authors || []).map((a) => (
            <div key={a.name} className="card-soft p-6" data-testid={`author-${a.name.split(" ")[0].toLowerCase()}`}>
              <h3 className="font-accent text-2xl font-bold">{a.name}</h3>
              <p className="text-[#4a5568] mt-2 leading-relaxed">{a.bio}</p>
            </div>
          ))}
        </div>
        <section className="card-soft p-6 mb-10">
          <h3 className="font-accent text-xl font-bold mb-2">Why We Wrote This Book</h3>
          <p className="text-[#4a5568] leading-relaxed">{content.why_we_wrote}</p>
        </section>
        <section className="text-center text-[#4a5568] py-6 border-t-2 border-dashed border-[#fde6c8]">
          <div className="font-accent text-xl font-bold text-[#2e3a3a]">{content.publisher}</div>
          <div className="mt-1">{content.editor}</div>
        </section>
      </div>
    </main>
  );
}
