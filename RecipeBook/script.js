// /RecipeBook/script.js

// Initialise Dexie DB — bumped version to 3 to force rebuild
const db = new Dexie("RecipeBookDB");
db.version(3).stores({
  ingredients: "id, description, type, unit, storage",
  collections: "id, description, type, methodBasic, methodDetailed",
  quantities: "++id, collectionId, ingredientId, quantity",
  schedule: "day, easyId, lessEasyId"
});

// Helper: fetch JSON from /RecipeBook/data/ with cache-busting
async function fetchJSON(filename) {
  const cacheBuster = `?t=${Date.now()}`;
  const res = await fetch(`./data/${filename}${cacheBuster}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${filename} (HTTP ${res.status})`);
  return res.json();
}

document.addEventListener("DOMContentLoaded", async () => {
  console.log("RecipeBook script loaded v4");
  const statusEl  = document.getElementById("status");
  const contentEl = document.getElementById("content");
  const listEl    = document.getElementById("recipe-list");

  // Sidebar/menu elements
  const menuToggleEl = document.getElementById("menu-toggle");
  const sidebarEl    = document.getElementById("sidebar");
  const VIEWS = ["suggestions", "recipes", "schedule", "pantry"];

  // === UI helpers for feed + panel (no inline styles; style in CSS) ===
  const feedEl = ensureFeed();
  const { panelEl, panelBodyEl } = ensurePanel();

  function showMessage(html) {
    feedEl.innerHTML = `<p>${html}</p>`;
    feedEl.hidden = false;
    listEl.hidden = true;
  }

  function showList() {
    feedEl.hidden = true;
    listEl.hidden = false;
  }

  function ensureFeed() {
    let el = document.getElementById("feed");
    if (!el) {
      el = document.createElement("div");
      el.id = "feed";
      listEl.insertAdjacentElement("beforebegin", el);
    }
    el.hidden = true;
    return el;
  }

  function ensurePanel() {
    let panel = document.getElementById("recipe-panel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "recipe-panel";
      panel.hidden = true;
      panel.innerHTML = `
        <div class="rb-panel">
          <button id="panel-close" aria-label="Close">&times;</button>
          <div id="panel-body"></div>
        </div>
      `;
      document.body.appendChild(panel);
      panel.querySelector("#panel-close").onclick = () => (panel.hidden = true);
      panel.addEventListener("click", (e) => {
        if (e.target === panel) panel.hidden = true;
      });
    }
    return {
      panelEl: panel,
      panelBodyEl: panel.querySelector("#panel-body"),
    };
  }

  // === NEW: Helpers to resolve <placeholders> in method text ===
  function buildTypeLookup(qs, ings) {
    const byType = new Map(); // type -> first description seen in this recipe
    for (const q of qs) {
      const ing = ings.find(i => i?.id === q.ingredientId);
      if (!ing?.type || !ing?.description) continue;
      const t = String(ing.type).toLowerCase();
      if (!byType.has(t)) byType.set(t, ing.description);
    }
    return byType;
  }

  function normalizePlaceholder(name) {
    const n = String(name).toLowerCase();
    const map = {
      protein: "protein", proteins: "protein",
      base: "base", carb: "base", carbs: "base", starch: "base",
      veg: "veg", veggie: "veg", veggies: "veg", vegetable: "veg", vegetables: "veg",
      flavour: "flavour", flavor: "flavour",
      function: "function", sauce: "sauce"
    };
    return map[n] ?? n;
  }

  function resolvePlaceholders(text, typeLookup) {
    if (!text) return "";
    return text.replace(/<([\w-]+)>/g, (_, token) => {
      const key = normalizePlaceholder(token);
      return typeLookup.get(key) ?? `<${token}>`;
    });
  }

  async function openRecipePanel(collectionId) {
    const recipe = await db.collections.get(collectionId);
    if (!recipe) return;

    const qs = await db.quantities.where("collectionId").equals(collectionId).toArray();
    const ingIds = [...new Set(qs.map(q => q.ingredientId))];
    const ings = await db.ingredients.bulkGet(ingIds);

    const items = qs.map(q => {
      const ing = ings.find(i => i?.id === q.ingredientId);
      const unit = ing?.unit ? ` ${ing.unit}` : "";
      const name = ing?.description ?? "Unknown ingredient";
      const qty  = q.quantity ?? "";
      return `<li>${qty}${unit} ${name}</li>`;
    }).join("");

    const typeLookup = buildTypeLookup(qs, ings);
    const methodRaw = recipe.methodDetailed ?? recipe.methodBasic ?? "";
    const methodResolved = resolvePlaceholders(methodRaw, typeLookup);

    panelBodyEl.innerHTML = `
      <h2>${recipe.description}</h2>
      ${items ? `<h3>Ingredients</h3><ul>${items}</ul>` : ""}
      ${methodResolved ? `<h3>Method</h3><p>${methodResolved}</p>` : ""}
    `;
    panelEl.hidden = false;
  }

  // === DB seeding ===
  async function seedDatabase() {
    const [ingredientCount, collectionCount, quantityCount, scheduleCount] = await Promise.all([
      db.ingredients.count(),
      db.collections.count(),
      db.quantities.count(),
      db.schedule.count()
    ]);

    if (ingredientCount === 0 || collectionCount === 0 || quantityCount === 0) {
      const [ingredients, collections, quantities] = await Promise.all([
        fetchJSON("ingredient.json"),
        fetchJSON("collection.json"),
        fetchJSON("quantity.json")
      ]);
      if (ingredientCount === 0) await db.ingredients.bulkAdd(ingredients);
      if (collectionCount === 0) await db.collections.bulkAdd(collections);
      if (quantityCount === 0) await db.quantities.bulkAdd(quantities);
    }

    if (scheduleCount === 0) {
      const scheduleData = await fetchJSON("schedule.json");
      await db.schedule.bulkAdd(scheduleData);
    }
  }

  // === Renderers ===
  async function renderToday() {
    const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const todayName = days[new Date().getDay()];
    const todaySchedule = await db.schedule.get({ day: todayName });

    if (!todaySchedule) {
      showMessage(`No schedule found for ${todayName}`);
      return;
    }

    const [easy, lessEasy] = await Promise.all([
      db.collections.get(todaySchedule.easyId),
      db.collections.get(todaySchedule.lessEasyId)
    ]);

    // Make the two options clickable (buttons styled as links)
    showMessage(
      `Today, you could make ` +
      `<button type="button" class="recipe-link" data-recipe-id="${easy.id}">${easy.description}</button>` +
      ` or ` +
      `<button type="button" class="recipe-link" data-recipe-id="${lessEasy.id}">${lessEasy.description}</button>.`
    );
  }

  async function renderRecipes() {
    const recipes = await db.collections
      .where("type")
      .anyOf("recipe","ready-meal")
      .toArray();

    showList();
    listEl.innerHTML = recipes
      .map(r => `<li><button type="button" class="recipe-link" data-recipe-id="${r.id}">${r.description}</button></li>`)
      .join("");
  }

  // === Init ===
  try {
    await seedDatabase();
    await renderToday();
  } catch (err) {
    console.error(err);
    if (statusEl) statusEl.innerHTML = `<p style="color:red;">Error: ${err.message}</p>`;
  } finally {
    if (statusEl) statusEl.style.display = "none";
    if (contentEl) contentEl.style.display = "block";
  }

  // === Event listeners (existing) ===
  document.getElementById("refresh-btn")?.addEventListener("click", async () => {
    await db.delete();
    location.reload();
  });

  document.getElementById("save-btn")?.addEventListener("click", () => {
    alert("Save functionality not yet implemented.");
  });

  let showingAlt = false;
  document.getElementById("alt-btn")?.addEventListener("click", async () => {
    const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const todayName = days[new Date().getDay()];
    const todaySchedule = await db.schedule.get({ day: todayName });

    const allMeals = await db.collections.where("type").anyOf("recipe","ready-meal").toArray();

    if (!showingAlt) {
      const filtered = todaySchedule
        ? allMeals.filter(m => m.id !== todaySchedule.easyId && m.id !== todaySchedule.lessEasyId)
        : allMeals;
      const picks = filtered.sort(() => 0.5 - Math.random()).slice(0, 2);

      showMessage(
        `How about ` +
        `<button type="button" class="recipe-link" data-recipe-id="${picks[0].id}">${picks[0].description}</button>` +
        ` or ` +
        `<button type="button" class="recipe-link" data-recipe-id="${picks[1].id}">${picks[1].description}</button>?`
      );

      document.getElementById("alt-btn").textContent =
        "You suck at this. Tell me everything you know how to cook.";
      showingAlt = true;
    } else {
      await renderRecipes();
      document.getElementById("alt-btn").textContent =
        "Not feeling it. What else could I try?";
      showingAlt = false;
    }
  });

  // Single delegated listener for all recipe picks (list + message)
  document.addEventListener("click", (e) => {
    const btn = e.target.closest('.recipe-link[data-recipe-id]');
    if (!btn) return;
    e.preventDefault();
    const id = Number(btn.dataset.recipeId);
    if (!Number.isNaN(id)) openRecipePanel(id);
  });

  // === NEW: Sidebar toggle & view switching ===
  function toggleSidebar(force) {
    if (!sidebarEl || !menuToggleEl) return;
    const wantOpen = typeof force === "boolean" ? force : sidebarEl.hidden; // toggle if no force
    sidebarEl.hidden = !wantOpen;
    sidebarEl.setAttribute("aria-hidden", String(!wantOpen));
    menuToggleEl.setAttribute("aria-expanded", String(wantOpen));
  }

  function setActiveMenuItem(viewId) {
    sidebarEl?.querySelectorAll(".menu-item[data-view]").forEach(btn => {
      if (btn.dataset.view === viewId) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });
  }

  function showView(viewId) {
    VIEWS.forEach(v => {
      const el = document.getElementById(v);
      if (!el) return;
      el.style.display = (v === viewId) ? "" : "none"; // default display for block-levels
    });
    setActiveMenuItem(viewId);
    localStorage.setItem("rb.currentView", viewId);
    // Optional: trigger renders when switching
    if (viewId === "suggestions") {
      // Already rendered on load
    }
    // Future: populate other views when ready
  }

  // Menu toggle click
  menuToggleEl?.addEventListener("click", () => toggleSidebar());

  // Close on outside click
  document.addEventListener("click", (e) => {
    if (!sidebarEl || sidebarEl.hidden) return;
    const clickedInsideSidebar = sidebarEl.contains(e.target);
    const clickedToggle = menuToggleEl.contains(e.target);
    if (!clickedInsideSidebar && !clickedToggle) toggleSidebar(false);
  });

  // Close on ESC
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") toggleSidebar(false);
  });

  // Handle menu item clicks (Suggestions/Recipes/Schedule/Pantry)
  sidebarEl?.addEventListener("click", (e) => {
    const btn = e.target.closest(".menu-item");
    if (!btn) return;
    const view = btn.dataset.view;
    if (view && VIEWS.includes(view)) {
      showView(view);
      toggleSidebar(false);
    }
  });

  // Initial view
  const initialView = localStorage.getItem("rb.currentView") || "suggestions";
  showView(initialView);
});
