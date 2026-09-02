CREATE database jamime;

CREATE TABLE anime (
	id INT AUTO_INCREMENT PRIMARY KEY,
    anilist_id INT UNIQUE,
	title_english VARCHAR(255),
    title_romaji VARCHAR(255),
    title_native VARCHAR(255),
    year INT,
    popularity INT
);

DESCRIBE anime;

SELECT * FROM anime;

CREATE TABLE songs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    anime_id INT NOT NULL,
    title VARCHAR(255),
    artist VARCHAR(255),
    theme_type VARCHAR(10),
    theme_number INT,
    video_url TEXT,
    FOREIGN KEY (anime_id) REFERENCES anime(id)
);

DESCRIBE songs;
