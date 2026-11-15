// Server-safe: imported by app/layout.tsx (a server component).
export const THEME_KEY = "dp-theme";

/** Runs in <head> before React: no flash of the wrong theme. */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t}catch(e){document.documentElement.dataset.theme="light"}})();`;
