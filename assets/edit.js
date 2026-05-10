(() => {
  const REL = window.__EDIT_REL__ || "";
  const ARTICLE_URL = window.__ARTICLE_URL__ || "/";

  const root = document.documentElement;
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme) root.setAttribute("data-theme", savedTheme);
  const themeToggle = document.getElementById("themeToggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
    });
  }

  const tabs = document.querySelectorAll(".editor-tabs .tab");
  const panes = {
    edit: document.querySelector('[data-pane="edit"]'),
    preview: document.querySelector('[data-pane="preview"]')
  };
  const ta = document.getElementById("editorTextarea");
  const previewBody = document.getElementById("previewBody");
  const statusEl = document.getElementById("editorStatus");
  const saveBtn = document.getElementById("saveBtn");

  let dirty = false;
  let activeTab = "edit";
  let lastPreviewedContent = null;

  function setStatus(text, kind) {
    statusEl.textContent = text || "";
    statusEl.dataset.kind = kind || "";
  }

  function setDirty(d) {
    dirty = d;
    saveBtn.disabled = !d;
    if (d) setStatus("有未保存修改", "dirty");
    else setStatus("");
  }

  async function renderPreview() {
    const content = ta.value;
    if (lastPreviewedContent === content && previewBody.dataset.rendered === "1") return;
    previewBody.innerHTML = '<p class="muted">渲染中…</p>';
    try {
      const res = await fetch("/edit/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rel: REL, content })
      });
      const out = await res.json();
      if (!out.ok) throw new Error(out.error || "preview failed");
      previewBody.innerHTML = out.html;
      previewBody.dataset.rendered = "1";
      lastPreviewedContent = content;
    } catch (err) {
      previewBody.innerHTML = '<p class="muted">预览失败：' + (err.message || err) + "</p>";
    }
  }

  function switchTab(name) {
    if (name === activeTab) return;
    activeTab = name;
    tabs.forEach((t) => {
      const on = t.dataset.tab === name;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });
    Object.entries(panes).forEach(([k, el]) => el.classList.toggle("hidden", k !== name));
    if (name === "preview") renderPreview();
  }

  tabs.forEach((t) => t.addEventListener("click", () => switchTab(t.dataset.tab)));

  ta.addEventListener("input", () => {
    setDirty(true);
    previewBody.dataset.rendered = "";
  });

  async function save() {
    if (!dirty) return;
    saveBtn.disabled = true;
    setStatus("保存中…", "saving");
    try {
      const res = await fetch("/edit/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ file: REL, content: ta.value })
      });
      const out = await res.json();
      if (!out.ok) throw new Error(out.error || "save failed");
      setStatus("已保存，跳转中…", "saved");
      // 跳回文章页查看效果
      window.location.href = out.articleUrl || ARTICLE_URL;
    } catch (err) {
      setStatus("保存失败：" + (err.message || err), "error");
      saveBtn.disabled = false;
    }
  }

  saveBtn.addEventListener("click", save);

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      save();
    }
  });

  window.addEventListener("beforeunload", (e) => {
    if (dirty) { e.preventDefault(); e.returnValue = ""; }
  });

  saveBtn.disabled = true;
})();
