// queries/part2_queries.js — Частина 2. Запити до колекції tracks (база spotify).
// Запуск: mongosh "ВАШ_URI" --file queries/part2_queries.js

const db = db.getSiblingDB("spotify");
const PREVIEW = 5; // рядків у прев'ю

// Завдання 1. Треки для вечірки -------------------------------------------
const partyFilter = {
  "audio_features.danceability": { $gt: 0.7 },
  "audio_features.energy": { $gt: 0.7 },
  duration_ms: { $gte: 180000, $lte: 300000 },
};

print(`\nЗавдання 1. Треки для вечірки — знайдено: ${db.tracks.countDocuments(partyFilter)}`);
console.table(
  db.tracks.find(partyFilter).limit(PREVIEW).toArray().map((t) => ({
    track_name: t.track_name,
    artists: t.artists.join(", "),
    min: +(t.duration_ms / 60000).toFixed(1),
    dance: t.audio_features.danceability,
    energy: t.audio_features.energy,
  }))
);

// Завдання 2. Виконавці, у яких усі треки популярні (топ-20) --------------
print("\nЗавдання 2. Виконавці з усіма популярними треками (топ-20)");
console.table(
  db.tracks.aggregate([
    { $unwind: "$artists" },
    { $group: { _id: "$artists", track_count: { $sum: 1 },
        min_popularity: { $min: "$popularity" }, avg_popularity: { $avg: "$popularity" } } },
    { $match: { track_count: { $gte: 3 }, min_popularity: { $gte: 60 } } },
    { $project: { _id: 0, artist: "$_id", track_count: 1, min_popularity: 1,
        avg_popularity: { $round: ["$avg_popularity", 1] } } },
    { $sort: { avg_popularity: -1, track_count: -1 } },
    { $limit: 20 },
  ]).toArray()
);

// Завдання 3. Нетипові треки за темпом (по жанрах) ------------------------
const outliers = db.tracks.aggregate([
  { $group: { _id: "$track_genre",
      avg_tempo: { $avg: "$audio_features.tempo" },
      std_tempo: { $stdDevPop: "$audio_features.tempo" },
      tracks: { $push: { _id: "$_id", track_name: "$track_name",
        popularity: "$popularity", artists: "$artists", tempo: "$audio_features.tempo" } } } },
  { $set: { outlier_threshold: { $add: ["$avg_tempo", { $multiply: [2, "$std_tempo"] }] } } },
  { $project: { _id: 0, genre: "$_id",
      avg_tempo: { $round: ["$avg_tempo", 1] },
      outlier_threshold: { $round: ["$outlier_threshold", 1] },
      outlier_tracks: { $map: {
        input: { $filter: { input: "$tracks", as: "t", cond: { $gt: ["$$t.tempo", "$outlier_threshold"] } } },
        as: "t", in: { _id: "$$t._id", track_name: "$$t.track_name", popularity: "$$t.popularity",
          artists: "$$t.artists", audio_features: { tempo: "$$t.tempo" } } } } } },
  { $sort: { genre: 1 } },
]).toArray();

print(`\nЗавдання 3. Нетипові треки за темпом — оброблено жанрів: ${outliers.length}`);
console.table(
  outliers.slice(0, PREVIEW).map((g) => ({
    genre: g.genre, avg_tempo: g.avg_tempo, threshold: g.outlier_threshold,
    n_outliers: g.outlier_tracks.length,
  }))
);
print("Приклад структури (перший жанр):");
printjson({ ...outliers[0], outlier_tracks: outliers[0].outlier_tracks.slice(0, 2) });

// Завдання 4. Треки для фонової роботи -----------------------------------
const focusFilter = {
  "audio_features.loudness": { $lt: -10 },
  "audio_features.speechiness": { $lt: 0.1 },
  "audio_features.instrumentalness": { $gt: 0.5 },
  explicit: false,
};

print(`\nЗавдання 4. Треки для фонової роботи — знайдено: ${db.tracks.countDocuments(focusFilter)}`);
console.table(
  db.tracks.find(focusFilter).limit(PREVIEW).toArray().map((t) => ({
    track_name: t.track_name,
    artists: t.artists.join(", "),
    genre: t.track_genre,
    loudness: t.audio_features.loudness,
    instrum: t.audio_features.instrumentalness,
  }))
);
