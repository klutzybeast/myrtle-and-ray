// Drop a JSON-LD <script> block into <head> via react-helmet-async.
// Pass any plain object (or array of objects).
import { Helmet } from "react-helmet-async";

export default function JsonLd({ data }) {
  if (!data) return null;
  const payload = JSON.stringify(data);
  return (
    <Helmet>
      <script type="application/ld+json">{payload}</script>
    </Helmet>
  );
}
