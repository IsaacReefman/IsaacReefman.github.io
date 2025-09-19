// /RecipeBook/script.js

// Initialise Dexie DB
const db = new Dexie("RecipeBookDB");
db.version(1).stores({
  ingredients: "id, description, type, unit, storage",
  collections: "id, description, type, methodBasic, methodDetailed",
  quantities: "++id, collectionId, ingredientId, quantity"
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

  if (ingredientCount === 0 && collectionCount === 0 && quantityCount === 0) {
    console.log("Seeding database from JSON files...");

    const [ingredients, collections, quantities] = await Promise.all([
      fetchJSON("ingredient.json"),
      fetchJSON("collection.json"),
      fetchJSON("quantity.json")
    ]);

    await db.ingredients.bulkAdd(ingredients);
    await db.collections.bulkAdd(collections);
    await db.quantities.bulkAdd(quantities);

    console.log("Database seeded successfully.");
  } else {
    console.log("Database already seeded.");
  }
}

// Render recipe list
async function renderRecipes() {
  const recipes = await db.collections
    .where("type")
    .anyOf("recipe", "ready-meal")
    .toArray();

  const listEl = document.getElementById("recipe-list");
  listEl.innerHTML = "";

  recipes.forEach(recipe => {
    const li = document.createElement("li");
    li.textContent = recipe.description;
    listEl.appendChild(li);
  });

  document.getElementById("status").style.display = "none";
  document.getElementById("content").style.display = "block";
}

// Main init
(async function init() {
  try {
    await seedDatabase();
    await renderRecipes();
  } catch (err) {
    console.error(err);
    document.getElementById("status").innerHTML =
      `<p style="color:red;">Error: ${err.message}</p>`;
  }
})();
