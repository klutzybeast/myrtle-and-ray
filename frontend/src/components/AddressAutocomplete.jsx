// Lightweight Google Places Autocomplete input.
// Loads the Maps JS script once per page. Falls back to a plain
// input if the script fails or the API key is missing, so checkout
// is never blocked.
import { useEffect, useRef, useState } from "react";

const API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
const SCRIPT_ID = "google-maps-places-script";

let scriptLoadingPromise = null;

function loadGoogleMapsScript() {
  if (!API_KEY) return Promise.reject(new Error("No Google Maps key"));
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.google?.maps?.places?.Autocomplete) return Promise.resolve(window.google);
  if (scriptLoadingPromise) return scriptLoadingPromise;
  scriptLoadingPromise = new Promise((resolve, reject) => {
    const finishWhenReady = async () => {
      // The script may resolve before the `places` library has imported.
      // The modern API exposes `importLibrary` — use it when present.
      try {
        if (window.google?.maps?.importLibrary) {
          await window.google.maps.importLibrary("places");
        }
        // Poll briefly as a backstop (max ~3s)
        for (let i = 0; i < 30 && !window.google?.maps?.places?.Autocomplete; i++) {
          await new Promise((r) => setTimeout(r, 100));
        }
        if (!window.google?.maps?.places?.Autocomplete) throw new Error("Places library never loaded");
        resolve(window.google);
      } catch (err) {
        reject(err);
      }
    };

    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", finishWhenReady);
      existing.addEventListener("error", reject);
      // If the script already loaded before this hook ran:
      if (window.google?.maps) finishWhenReady();
      return;
    }
    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places&v=weekly`;
    s.async = true;
    s.defer = true;
    s.onload = finishWhenReady;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return scriptLoadingPromise;
}

function parseAddressComponents(place) {
  const c = place.address_components || [];
  const get = (type, useShort = false) => {
    const found = c.find((x) => x.types.includes(type));
    return found ? (useShort ? found.short_name : found.long_name) : "";
  };
  const streetNumber = get("street_number");
  const route = get("route");
  const line1 = [streetNumber, route].filter(Boolean).join(" ") || place.name || "";
  const city = get("locality") || get("postal_town") || get("sublocality_level_1") || get("administrative_area_level_2");
  const state = get("administrative_area_level_1", true);
  const postal = get("postal_code");
  const country = get("country", true);
  return { line1, city, state, postal_code: postal, country };
}

export default function AddressAutocomplete({
  value,
  onChange,
  onPlaceSelected,
  placeholder = "Start typing your address",
  className = "",
  testid = "address-autocomplete",
  countries = ["us"],
}) {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMapsScript()
      .then(() => { if (!cancelled) setReady(true); })
      .catch(() => { /* silent — fall back to plain input */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ready || !inputRef.current || autocompleteRef.current) return;
    const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ["address"],
      componentRestrictions: { country: countries },
      fields: ["address_components", "formatted_address", "name"],
    });
    ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      if (!place || !place.address_components) return;
      const parsed = parseAddressComponents(place);
      onPlaceSelected?.(parsed);
    });
    autocompleteRef.current = ac;
    // Prevent the Enter key from submitting the form when picking a suggestion
    const blockEnter = (e) => { if (e.key === "Enter") e.preventDefault(); };
    inputRef.current.addEventListener("keydown", blockEnter);
    return () => {
      try { window.google.maps.event.clearInstanceListeners(ac); } catch {}
      autocompleteRef.current = null;
    };
  }, [ready, countries, onPlaceSelected]);

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      autoComplete="off"
      className={className}
      data-testid={testid}
    />
  );
}
