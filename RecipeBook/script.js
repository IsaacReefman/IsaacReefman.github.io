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

  async function renderToday() {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const todayName = days[new Date().getDay()];
    const todaySchedule = await db.schedule.get({ day: todayName });

    if (!todaySchedule) {
      listEl.innerHTML = `<li>No schedule found for ${todayName}</li>`;
      return;
    }

    const easy = await db.collections.get(todaySchedule.easyId);
    const lessEasy = await db.collections.get(todaySchedule.lessEasyId);

    listEl.innerHTML = `<li>Today, you should make <strong>${easy.description}</strong> or <strong>${lessEasy.description}</strong> for dinner.</li>`;
  }

  async function renderRecipes() {
    const recipes = await db.collections
      .where("type")
      .anyOf("recipe", "ready-meal")
      .toArray();
    listEl.innerHTML = recipes.map(r => `<li>${r.description}</li>`).join("");
  }

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

  // Refresh button
  document.getElementById("refresh-btn")?.addEventListener("click", async () => {
    await db.delete();
    location.reload();
  });

  // Save button (placeholder)
  document.getElementById("save-btn")?.addEventListener("click", () => {
    alert("Save functionality not yet implemented.");
  });

  // Alt / full list toggle
  let showingAlt = false;
  document.getElementById("alt-btn")?.addEventListener("click", async () => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const todayName = days[new Date().getDay()];
    const todaySchedule = await db.schedule.get({ day: todayName });

    const allMeals = await db.collections
      .where("type")
      .anyOf("recipe", "ready-meal")
      .toArray();

    if (!showingAlt) {
      const filtered = todaySchedule
        ? allMeals.filter(m => m.id !== todaySchedule.easyId && m.id !== todaySchedule.lessEasyId)
        : allMeals;
      const picks = filtered.sort(() => 0.5 - Math.random()).slice(0, 2);
      listEl.innerHTML = `<li>How about <strong>${picks[0].description}</strong> or <strong>${picks[1].description}</strong>?</li>`;
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
});
