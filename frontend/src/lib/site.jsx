import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";

const SiteCtx = createContext({});

export function SiteProvider({ children }) {
  const [site, setSite] = useState({
    site_name: "Myrtle and Ray",
    tagline: "Catch the W.A.V.E. of Excitement",
    amazon_book_url: "",
    printify_popup_url: "",
    email_gate_enabled: true,
  });

  useEffect(() => {
    api.get("/site").then(({ data }) => setSite((s) => ({ ...s, ...data }))).catch(() => {});
  }, []);

  return <SiteCtx.Provider value={site}>{children}</SiteCtx.Provider>;
}

export function useSite() { return useContext(SiteCtx); }
