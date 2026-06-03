const db = db.getSiblingDB("spotify");
const PREVIEW = 10; // скільки документів показувати у прев'ю find-запитів

// Завдання 1. Треки для вечірки
print("\nЗавдання 1. Треки для вечірки");

const partyFilter = {
  "audio_features.danceability": { $gt: 0.7 },
  "audio_features.energy": { $gt: 0.7 },
  duration_ms: { $gte: 180000, $lte: 300000 },
};

print("Знайдено треків: " + db.tracks.countDocuments(partyFilter));
printjson(
  db.tracks
    .find(partyFilter, { _id: 0, track_name: 1, artists: 1, duration_ms: 1, "audio_features.danceability": 1, "audio_features.energy": 1 })
    .limit(PREVIEW)
    .toArray()
);

// Завдання 2. Виконавці, у яких усі треки популярні
print("\nЗавдання 2. Виконавці з усіма популярними треками (топ-20)");

printjson(
  db.tracks
    .aggregate([
      { $unwind: "$artists" },
      {
        $group: {
          _id: "$artists",
          track_count: { $sum: 1 },
          min_popularity: { $min: "$popularity" },
          avg_popularity: { $avg: "$popularity" },
        },
      },
      { $match: { track_count: { $gte: 3 }, min_popularity: { $gte: 60 } } },
      {
        $project: {
          _id: 0,
          artist: "$_id",
          track_count: 1,
          min_popularity: 1,
          avg_popularity: { $round: ["$avg_popularity", 1] },
        },
      },
      { $sort: { avg_popularity: -1, track_count: -1 } },
      { $limit: 20 },
    ])
    .toArray()
);

// Завдання 3. Нетипові треки (аномально високий темп для жанру)
print("\nЗавдання 3. Нетипові треки за темпом (по жанрах)");

printjson(
  db.tracks
    .aggregate([
      {
        $group: {
          _id: "$track_genre",
          avg_tempo: { $avg: "$audio_features.tempo" },
          std_tempo: { $stdDevPop: "$audio_features.tempo" },
          tracks: {
            $push: {
              _id: "$_id",
              track_name: "$track_name",
              popularity: "$popularity",
              artists: "$artists",
              tempo: "$audio_features.tempo",
            },
          },
        },
      },
      {
        $set: {
          outlier_threshold: {
            $add: ["$avg_tempo", { $multiply: [2, "$std_tempo"] }],
          },
        },
      },
      {
        $project: {
          _id: 0,
          genre: "$_id",
          avg_tempo: { $round: ["$avg_tempo", 1] },
          outlier_threshold: { $round: ["$outlier_threshold", 1] },
          outlier_tracks: {
            $map: {
              input: {
                $filter: {
                  input: "$tracks",
                  as: "t",
                  cond: { $gt: ["$$t.tempo", "$outlier_threshold"] },
                },
              },
              as: "t",
              in: {
                _id: "$$t._id",
                track_name: "$$t.track_name",
                popularity: "$$t.popularity",
                artists: "$$t.artists",
                audio_features: { tempo: "$$t.tempo" },
              },
            },
          },
        },
      },
      { $sort: { genre: 1 } },
    ])
    .toArray()
);

// Завдання 4. Треки для фонової роботи
print("\nЗавдання 4. Треки для фонової роботи");

const focusFilter = {
  "audio_features.loudness": { $lt: -10 },
  "audio_features.speechiness": { $lt: 0.1 },
  "audio_features.instrumentalness": { $gt: 0.5 },
  explicit: false,
};

print("Знайдено треків: " + db.tracks.countDocuments(focusFilter));
printjson(
  db.tracks
    .find(focusFilter, { _id: 0, track_name: 1, artists: 1, track_genre: 1, "audio_features.loudness": 1, "audio_features.instrumentalness": 1 })
    .limit(PREVIEW)
    .toArray()
);
