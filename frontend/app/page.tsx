"use client";

import React, { useMemo, useState } from "react";

type Ingredient = { name: string; confidence?: number };

type Recipe = {
  title: string;
  time_mins?: number;
  difficulty?: string;
  ingredients?: { name: string; amount?: string }[];
  steps?: string[];
  missing_items?: string[];
  source_confidence?: number;
};

export default function Page() {
  // ✅ change this if your backend runs on a different port
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

  // ===== Upload state =====
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // ===== Ingredients state =====
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [newIng, setNewIng] = useState("");

  // ===== Recipes state =====
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  // ===== Shopping list =====
  const [shopping, setShopping] = useState<string[]>([]);

  // ===== UI state =====
  const [loadingScan, setLoadingScan] = useState(false);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canScan = useMemo(() => !!file && !loadingScan, [file, loadingScan]);
  const canGenRecipes = useMemo(
    () => ingredients.length > 0 && !loadingRecipes,
    [ingredients.length, loadingRecipes]
  );

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setIngredients([]);
    setRecipes([]);
    setShopping([]);
    setError(null);

    if (previewUrl) URL.revokeObjectURL(previewUrl);

    if (f) {
      setPreviewUrl(URL.createObjectURL(f));
    } else {
      setPreviewUrl(null);
    }
  }

  function removeIngredient(i: number) {
    setIngredients((prev) => prev.filter((_, idx) => idx !== i));
  }

  function renameIngredient(i: number, newName: string) {
    setIngredients((prev) =>
      prev.map((x, idx) => (idx === i ? { ...x, name: newName } : x))
    );
  }

  function addIngredient(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;

    const exists = ingredients.some(
      (x) => x.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) return;

    setIngredients((prev) => [...prev, { name: trimmed }]);
  }

  function addMissingToShopping(items: string[]) {
    setShopping((prev) => {
      const seen = new Set(prev.map((x) => x.toLowerCase()));
      const out = [...prev];
      for (const it of items) {
        const t = it.trim();
        if (!t) continue;
        if (!seen.has(t.toLowerCase())) {
          out.push(t);
          seen.add(t.toLowerCase());
        }
      }
      return out;
    });
  }

  function removeShoppingItem(i: number) {
    setShopping((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function copyShoppingList() {
    try {
      await navigator.clipboard.writeText(shopping.join("\n"));
      alert("Copied shopping list ✅");
    } catch {
      alert("Copy blocked by browser. You can manually select + copy.");
    }
  }

  async function handleScanIngredients() {
    if (!file) return;

    setLoadingScan(true);
    setError(null);
    setRecipes([]);
    setShopping([]);

    try {
      const form = new FormData();
      form.append("image", file);

      const res = await fetch(`${API_BASE}/vision/ingredients`, {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Scan failed: ${res.status}`);
      }

      const data = await res.json();

      // expected: { ingredients: [{name, confidence}] } OR { ingredients: ["egg","rice"] }
      const parsed: Ingredient[] = Array.isArray(data.ingredients)
        ? data.ingredients.map((x: any) => ({
            name: String(x?.name ?? x),
            confidence:
              typeof x?.confidence === "number" ? x.confidence : undefined,
          }))
        : [];

      setIngredients(parsed);
    } catch (e: any) {
      setError(e?.message ?? "Scan failed. Is backend running?");
    } finally {
      setLoadingScan(false);
    }
  }

  async function handleGenerateRecipes() {
    setLoadingRecipes(true);
    setError(null);
    setRecipes([]);

    try {
      const payload = {
        ingredients: ingredients.map((x) => x.name.trim()).filter(Boolean),
      };

      const res = await fetch(`${API_BASE}/agent/recipes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Recipes failed: ${res.status}`);
      }

      const data = await res.json();
      const recs: Recipe[] = Array.isArray(data.recipes) ? data.recipes : [];
      setRecipes(recs);
    } catch (e: any) {
      setError(e?.message ?? "Recipe generation failed. Check backend URL.");
    } finally {
      setLoadingRecipes(false);
    }
  }

  return (
    <div style={styles.page}>
      <main style={styles.container}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.h1}>Snap2Serve</h1>
            <p style={styles.sub}>
              Upload → detect ingredients → verify recipes → build a shopping
              list
            </p>
          </div>
          <span style={styles.badge}>Theme • Purple + Green</span>
        </header>

        {/* Upload */}
        <section style={styles.card}>
          <div style={styles.cardTitleRow}>
            <h2 style={styles.h2}>Upload</h2>
            <span style={styles.mutedSmall}>Backend: {API_BASE}</span>
          </div>

          <div style={styles.uploadGrid}>
            <label style={styles.fileLabel}>
              <input
                type="file"
                accept="image/*"
                onChange={onFileChange}
                style={{ display: "none" }}
              />
              <span style={styles.fileButton}>
                {file ? "Change image" : "Choose image"}
              </span>
              <span style={styles.fileName}>
                {file ? file.name : "No file selected"}
              </span>
            </label>

            {previewUrl ? (
              <div style={styles.previewWrap}>
                <img src={previewUrl} alt="preview" style={styles.previewImg} />
              </div>
            ) : (
              <div style={styles.previewEmpty}>
                <div style={styles.previewEmptyInner}>
                  <div style={styles.previewIcon}>📸</div>
                  <div style={styles.previewText}>
                    Upload a food photo to start.
                  </div>
                </div>
              </div>
            )}

            <div style={styles.actions}>
              <button
                onClick={handleScanIngredients}
                disabled={!canScan}
                style={primaryBtnStyle(!canScan)}
              >
                {loadingScan ? "Scanning..." : "Scan Ingredients"}
              </button>

              <button
                onClick={handleGenerateRecipes}
                disabled={!canGenRecipes}
                style={secondaryBtnStyle(!canGenRecipes)}
              >
                {loadingRecipes ? "Generating..." : "Generate Recipes"}
              </button>
            </div>

            {error && (
              <div style={styles.errorBox}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Error</div>
                <div style={{ whiteSpace: "pre-wrap" }}>{error}</div>
                <div style={styles.errorHint}>
                  Tip: confirm backend is running and endpoints exist:
                  <code> /vision/ingredients</code>, <code> /agent/recipes</code>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Ingredients */}
        <section style={styles.card}>
          <div style={styles.cardTitleRow}>
            <h2 style={styles.h2}>Ingredients</h2>
            <span style={styles.mutedSmall}>Editable chips</span>
          </div>

          {ingredients.length === 0 ? (
            <p style={styles.emptyText}>
              No ingredients yet. Upload + scan, or add them manually.
            </p>
          ) : (
            <div style={styles.chipsWrap}>
              {ingredients.map((ing, idx) => (
                <span key={`${ing.name}-${idx}`} style={styles.chip}>
                  <input
                    value={ing.name}
                    onChange={(e) => renameIngredient(idx, e.target.value)}
                    style={styles.chipInput}
                  />
                  {typeof ing.confidence === "number" ? (
                    <span style={styles.chipMeta}>
                      {Math.round(ing.confidence * 100)}%
                    </span>
                  ) : null}
                  <button
                    onClick={() => removeIngredient(idx)}
                    style={styles.chipX}
                    title="Remove"
                    aria-label="Remove ingredient"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}

          <div style={styles.addRow}>
            <input
              placeholder="Add ingredient (press Enter)"
              value={newIng}
              onChange={(e) => setNewIng(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  addIngredient(newIng);
                  setNewIng("");
                }
              }}
              style={styles.textInput}
            />
            <button
              onClick={() => {
                addIngredient(newIng);
                setNewIng("");
              }}
              style={secondaryBtnStyle(false)}
            >
              Add
            </button>
          </div>
        </section>

        {/* Recipes */}
        <section style={styles.card}>
          <div style={styles.cardTitleRow}>
            <h2 style={styles.h2}>Recipes</h2>
            <span style={styles.mutedSmall}>Cards</span>
          </div>

          {recipes.length === 0 ? (
            <p style={styles.emptyText}>No recipes yet. Click “Generate Recipes”.</p>
          ) : (
            <div style={styles.recipeGrid}>
              {recipes.map((r, idx) => (
                <article key={`${r.title}-${idx}`} style={styles.recipeCard}>
                  <div style={styles.recipeTop}>
                    <div>
                      <div style={styles.recipeTitle}>{r.title}</div>
                      <div style={styles.recipeMeta}>
                        {typeof r.time_mins === "number" ? `${r.time_mins} min` : ""}
                        {r.difficulty ? ` • ${r.difficulty}` : ""}
                        {typeof r.source_confidence === "number"
                          ? ` • ${Math.round(r.source_confidence * 100)}%`
                          : ""}
                      </div>
                    </div>

                    {Array.isArray(r.missing_items) && r.missing_items.length > 0 && (
                      <button
                        onClick={() => addMissingToShopping(r.missing_items!)}
                        style={secondaryBtnStyle(false)}
                        title="Add missing items to shopping list"
                      >
                        Add missing
                      </button>
                    )}
                  </div>

                  {Array.isArray(r.steps) && r.steps.length > 0 && (
                    <>
                      <div style={styles.sectionLabel}>Steps</div>
                      <ol style={styles.steps}>
                        {r.steps.slice(0, 7).map((s, i) => (
                          <li key={`${s}-${i}`} style={{ marginBottom: 6 }}>
                            {s}
                          </li>
                        ))}
                      </ol>
                    </>
                  )}

                  {Array.isArray(r.missing_items) && r.missing_items.length > 0 && (
                    <>
                      <div style={styles.sectionLabel}>Missing</div>
                      <div style={styles.missingWrap}>
                        {r.missing_items.map((m, i) => (
                          <span key={`${m}-${i}`} style={styles.missingChip}>
                            {m}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Shopping List */}
        <section style={styles.card}>
          <div style={styles.cardTitleRow}>
            <h2 style={styles.h2}>Shopping List</h2>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={copyShoppingList}
                disabled={shopping.length === 0}
                style={secondaryBtnStyle(shopping.length === 0)}
              >
                Copy
              </button>
              <button
                onClick={() => setShopping([])}
                disabled={shopping.length === 0}
                style={secondaryBtnStyle(shopping.length === 0)}
              >
                Clear
              </button>
            </div>
          </div>

          {shopping.length === 0 ? (
            <p style={styles.emptyText}>
              No items yet. Use “Add missing” from a recipe.
            </p>
          ) : (
            <ul style={styles.shopList}>
              {shopping.map((item, idx) => (
                <li key={`${item}-${idx}`} style={styles.shopItem}>
                  <label style={styles.shopLabel}>
                    <input type="checkbox" />
                    <span style={{ flex: 1 }}>{item}</span>
                    <button
                      onClick={() => removeShoppingItem(idx)}
                      style={styles.shopX}
                      title="Remove"
                    >
                      ✕
                    </button>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

/* =======================
   THEME
======================= */
const theme = {
  primary: "#6D28D9", // purple
  accent: "#22C55E", // green
  bg: "#F7F7FB",
  card: "#FFFFFF",
  text: "#0F172A",
  muted: "#64748B",
  border: "rgba(15, 23, 42, 0.10)",
};

function withAlpha(hex: string, alpha: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* =======================
   BUTTONS
======================= */
function primaryBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: `1px solid ${withAlpha(theme.primary, 0.25)}`,
    background: disabled ? withAlpha(theme.primary, 0.15) : theme.primary,
    color: "#fff",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 800,
    boxShadow: disabled ? "none" : `0 10px 22px ${withAlpha(theme.primary, 0.25)}`,
  };
}

function secondaryBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: `1px solid ${theme.border}`,
    background: disabled ? "rgba(0,0,0,0.03)" : theme.card,
    color: disabled ? "rgba(0,0,0,0.35)" : theme.text,
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 700,
  };
}

/* =======================
   STYLES
======================= */
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: `radial-gradient(1200px 600px at 20% 10%, ${withAlpha(
      theme.primary,
      0.10
    )}, transparent),
      radial-gradient(900px 500px at 90% 0%, ${withAlpha(
        theme.accent,
        0.10
      )}, transparent),
      ${theme.bg}`,
    padding: 20,
    color: theme.text,
  },
  container: {
    maxWidth: 980,
    margin: "0 auto",
    display: "grid",
    gap: 14,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
    padding: "10px 6px",
  },
  h1: { margin: 0, fontSize: 34, letterSpacing: -0.5 },
  sub: { margin: "8px 0 0", color: theme.muted },
  badge: {
    padding: "6px 10px",
    borderRadius: 999,
    border: `1px solid ${theme.border}`,
    background: theme.card,
    fontSize: 12,
    fontWeight: 800,
    color: theme.primary,
    height: "fit-content",
  },

  card: {
    background: theme.card,
    border: `1px solid ${theme.border}`,
    borderRadius: 18,
    padding: 16,
    boxShadow: `0 10px 28px rgba(0,0,0,0.06)`,
  },
  cardTitleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  h2: { margin: 0, fontSize: 18 },
  mutedSmall: { fontSize: 12, color: theme.muted },

  uploadGrid: { display: "grid", gap: 12 },
  fileLabel: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    border: `1px dashed ${withAlpha(theme.primary, 0.35)}`,
    background: withAlpha(theme.primary, 0.06),
  },
  fileButton: {
    padding: "8px 12px",
    borderRadius: 12,
    border: `1px solid ${theme.border}`,
    background: theme.card,
    fontWeight: 800,
    cursor: "pointer",
    whiteSpace: "nowrap",
    color: theme.primary,
  },
  fileName: { fontSize: 13, color: theme.muted, overflow: "hidden", textOverflow: "ellipsis" },

  previewWrap: {
    borderRadius: 16,
    overflow: "hidden",
    border: `1px solid ${theme.border}`,
  },
  previewImg: { width: "100%", height: 280, objectFit: "cover", display: "block" },
  previewEmpty: {
    height: 280,
    borderRadius: 16,
    border: `1px solid ${theme.border}`,
    background: `linear-gradient(180deg, ${withAlpha(theme.primary, 0.05)}, transparent)`,
    display: "grid",
    placeItems: "center",
  },
  previewEmptyInner: { textAlign: "center", maxWidth: 360, padding: 12 },
  previewIcon: { fontSize: 34, marginBottom: 8 },
  previewText: { color: theme.muted, fontSize: 13 },

  actions: { display: "flex", gap: 10, flexWrap: "wrap" },

  errorBox: {
    borderRadius: 16,
    border: `1px solid rgba(239,68,68,0.35)`,
    background: `rgba(239,68,68,0.08)`,
    padding: 12,
  },
  errorHint: { marginTop: 8, fontSize: 12, color: theme.muted },

  chipsWrap: { display: "flex", flexWrap: "wrap", gap: 8 },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    borderRadius: 999,
    border: `1px solid ${withAlpha(theme.primary, 0.20)}`,
    background: withAlpha(theme.primary, 0.07),
  },
  chipInput: {
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: 14,
    minWidth: 70,
    color: theme.text,
  },
  chipMeta: { fontSize: 12, color: theme.muted },
  chipX: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    opacity: 0.7,
    fontSize: 14,
    color: theme.primary,
  },

  addRow: { marginTop: 12, display: "flex", gap: 10 },
  textInput: {
    flex: 1,
    padding: "10px 12px",
    borderRadius: 12,
    border: `1px solid ${theme.border}`,
    outline: "none",
  },

  emptyText: { margin: 0, color: theme.muted },

  recipeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 12,
  },
  recipeCard: {
    borderRadius: 18,
    border: `1px solid ${theme.border}`,
    background: `linear-gradient(180deg, ${withAlpha(theme.primary, 0.03)}, transparent)`,
    padding: 14,
  },
  recipeTop: { display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" },
  recipeTitle: { fontWeight: 900, fontSize: 16, letterSpacing: -0.2 },
  recipeMeta: { marginTop: 6, fontSize: 12, color: theme.muted },

  sectionLabel: { marginTop: 12, marginBottom: 6, fontWeight: 900, fontSize: 12, color: theme.muted },
  steps: { marginTop: 0, marginBottom: 0, paddingLeft: 18 },

  missingWrap: { display: "flex", flexWrap: "wrap", gap: 8 },
  missingChip: {
    padding: "6px 10px",
    borderRadius: 999,
    border: `1px dashed ${withAlpha(theme.accent, 0.45)}`,
    background: withAlpha(theme.accent, 0.08),
    fontSize: 13,
    color: theme.text,
  },

  shopList: { marginTop: 10, marginBottom: 0, paddingLeft: 0, listStyle: "none" },
  shopItem: { padding: "8px 0", borderBottom: "1px solid rgba(0,0,0,0.06)" },
  shopLabel: { display: "flex", alignItems: "center", gap: 10 },
  shopX: { border: "none", background: "transparent", cursor: "pointer", opacity: 0.7, color: theme.primary },
};


