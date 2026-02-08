export default function ThemeInitScript() {
  // Inline script: apply saved theme before paint (prevents flash)
  const code = `(function(){try{var k='vegetables-shop-theme';var t=localStorage.getItem(k);var d=(t==='dark');var el=document.documentElement;el.classList.toggle('dark',!!d);}catch(e){}})();`;

  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}

