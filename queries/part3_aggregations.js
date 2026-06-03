const db = db.getSiblingDB("spotify");

const MOOD_THRESHOLD = 0.5;

// Завдання 1. Топ-10 виконавців за середньою популярністю (мінімум 5 треків).
print("\nЗавдання 1. Топ-10 виконавців за середньою популярністю");

printjson(
  db.tracks
    .aggregate([
      { $unwind: "$artists" },
      {
        $group: {
          _id: "$artists",
          track_count: { $sum: 1 },
          avg_popularity: { $avg: "$popularity" },
        },
      },
      { $match: { track_count: { $gte: 5 } } },
      {
        $project: {
          _id: 0,
          artist: "$_id",
          track_count: 1,
          avg_popularity: { $round: ["$avg_popularity", 1] },
        },
      },
      { $sort: { avg_popularity: -1 } },
      { $limit: 10 },
    ])
    .toArray()
);

// Завдання 2. Розподіл треків за настроєм (valence × energy).
print("\nЗавдання 2. Розподіл треків за настроєм");

printjson(
  db.tracks
    .aggregate([
      {
        $set: {
          mood: {
            $switch: {
              branches: [
                {
                  case: {
                    $and: [
                      { $gte: ["$audio_features.valence", MOOD_THRESHOLD] },
                      { $gte: ["$audio_features.energy", MOOD_THRESHOLD] },
                    ],
                  },
                  then: "happy",
                },
                {
                  case: {
                    $and: [
                      { $lt: ["$audio_features.valence", MOOD_THRESHOLD] },
                      { $gte: ["$audio_features.energy", MOOD_THRESHOLD] },
                    ],
                  },
                  then: "angry",
                },
                {
                  case: {
                    $and: [
                      { $gte: ["$audio_features.valence", MOOD_THRESHOLD] },
                      { $lt: ["$audio_features.energy", MOOD_THRESHOLD] },
                    ],
                  },
                  then: "calm",
                },
              ],
              default: "sad", // low valence + low energy
            },
          },
        },
      },
      { $group: { _id: "$mood", track_count: { $sum: 1 } } },
      { $project: { _id: 0, mood: "$_id", track_count: 1 } },
      { $sort: { track_count: -1 } },
    ])
    .toArray()
);

// Завдання 3. Найбільш «танцювальний» жанр.
print("\nЗавдання 3. Найбільш «танцювальний» жанр");

printjson(
  db.tracks
    .aggregate([
      {
        $group: {
          _id: "$track_genre",
          avg_danceability: { $avg: "$audio_features.danceability" },
          avg_energy: { $avg: "$audio_features.energy" },
          avg_valence: { $avg: "$audio_features.valence" },
          track_count: { $sum: 1 },
        },
      },
      { $match: { track_count: { $gte: 100 } } },
      {
        $project: {
          _id: 0,
          genre: "$_id",
          avg_danceability: { $round: ["$avg_danceability", 3] },
          avg_energy: { $round: ["$avg_energy", 3] },
          avg_valence: { $round: ["$avg_valence", 3] },
          track_count: 1,
        },
      },
      { $sort: { avg_danceability: -1 } },
    ])
    .toArray()
);
