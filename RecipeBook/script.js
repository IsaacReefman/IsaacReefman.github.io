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
  const url = `./data/${filename}?t=${Date.now()}`;
  console.log("[fetchJSON] GET", url);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${filename} (HTTP ${res.status})`);
  const data = await res.json();
  console.log("[fetchJSON] OK", filename, Array.isArray(data) ? `len=${data.length}` : typeof data);
  return data;
}

// Seed DB
async function seedDatabase() {
  console.log("[seed] counting stores...");
  const [ingredientCount, collectionCount, quantityCount, scheduleCount] = await Promise.all([
    db.ingredients.count(),
    db.collections.count(),
    db.quantities.count(),
    db.schedule.count()
  ]);
  console.log("[seed] counts", { ingredientCount, collectionCount, quantityCount, scheduleCount });

  // Seed core stores if any are empty
  if (ingredientCount === 0 || collectionCount === 0 || quantityCount === 0) {
    console.log("[seed] seeding core stores from JSON...");
    const [ingredients, collections, quantities] = await Promise.all([
      fetchJSON("ingredient.json"),
      fetchJSON("collection.json"),
      fetchJSON("quantity.json")
    ]);
    await db.transaction("rw", db.ingredients, db.collections, db.quantities, async () => {
      if (ingredientCount === 0) await db.ingredients.bulkAdd(ingredients);
      if (collectionCount === 0) await db.collections.bulkAdd(collections);
      if (quantityCount === 0) await db.quantities.bulkAdd(quantities);
    });
    console.log("[seed] core stores seeded");
  } else {
    console.log("[seed] core stores already present");
  }

  // Seed schedule independently if missing
  if (scheduleCount === 0) {
    console.log("[seed] seeding schedule...");
    const scheduleData = await fetchJSON("schedule.json");
    await db.schedule.bulkAdd(scheduleData);
    console.log("[seed] schedule seeded");
  } else {
    console.log("[seed] schedule already present");
  }
}

// Render recipes selected for this day of the week
async function renderToday() {
  console.log("[renderToday] start");
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const todayName = days[new Date().getDay()];
  console.log("[renderToday] today =", todayName);

  const todaySchedule = await db.schedule.get({ day: todayName });
  console.log("[renderToday] todaySchedule =", todaySchedule);

  const listEl = document.getElementById("recipe-list");

  if (!todaySchedule) {
    listEl.innerHTML = `<li>No schedule found for ${todayName}. Check schedule.json day strings.</li>`;
    return;
  }

  const [easy, lessEasy] = await Promise.all([
    db.collections.get(todaySchedule.easyId),
    db.collections.get(todaySchedule.lessEasyId)
  ]);
  console.log("[renderToday] resolved recipes =", { easy, lessEasy });

  if (!easy || !lessEasy) {
    listEl.innerHTML = `<li>Schedule refers to missing recipe IDs. Check collection.json vs schedule.json.</li>`;
    return;
  }

  listEl.innerHTML = `<li>Today, you should make <strong>${easy.description}</strong> or <strong>${lessEasy.description}</strong> for dinner.</li>`;
}

// Render full recipe list
async function renderRecipes() {
  console.log("[renderRecipes] start");
  const recipes = await db.collections
    .where("type")
    .anyOf("recipe", "ready-meal")
    .toArray();

  const listEl = document.getElementById("recipe-list");
  listEl.innerHTML = recipes.map(r => `<li>${r.description}</li>`).join("");
}

// Main init
document.addEventListener("DOMContentLoaded", async () => {
  const statusEl = document.getElementById("status");
  const contentEl = document.getElementById("content");

  try {
    console.log("[init] start");
    await seedDatabase();
    await renderToday();
    console.log("[init] renderToday done");
  } catch (err) {
    console.error(err);
    if (statusEl) statusEl.innerHTML = `<p style="color:red;">Error: ${err.message}</p>`;
  } finally {
    // Ensure the UI flips out of "loading" no matter what
    if (statusEl) statusEl.style.display = "none";
    if (contentEl) contentEl.style.display = "block";
  }

  // Refresh button
  const refreshBtn = document.getElementById("refresh-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      console.log("Refreshing from stored copy...");
      await db.delete();
      location.reload();
    });
  }

  // Save button (placeholder)
  const saveBtn = document.getElementById("save-btn");
  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      console.log("Saving current Recipe Book over stored copy...");
      alert("Save functionality not yet implemented.");
    });
  }

  // Alt / full list toggle
  let showingAlt = false;
  const altBtn = document.getElementById("alt-btn");
  if (altBtn) {
    altBtn.addEventListener("click", async () => {
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

        if (filtered.length < 2) {
          document.getElementById("recipe-list").innerHTML = `<li>Not enough meals to suggest alternates.</li>`;
          return;
        }

        const picks = filtered.sort(() => 0.5 - Math.random()).slice(0, 2);
        document.getElementById("recipe-list").innerHTML =
          `<li>How about <strong>${picks[0].description}</strong> or <strong>${picks[1].description}</strong>?</li>`;

        altBtn.textContent = "You suck at this. Tell me everything you know how to cook.";
        showingAlt = true;
      } else {
        await renderRecipes();
        altBtn.textContent = "Not feeling it. What else could I try?";
        showingAlt = false;
      }
    });
  }

  console.log("[init] complete");
});
