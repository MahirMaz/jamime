CREATE database jamime;
USE jamime;

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