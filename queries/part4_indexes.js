// queries/part4_indexes.js — Частина 4. Індекси та оптимізація (база spotify).
// Запуск: mongosh "ВАШ_URI" --file queries/part4_indexes.js

const db = db.getSiblingDB("spotify");
const coll = db.tracks;
const rows = []; // підсумкова таблиця по всіх explain-прогонах

function dropIndexSafe(name) { try { coll.dropIndex(name); } catch (e) { /* немає */ } }
function rootPlan(wp) { return wp.queryPlan || wp; }
function stages(wp) { const a = []; let s = rootPlan(wp); while (s) { if (s.stage) a.push(s.stage); s = s.inputStage; } return a; }
function indexName(wp) { let s = rootPlan(wp); while (s) { if (s.indexName) return s.indexName; s = s.inputStage; } return "—"; }

function run(label, exp) {
  const wp = exp.queryPlanner.winningPlan, ex = exp.executionStats;
  rows.push({
    query: label,
    plan: stages(wp).join(" → "),
    docs: ex.totalDocsExamined,
    keys: ex.totalKeysExamined,
    ret: ex.nReturned,
    ms: ex.executionTimeMillis,
    index: indexName(wp),
  });
}

// Завдання 1. Запит + сортування: ДО та ПІСЛЯ індексу (ESR) -----------------
const q1 = { track_genre: "pop", "audio_features.danceability": { $gte: 0.7 } };
const IDX1 = "genre_popularity_danceability_idx";

dropIndexSafe(IDX1);
run("Q1 без індексу", coll.find(q1).sort({ popularity: -1 }).explain("executionStats"));

coll.createIndex({ track_genre: 1, popularity: -1, "audio_features.danceability": 1 }, { name: IDX1 });
run("Q1 з індексом", coll.find(q1).sort({ popularity: -1 }).explain("executionStats"));

// Завдання 2. Складений індекс для «музики для роботи» ----------------------
const IDX2 = "work_music_idx";
dropIndexSafe(IDX2);
coll.createIndex({ explicit: 1, "audio_features.instrumentalness": 1, "audio_features.speechiness": 1 }, { name: IDX2 });
run("Q2 work-music", coll.find({
  explicit: false,
  "audio_features.instrumentalness": { $gt: 0.5 },
  "audio_features.speechiness": { $lt: 0.1 },
}).explain("executionStats"));

// Завдання 3. Покривний запит: без проєкції vs з проєкцією ------------------
const q3 = { track_genre: "pop", popularity: { $gte: 70 } };
run("Q3 без проєкції", coll.find(q3).explain("executionStats"));
run("Q3 покривний", coll.find(q3, { _id: 0, track_genre: 1, popularity: 1 }).explain("executionStats"));

// Вивід ---------------------------------------------------------------------
print("\nПорівняння планів виконання (explain executionStats):");
console.table(rows, ["query", "plan", "docs", "keys", "ret", "ms"]);

print("\nВикористаний індекс по запитах:");
rows.forEach((r) => print(`  ${r.query.padEnd(16)} → ${r.index}`));

print("\nІндекси колекції tracks:");
coll.getIndexes().forEach((i) => {
  print(`  • ${i.name}`);
  print(`      ${JSON.stringify(i.key)}`);
});
