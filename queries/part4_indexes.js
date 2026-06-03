const db = db.getSiblingDB("spotify");
const coll = db.tracks;

function dropIndexSafe(name) {
  try {
    coll.dropIndex(name);
  } catch (e) {
    /* індексу немає */
  }
}

// Корінь плану (враховуємо SBE, де реальний план лежить у queryPlan).
function rootPlan(winningPlan) {
  return winningPlan.queryPlan || winningPlan;
}

// Список стадій плану згори вниз: напр. ["SORT", "FETCH", "IXSCAN"].
function planStages(winningPlan) {
  const stages = [];
  let s = rootPlan(winningPlan);
  while (s) {
    if (s.stage) stages.push(s.stage);
    s = s.inputStage;
  }
  return stages;
}

// Ім'я використаного індексу (якщо є IXSCAN).
function indexNameOf(winningPlan) {
  let s = rootPlan(winningPlan);
  while (s) {
    if (s.indexName) return s.indexName;
    s = s.inputStage;
  }
  return null;
}

// Друкуємо ключові показники explain("executionStats").
function summarize(label, exp) {
  const wp = exp.queryPlanner.winningPlan;
  const ex = exp.executionStats;
  print("\n" + label);
  print("stages: " + planStages(wp).join(" -> "));
  print("indexName: " + (indexNameOf(wp) || "—"));
  print("nReturned: " + ex.nReturned);
  print("totalKeysExamined: " + ex.totalKeysExamined);
  print("totalDocsExamined: " + ex.totalDocsExamined);
  print("executionTimeMillis: " + ex.executionTimeMillis);
}

// Завдання 1. Аналіз запиту та індексація
print("\nЗавдання 1. Аналіз запиту та індексація");

const q1 = { track_genre: "pop", "audio_features.danceability": { $gte: 0.7 } };
const sort1 = { popularity: -1 };
const IDX1 = "genre_popularity_danceability_idx";

// (a) План ДО індексу — прибираємо наш індекс, якщо лишився з попереднього запуску
dropIndexSafe(IDX1);
summarize(
  "1a. ДО індексу",
  coll.find(q1).sort(sort1).explain("executionStats")
);

// (b) Створюємо складений індекс за правилом ESR:
//     Equality (track_genre) -> Sort (popularity) -> Range (danceability)
coll.createIndex(
  { track_genre: 1, popularity: -1, "audio_features.danceability": 1 },
  { name: IDX1 }
);

// (c) План ПІСЛЯ індексу
summarize(
  "1b. ПІСЛЯ індексу",
  coll.find(q1).sort(sort1).explain("executionStats")
);

// Завдання 2. Складений індекс для "музики для роботи"
print("\nЗавдання 2. Складений індекс для пошуку музики для роботи");

const IDX2 = "work_music_idx";
dropIndexSafe(IDX2);
coll.createIndex(
  {
    explicit: 1,
    "audio_features.instrumentalness": 1,
    "audio_features.speechiness": 1,
  },
  { name: IDX2 }
);

const q2 = {
  explicit: false,
  "audio_features.instrumentalness": { $gt: 0.5 },
  "audio_features.speechiness": { $lt: 0.1 },
};
summarize("2. Пошук з новим індексом", coll.find(q2).explain("executionStats"));

// Завдання 3. Покривний запит (covered query)
print("\nЗавдання 3. Перевірка покривного запиту");

const q3 = { track_genre: "pop", popularity: { $gte: 70 } };

// (a) find() БЕЗ проєкції — повертає цілі документи => потрібен FETCH (НЕ покривний)
summarize(
  "3a. Без проєкції (повертаються цілі документи)",
  coll.find(q3).explain("executionStats")
);

// (b) Та сама фільтрація, але з проєкцією лише на поля індексу й без _id
//     => запит стає ПОКРИВНИМ (totalDocsExamined = 0, без стадії FETCH)
summarize(
  "3b. З проєкцією { _id: 0, track_genre: 1, popularity: 1 } (покривний)",
  coll.find(q3, { _id: 0, track_genre: 1, popularity: 1 }).explain("executionStats")
);

print("\nІндекси колекції tracks");
printjson(coll.getIndexes());
