// /RecipeBook/script.js

// Initialise Dexie DB
const db = new Dexie("RecipeBookDB");
db.version(1).stores({
  ingredient: "id, description, type, unit, storage",
  collection: "id, description, type, methodBasic, methodDetailed",
  quantity: "++id, collectionId, ingredientId, quantity"
});

// Helper: fetch JSON from /RecipeBook/data/
async function fetchJSON(filename) {
  const res = await fetch(`./data/${filename}`);
  if (!res.ok) throw new Error(`Failed to load ${filename}`);
  return res.json();
}

// Seed DB if empty
async function seedDatabase() {
  const ingredientCount = await db.ingredient.count();
  const collectionCount = await db.collection.count();
  const quantityCount = await db.quantity.count();

  if (ingredientCount === 0 && collectionCount === 0 && quantityCount === 0) {
    console.log("Seeding database from JSON files...");

    const [ingredient, collection, quantity] = await Promise.all([
      fetchJSON("ingredient.json"),
      fetchJSON("collection.json"),
      fetchJSON("quantity.json")
    ]);

    await db.ingredient.bulkAdd(ingredient);
    await db.collection.bulkAdd(collection);
    await db.quantity.bulkAdd(quantity);

    console.log("Database seeded successfully.");
  } else {
    console.log("Database already seeded.");
  }
}

// Render recipe list
async function renderRecipes() {
  const recipes = await db.collection
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
