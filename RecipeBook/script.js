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
  const statusEl = document.getElementById("status");
  const contentEl = document.getElementById("content");
  const listEl = document.getElementById("recipe-list");

  // === NEW: UI helpers for feed + panel ===
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
      panelBodyEl: panel.querySelector("#panel-body")
    };
  }

  async function openRecipePanel(collectionId) {
    const recipe = await db.collections.get(collectionId);
    const qs = await db.quantities.where("collectionId").equals(collectionId).toArray();
    const ingIds = [...new Set(qs.map(q => q.ingredientId))];
    const ings = await db.ingredients.bulkGet(ingIds);

    const items = qs.map(q => {
      const ing = ings.find(i => i?.id === q.ingredientId);
      const unit = ing?.unit ? ` ${ing.unit}` : "";
      const name = ing?.description ?? "Unknown ingredient";
      const qty = q.quantity ?? "";
      return `<li>${qty}${unit} ${name}</li>`;
    }).join("");

    panelBodyEl.innerHTML = `
      <h2>${recipe.description}</h2>
      ${items ? `<h3>Ingredients</h3><ul>${items}</ul>` : ""}
      ${recipe.methodDetailed
        ? `<h3>Method</h3><p>${recipe.methodDetailed}</p>`
        : recipe.methodBasic
          ? `<h3>Method</h3><p>${recipe.methodBasic}</p>`
          : ""}
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

    showMessage(`Today, you could make <strong>${easy.description}</strong> or <strong>${lessEasy.description}</strong>.`);
  }

  async function renderRecipes() {
    const recipes = await db.collections.where("type").anyOf("recipe","ready-meal").toArray();
    showList();
    listEl.innerHTML = recipes
      .map(r => `<li>#${r.description}</a></li>`)
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

  // === Event listeners ===
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
      showMessage(`How about <strong>${picks[0].description}</strong> or <strong>${picks[1].description}</strong>?`);
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

  // Delegate clicks for recipe links
  listEl.addEventListener("click", (e) => {
    const a = e.target.closest('a[data-id]');
    if (!a) return;
    e.preventDefault();
    openRecipePanel(Number(a.dataset.id));
  });
});
