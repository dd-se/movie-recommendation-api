ALLOWED_LANGUAGES = frozenset({"english", "turkish", "swedish"})
EXCLUDED_SOLO_GENRES = frozenset({"documentary", "music"})


def is_acceptable_movie(genres: str | None, spoken_languages: str | None) -> bool:
    if not genres or not spoken_languages:
        return False
    langs = spoken_languages.lower().split(", ")
    genre_list = genres.lower().split(", ")
    has_allowed_lang = any(lang in ALLOWED_LANGUAGES for lang in langs)
    is_not_documentary_or_music = genre_list != ["documentary"] and genre_list != ["music"]
    has_not_documentary_and_music = not ("documentary" in genre_list and "music" in genre_list)
    return has_allowed_lang and is_not_documentary_or_music and has_not_documentary_and_music
