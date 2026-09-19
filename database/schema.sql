CREATE DATABASE IF NOT EXISTS jamime
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE jamime;

CREATE TABLE IF NOT EXISTS anime (
    id INT AUTO_INCREMENT PRIMARY KEY,
    anilist_id INT UNIQUE,
    title_english VARCHAR(255),
    title_romaji VARCHAR(255),
    title_native VARCHAR(255),
    year INT,
    popularity INT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS songs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    anime_id INT NOT NULL,
    animethemes_id INT UNIQUE,
    title VARCHAR(255),
    artist VARCHAR(255),
    theme_type VARCHAR(10),
    theme_number INT,
    video_url TEXT,
    audio_url TEXT,
    FOREIGN KEY (anime_id) REFERENCES anime(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
