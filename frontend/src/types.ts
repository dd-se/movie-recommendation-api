export interface Movie {
  tmdb_id: number;
  title: string;
  release_date: string | null;
  status: string | null;
  runtime: number | null;
  vote_average: number | null;
  vote_count: number | null;
  popularity: number | null;
  genres: string | null;
  cast: string | null;
  overview: string | null;
  poster_path: string | null;
}

export interface MovieFilter {
  description?: string;
  title?: string;
  release_date_from?: string;
  release_date_to?: string;
  runtime_min?: number;
  runtime_max?: number;
  vote_average_min?: number;
  vote_count_min?: number;
  popularity_min?: number;
  genres?: string[];
  production_countries?: string[];
  keywords?: string[];
  spoken_languages?: string[];
  cast?: string[];
  n_results?: number;
}

export interface User {
  email: string;
  access_token_scopes: string[] | null;
  access_token_expires: string | null;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
}

export type Endpoint = '/v1/movie' | '/v2/movie' | '/v2/search';
