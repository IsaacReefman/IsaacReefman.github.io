// /RecipeBook/script.js

// Initialise Dexie DB — bumped version to 2 to force rebuild
const db = new Dexie("RecipeBookDB");
db.version(2).stores({
  ingredients: "id, description, type, unit, storage",
  collections: "id, description, type, methodBasic, methodDetailed",
  quantities: "++id, collectionId, ingredientId, quantity",
  schedule: "day, easyId, lessEasyId"
});

// Helper: fetch JSON from /RecipeBook/data/ with cache-busting
async function fetchJSON(filename) {
  const cacheBuster = `?t=${Date.now()}`;
  const res = await fetch(`./data/${filename}${cacheBuster}`, {
    cache: "no-store"
  });
  if (!res.ok) throw new Error(`Failed to load ${filename} (HTTP ${res.status})`);
  return res.json();
}

// Seed DB if empty
async function seedDatabase() {
  const ingredientCount = await db.ingredients.count();
  const collectionCount = await db.collections.count();
  const quantityCount = await db.quantities.count();
  const scheduleCount = await db.schedule.count();

  if (
    ingredientCount === 0 &&
    collectionCount === 0 &&
    quantityCount === 0 &&
    scheduleCount === 0
  ) {
    console.log("Seeding database from JSON files...");

    const [ingredients, collections, quantities, scheduleData] = await Promise.all([
      fetchJSON("ingredient.json"),
      fetchJSON("collection.json"),
      fetchJSON("quantity.json"),
      fetchJSON("schedule.json")
    ]);

    await db.ingredients.bulkAdd(ingredients);
    await db.collections.bulkAdd(collections);
    await db.quantities.bulkAdd(quantities);
    await db.schedule.bulkAdd(scheduleData);

    console.log("Database seeded successfully.");
  } else {
    console.log("Database already seeded.");
  }
}

// Render recipes selected for this day of the week
async function renderToday() {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const todayName = days[new Date().getDay()];

  const todaySchedule = await db.schedule.get({ day: todayName });
  if (!todaySchedule) {
    document.getElementById("status").innerHTML = `<p>No schedule found for ${todayName}</p>`;
    return;
  }

  const easy = await db.collections.get(todaySchedule.easyId);
  const lessEasy = await db.collections.get(todaySchedule.lessEasyId);

  const listEl = document.getElementById("recipe-list");
  listEl.innerHTML = `<li>Today, you should make <strong>${easy.description}</strong> or <strong>${lessEasy.description}</strong> for dinner.</li>`;
  
  // ✅ Hide loading, show content
  document.getElementById("status").style.display = "none";
  document.getElementById("content").style.display = "block";
}

// Render full recipe list
async function renderRecipes() {
  const recipes = await db.collections
    .where("type")
    .anyOf("recipe", "ready-meal")
    .toArray();

  const listEl = document.getElementById("recipe-list");
  listEl.innerHTML = recipes.map(r => `<li>${r.description}</li>`).join("");

  document.getElementById("status").style.display = "none";
  document.getElementById("content").style.display = "block";
}

// Main init
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await seedDatabase();
    await renderToday();
  } catch (err) {
    console.error(err);
    document.getElementById("status").innerHTML =
      `<p style="color:red;">Error: ${err.message}</p>`;
  }

  // Refresh button
  document.getElementById("refresh-btn").addEventListener("click", async () => {
    console.log("Refreshing from stored copy...");
    await db.delete();
    location.reload();
  });

  // Save button (placeholder)
  document.getElementById("save-btn").addEventListener("click", async () => {
    console.log("Saving current Recipe Book over stored copy...");
    alert("Save functionality not yet implemented.");
  });

  // Alt / full list toggle
  let showingAlt = false;
  document.getElementById("alt-btn").addEventListener("click", async () => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const todayName = days[new Date().getDay()];
    const todaySchedule = await db.schedule.get({ day: todayName });

    const allMeals = await db.collections
      .where("type")
      .anyOf("recipe", "ready-meal")
      .toArray();

    if (!showingAlt) {
      // Filter out today's meals
      const filtered = allMeals.filter(
        m => m.id !== todaySchedule.easyId && m.id !== todaySchedule.lessEasyId
      );
      // Pick two random
      const picks = filtered.sort(() => 0.5 - Math.random()).slice(0, 2);

      const listEl = document.getElementById("recipe-list");
      listEl.innerHTML = `<li>How about <strong>${picks[0].description}</strong> or <strong>${picks[1].description}</strong>?</li>`;

      document.getElementById("alt-btn").textContent =
        "You suck at this. Tell me everything you know how to cook.";
      showingAlt = true;
    } else {
      // Show full list
      await renderRecipes();
      document.getElementById("alt-btn").textContent =
        "Not feeling it. What else could I try?";
      showingAlt = false;
    }
  });
});
