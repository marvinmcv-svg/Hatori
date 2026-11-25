/* Public backend config. The Supabase *publishable* key is designed to be
   public (row-level security limits it). Never put the service-role key here.
   Leave supabaseUrl empty to run without backend: WhatsApp ordering still works. */
(function (root) {
  "use strict";
  const CONFIG = {
    supabaseUrl: "",          // e.g. https://xxxx.supabase.co   (needs owner input)
    supabaseKey: "",          // publishable key (sb_publishable_…)
    siteUrl: "https://hattori.vercel.app",
    trackPath: "/seguimiento/",
  };
  if (typeof module !== "undefined" && module.exports) module.exports = CONFIG;
  else root.HATTORI_CONFIG = CONFIG;
})(typeof window !== "undefined" ? window : globalThis);
