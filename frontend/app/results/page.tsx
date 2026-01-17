"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Ingredient = { name: string; confidence?: number };

type Recipe = {
  title: string;
  short_steps?: string;
  instructions?: string;
  ingredients?: string[];
  missing_items?: string[];
};

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function ResultsPage() {
  const router = useRouter();
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>("");

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [shoppingList, setShoppingList] = useState<Record<string, string[]> | null>(null);

  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // read from sessionStorage (set by page 1)
  useEffect(() => {
    const img = sessionStorage.getItem("snap2serve:image");
    const p = sessionStorage.getItem("snap2serve:prompt") || "";
    setImageDataUrl(img);
    setPrompt(p);
  }, []);

  const topIngredients = useMemo(
    () => ingredients.map((x) => x.name).filter(Boolean),
    [ingredients]
  );

  async function runPipeline() {
    if (!imageDataUrl) {
      setError("No uploaded image found. Go back and upload a photo first.");
      return;
    }

    setLoading(true);
    setError(null);
    setStage("Uploading image…");

    try {
      // 1) Convert dataURL -> Blob for multipart upload
      const blob = await (await fetch(imageDataUrl)).blob();
      const file = new File([blob], "ingredients.jpg", { type: blob.type || "image/jpeg" });

      // 2) POST /upload/image (multipart/form-data) - this detects ingredients
      const form = new FormData();
      form.append("image", file);

      setStage("Detecting ingredients…");
      const ingRes = await fetch(`${BACKEND}/upload/image`, {
        method: "POST",
        body: form,
      });

      if (!ingRes.ok) throw new Error(await ingRes.text());
      const ingJson = await ingRes.json();
      const ingList: Ingredient[] = ingJson.ingredients_detected ?? [];
      setIngredients(ingList);

      // 3) POST /agent/recommend (JSON)
      setStage("Finding best recipes online…");
      const recipeRes = await fetch(`${BACKEND}/agent/recommend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredients_confirmed: ingList.map((x) => x.name),
          preference_text: prompt, // cuisine/dish preference
        }),
      });

      if (!recipeRes.ok) throw new Error(await recipeRes.text());
      const recipeJson = await recipeRes.json();
      setRecipes(recipeJson.recipes ?? []);
      setShoppingList(recipeJson.shopping_list ?? null);
      setStage("");
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
      setStage("");
    } finally {
      setLoading(false);
    }
  }

  // auto-run once when we have image
  useEffect(() => {
    if (imageDataUrl) runPipeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageDataUrl]);

  return (
    <div style={S.page}>
      <div style={S.topbar}>
        <Link href="/" style={S.backBtn}>← Back</Link>
        <div style={S.brand}>Snap2Serve</div>
        <div style={{ width: 80 }} />
      </div>

      <div style={S.container}>
        <div style={S.header}>
          <div>
            <div style={S.title}>Your recipe matches</div>
            <div style={S.sub}>
              We detected ingredients from your photo and ranked recipes that best match your request.
            </div>
          </div>

          <button onClick={runPipeline} disabled={loading} style={S.primaryBtn(loading)}>
            {loading ? "Working…" : "Re-run"}
          </button>
        </div>

        {/* Summary row */}
        <div style={S.grid}>
          <div style={S.card}>
            <div style={S.cardTitle}>Upload</div>
            {imageDataUrl ? (
              <img src={imageDataUrl} alt="upload" style={S.preview} />
            ) : (
              <div style={S.muted}>No image found.</div>
            )}
            <div style={{ height: 10 }} />
            <div style={S.label}>What you want to cook</div>
            <div style={S.promptBox}>{prompt || <span style={S.muted}>—</span>}</div>
          </div>

          <div style={S.card}>
            <div style={S.cardTitle}>Detected ingredients</div>
            {topIngredients.length === 0 ? (
              <div style={S.muted}>None yet.</div>
            ) : (
              <div style={S.chips}>
                {ingredients.map((ing, i) => (
                  <span key={i} style={S.chip}>
                    {ing.name}
                    {typeof ing.confidence === "number" ? (
                      <span style={S.chipPct}> {Math.round(ing.confidence * 100)}%</span>
                    ) : null}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Status + error */}
        {loading && (
          <div style={S.status}>
            <span style={S.spinner} />
            <span>{stage || "Loading…"}</span>
          </div>
        )}

        {error && (
          <div style={S.errorBox}>
            <b>Backend error:</b> {error}
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
              Check that your backend is running at <code>{BACKEND}</code>.
            </div>
          </div>
        )}

        {/* Recipes */}
        <div style={{ height: 14 }} />
        <div style={S.sectionTitle}>Top recipes</div>

        {recipes.length === 0 && !loading && !error ? (
          <div style={S.muted}>No recipes found yet.</div>
        ) : (
          <div style={S.recipeGrid}>
            {recipes.map((r, idx) => (
              <div
                key={idx}
                style={S.recipeCard}
                onClick={() => {
                  sessionStorage.setItem("snap2serve:selected_recipe", JSON.stringify(r));
                  router.push("/recipe");
                }}
              >
                <div style={S.recipeTop}>
                  <div style={S.recipeName}>{r.title}</div>
                </div>

                {r.short_steps ? <div style={S.recipeSummary}>{r.short_steps}</div> : null}

                {Array.isArray(r.missing_items) && r.missing_items.length > 0 ? (
                  <div style={S.smallRow}>
                    <span style={S.smallLabel}>Missing:</span>{" "}
                    <span style={S.smallText}>{r.missing_items.join(", ")}</span>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {/* Shopping List */}
        {shoppingList && Object.keys(shoppingList).length > 0 && (
          <>
            <div style={{ height: 14 }} />
            <div style={S.sectionTitle}>Shopping list</div>
            <div style={S.shoppingList}>
              {Object.entries(shoppingList).map(([category, items]) => (
                <div key={category} style={S.shoppingCategory}>
                  <div style={S.categoryTitle}>{category}</div>
                  <ul style={S.categoryItems}>
                    {items.map((item, idx) => (
                      <li key={idx} style={S.categoryItem}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ===== styles ===== */
const S: Record<string, any> = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #0b0f14 0%, #0b0f14 40%, #111827 100%)",
    color: "#fff",
  },
  topbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 18px",
    borderBottom: "1px solid rgba(255,255,255,.08)",
    position: "sticky",
    top: 0,
    background: "rgba(11,15,20,.75)",
    backdropFilter: "blur(10px)",
    zIndex: 10,
  },
  brand: { fontWeight: 950, letterSpacing: 0.2 },
  backBtn: {
    color: "rgba(255,255,255,.85)",
    textDecoration: "none",
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(255,255,255,.06)",
  },
  container: { maxWidth: 1100, margin: "0 auto", padding: "22px 18px 56px" },
  header: { display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-end" },
  title: { fontSize: 34, fontWeight: 950, letterSpacing: -0.3 },
  sub: { marginTop: 6, opacity: 0.75, fontSize: 14, maxWidth: 680 },
  primaryBtn: (disabled: boolean) => ({
    padding: "10px 14px",
    borderRadius: 14,
    border: "1px solid rgba(215,178,106,.5)",
    background: disabled ? "rgba(255,255,255,.08)" : "#D7B26A",
    color: disabled ? "rgba(255,255,255,.6)" : "#111",
    fontWeight: 950,
    cursor: disabled ? "not-allowed" : "pointer",
  }),

  grid: { display: "grid", gridTemplateColumns: "1.1fr 1.2fr", gap: 14, marginTop: 18 },
  card: {
    background: "rgba(255,255,255,.94)",
    color: "#0f172a",
    borderRadius: 22,
    padding: 14,
    border: "1px solid rgba(255,255,255,.12)",
    boxShadow: "0 30px 80px rgba(0,0,0,.35)",
  },
  cardTitle: { fontWeight: 950, marginBottom: 10, fontSize: 14 },
  preview: { width: "100%", height: 220, objectFit: "cover", borderRadius: 16, border: "1px solid rgba(15,23,42,.10)" },
  label: { fontSize: 12, opacity: 0.7, marginTop: 4 },
  promptBox: {
    marginTop: 6,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(15,23,42,.10)",
    background: "rgba(15,23,42,.03)",
    fontWeight: 800,
  },

  chips: { display: "flex", flexWrap: "wrap", gap: 8 },
  chip: {
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid rgba(15,23,42,.12)",
    background: "rgba(15,23,42,.03)",
    fontWeight: 850,
    fontSize: 12,
  },
  chipPct: { opacity: 0.55, fontWeight: 800 },

  status: {
    marginTop: 14,
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(255,255,255,.06)",
    color: "rgba(255,255,255,.85)",
  },
  spinner: {
    width: 14,
    height: 14,
    borderRadius: 999,
    border: "2px solid rgba(255,255,255,.35)",
    borderTopColor: "rgba(255,255,255,1)",
    animation: "spin 0.8s linear infinite",
  },

  errorBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(255,100,100,.35)",
    background: "rgba(255,80,80,.08)",
    color: "rgba(255,220,220,.95)",
  },

  sectionTitle: { marginTop: 10, fontWeight: 950, fontSize: 16 },
  recipeGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14, marginTop: 12 },

  recipeCard: {
    display: "block",
    textDecoration: "none",
    color: "#0f172a",
    background: "rgba(255,255,255,.94)",
    borderRadius: 22,
    padding: 14,
    border: "1px solid rgba(255,255,255,.12)",
    boxShadow: "0 30px 80px rgba(0,0,0,.35)",
    transition: "transform .12s ease, box-shadow .12s ease",
    cursor: "pointer",
  }
, recipeCardHover: {
    transform: "translateY(-4px)",
    boxShadow: "0 40px 100px rgba(0,0,0,.45)",
  },
  recipeTop: { marginBottom: 8 },
  recipeName: { fontWeight: 950, fontSize: 16, lineHeight: 1.2 },
  recipeMeta: { marginTop: 6, fontSize: 12, opacity: 0.7 },
  recipeSummary: { marginTop: 8, fontSize: 13, opacity: 0.85, lineHeight: 1.4 },
  smallRow: { marginTop: 10, fontSize: 12, display: "flex", gap: 6, flexWrap: "wrap" },
  smallLabel: { opacity: 0.6, fontWeight: 900 },
  smallText: { opacity: 0.9 },
  openLink: { marginTop: 12, fontSize: 12, fontWeight: 950, color: "#111827", opacity: 0.85 },

  shoppingList: { marginTop: 12, display: "flex", flexDirection: "column", gap: 12 },
  shoppingCategory: { background: "rgba(255,255,255,.94)", borderRadius: 16, padding: 14, border: "1px solid rgba(255,255,255,.12)" },
  categoryTitle: { fontWeight: 950, fontSize: 14, marginBottom: 8, color: "#000" },
  categoryItems: { margin: 0, paddingLeft: 16 },
  categoryItem: { fontSize: 13, lineHeight: 1.4, color: "#000" },

  muted: { opacity: 0.7 },
};

// add global keyframes (quick hack)
if (typeof document !== "undefined") {
  const id = "snap2serve-spin-style";
  if (!document.getElementById(id)) {
    const s = document.createElement("style");
    s.id = id;
    s.innerHTML = `@keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }`;
    document.head.appendChild(s);
  }
}
