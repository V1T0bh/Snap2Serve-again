const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL;

/**
 * Upload an image to backend and get back detected ingredients.
 * Backend: POST /upload/image  (multipart/form-data, field name = "image")
 */
export async function uploadImageForIngredients(file: File) {
  const form = new FormData();
  form.append("image", file); // must match backend field name

  const res = await fetch(`${BACKEND}/upload/image`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  // expected shape example:
  // { ingredients: [{ name: "tomato", confidence: 0.92 }, ...], image_id?: "..." }
  return res.json();
}

/**
 * Ask backend agent to recommend recipes based on confirmed ingredients + preference text.
 * Backend: POST /agent/recommend (application/json)
 */
export async function recommendRecipes(params: {
  ingredients_confirmed: string[];
  preference_text: string;
}) {
  const res = await fetch(`${BACKEND}/agent/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  // expected shape example:
  // { recipes: [...], shopping_list: [...] }
  return res.json();
}
