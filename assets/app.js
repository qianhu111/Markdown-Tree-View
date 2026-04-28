(() => {
  const root = document.documentElement;
  const saved = localStorage.getItem("theme");
  if (saved) root.setAttribute("data-theme", saved);

  const toggle = document.getElementById("themeToggle");
  const input = document.getElementById("searchInput");
  const dropdown = document.getElementById("searchDropdown");
  const sidebar = document.getElementById("sidebar");
  const backToTree = document.getElementById("backToTree");
  const navToolbar = document.getElementById("navToolbar");

  if (toggle) {
    toggle.addEventListener("click", () => {
      const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
    });
  }

  const navItems = [
    { text: "首页", href: "/" },
    { text: "目录", action: "tree" },
    { text: "标签", href: "/tags/index.html" }
  ];

  function enterReadingMode() {
    document.body.classList.add("reading-mode");
    if (backToTree) backToTree.classList.remove("hidden");
  }

  function exitReadingMode() {
    document.body.classList.remove("reading-mode");
    if (backToTree) backToTree.classList.add("hidden");
  }

  if (navToolbar) {
    navToolbar.innerHTML = navItems
      .map((it) => (it.href ? `<a href="${it.href}">${it.text}</a>` : `<button type="button" data-action="${it.action}">${it.text}</button>`))
      .join("");

    navToolbar.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      if (btn.dataset.action === "tree") exitReadingMode();
    });
  }

  if (backToTree) backToTree.addEventListener("click", exitReadingMode);

  const isArticlePage = !/\/index\.html?$/.test(location.pathname) && !/\/tags\/index\.html?$/.test(location.pathname);
  if (isArticlePage) enterReadingMode();

  if (sidebar) {
    const currentPath = location.pathname === "/" ? "/index.html" : location.pathname;
    const links = sidebar.querySelectorAll("a[href]");
    links.forEach((a) => {
      const href = a.getAttribute("href");
      if (href === currentPath) a.classList.add("active");
      a.addEventListener("click", () => {
        enterReadingMode();
      });
    });
  }

  async function loadSearch() {
    try {
      const res = await fetch("/search.json");
      return await res.json();
    } catch {
      return [];
    }
  }

  loadSearch().then((items) => {
    if (!input || !dropdown) return;

    function closeDropdown() {
      dropdown.classList.add("hidden");
      dropdown.innerHTML = "";
    }

    const render = (kw) => {
      const q = kw.trim().toLowerCase();
      if (!q) {
        closeDropdown();
        return;
      }
      const top = items
        .filter((it) => (it.title + " " + (it.content || "")).toLowerCase().includes(q))
        .slice(0, 12);

      dropdown.innerHTML = top.length
        ? top.map((it) => `<a href="${it.path}">${it.title}</a>`).join("")
        : '<a href="#" aria-disabled="true">无匹配结果</a>';
      dropdown.classList.remove("hidden");
    };

    input.addEventListener("input", (e) => render(e.target.value));
    input.addEventListener("focus", () => render(input.value));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeDropdown();
    });

    dropdown.addEventListener("click", (e) => {
      const link = e.target.closest("a[href]");
      if (!link || link.getAttribute("aria-disabled") === "true") {
        e.preventDefault();
        return;
      }
      closeDropdown();
    });

    document.addEventListener("click", (e) => {
      const inside = e.target.closest(".search-wrap");
      if (!inside) closeDropdown();
    });
  });
})();
