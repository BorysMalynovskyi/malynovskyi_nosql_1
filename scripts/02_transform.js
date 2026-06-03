const db = db.getSiblingDB("spotify");

// 1. Видаляємо стару колекцію tracks (ідемпотентний повторний запуск)
db.tracks.drop();

db.tracks_raw.aggregate([
  // 2. Проєкція потрібних полів (+ сирий рядок артистів та аудіофічі для подальшої обробки)
  {
    $project: {
      _id: 0,
      track_id: 1,
      track_name: 1,
      album_name: 1,
      explicit: 1,
      popularity: 1,
      duration_ms: 1,
      track_genre: 1,
      artists_raw: "$artists",
      danceability: 1,
      energy: 1,
      loudness: 1,
      speechiness: 1,
      acousticness: 1,
      instrumentalness: 1,
      liveness: 1,
      valence: 1,
      tempo: 1,
      key: 1,
      mode: 1,
      time_signature: 1,
    },
  },

  // 3. Артисти: розбити по ";", прибрати пробіли → масив artists
  // 4. Вкладений об'єкт audio_features + обчислювані поля
  {
    $set: {
      artists: {
        $map: {
          input: { $split: ["$artists_raw", ";"] },
          as: "a",
          in: { $trim: { input: "$$a" } },
        },
      },
      audio_features: {
        danceability: "$danceability",
        energy: "$energy",
        loudness: "$loudness",
        speechiness: "$speechiness",
        acousticness: "$acousticness",
        instrumentalness: "$instrumentalness",
        liveness: "$liveness",
        valence: "$valence",
        tempo: "$tempo",
        key: "$key",
        mode: "$mode",
        time_signature: "$time_signature",
      },
      duration_sec: { $round: [{ $divide: ["$duration_ms", 1000] }, 1] },
      popularity_tier: {
        $switch: {
          branches: [
            { case: { $gte: ["$popularity", 70] }, then: "high" },
            { case: { $gte: ["$popularity", 40] }, then: "medium" },
          ],
          default: "low",
        },
      },
    },
  },

  // 5. Прибрати вихідні (плоскі) аудіофічі та сирий рядок артистів
  {
    $unset: [
      "artists_raw",
      "danceability",
      "energy",
      "loudness",
      "speechiness",
      "acousticness",
      "instrumentalness",
      "liveness",
      "valence",
      "tempo",
      "key",
      "mode",
      "time_signature",
    ],
  },

  // 6. Зберегти результат у колекцію tracks
  { $out: "tracks" },
]);

// 7. Перевірка результату
print("Документів у tracks: " + db.tracks.countDocuments());
print("Приклад документа:");
printjson(db.tracks.findOne());
