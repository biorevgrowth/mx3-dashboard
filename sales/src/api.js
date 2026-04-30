const API_URL = import.meta.env.VITE_API_URL || "";

async function fetchAPI(path) {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`);
  return res.json();
}

// Postgres NUMERIC columns come as strings — coerce to numbers
function numify(obj) {
  if (!obj) return obj;
  if (Array.isArray(obj)) return obj.map(numify);
  const out = { ...obj };
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === "string" && v !== "" && !isNaN(v) &&
        !k.includes("date") && !k.includes("name") && !k.includes("hash")) {
      out[k] = Number(v);
    }
  }
  return out;
}

export async function fetchRepData(repId) {
  const [snapshot, goals, pipeline, distributors, history] = await Promise.all([
    fetchAPI(`/api/rep/${repId}/snapshot`),
    fetchAPI(`/api/rep/${repId}/goals`),
    fetchAPI(`/api/rep/${repId}/pipeline`),
    fetchAPI(`/api/rep/${repId}/distributors`),
    fetchAPI(`/api/rep/${repId}/history`),
  ]);
  return {
    snapshot: numify(snapshot) || {},
    goals: numify(goals) || {},
    pipeline: numify(pipeline) || [],
    distributors: numify(distributors) || [],
    history: numify(history) || [],
  };
}

export async function fetchKingaExtras() {
  const [sports] = await Promise.all([
    fetchAPI("/api/rep/kinga/sports"),
  ]);
  return { sports: numify(sports) || [] };
}

export async function fetchPeteExtras() {
  const [products, fallenAngels] = await Promise.all([
    fetchAPI("/api/rep/pete/products"),
    fetchAPI("/api/rep/pete/fallen-angels"),
  ]);
  return {
    products: numify(products) || [],
    fallenAngels: numify(fallenAngels) || [],
  };
}

export async function fetchReps() {
  return fetchAPI("/api/reps");
}
