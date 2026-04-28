(() => {
  const root = document.documentElement;
  const saved = localStorage.getItem("theme");
  if (saved) root.setAttribute("data-theme", saved);

  const toggle = document.getElementById("themeToggle");
  if (toggle) {
    toggle.addEventListener("click", () => {
      const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
    });
  }

  const input = document.getElementById("searchInput");
  const output = document.getElementById("searchResult");

  async function loadSearch() {
    try {
      const res = await fetch("/search.json");
      return await res.json();
    } catch {
      return [];
    }
  }

  function highlight(text, key) {
    if (!key) return text;
    const escaped = key.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
    return text.replace(new RegExp(`(${escaped})`, "ig"), "<mark>$1</mark>");
  }

  loadSearch().then((items) => {
    if (!input || !output) return;

    const render = (kw) => {
      const q = kw.trim().toLowerCase();
      if (!q) {
        output.innerHTML = "";
        return;
      }
      const top = items
        .filter((it) => (it.title + " " + (it.content || "")).toLowerCase().includes(q))
        .slice(0, 20);

      output.innerHTML = top.length
        ? top
            .map(
              (it) => `<div><a href="${it.path}">${highlight(it.title, kw)}</a><p>${highlight((it.content || "").slice(0, 80), kw)}</p></div>`
            )
            .join("")
        : "<p>无匹配结果</p>";
    };

    input.addEventListener("input", (e) => render(e.target.value));
  });
})();
