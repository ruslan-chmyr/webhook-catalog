import { readCurrentUser, type MockFailure, type MockFieldErrors, type MockResult } from './authState';
import { isAbsoluteHttpUrl } from '@/features/webhooks/utils/webhookUrl';

export type MockWebhook = {
  id: string;
  name: string;
  url: string;
  rating: number;
  duration: number;
  active: boolean;
  created_at: string;
};

export type MockWebhookList = {
  data: MockWebhook[];
  paging: {
    pages: {
      current: number;
      last: number;
    };
    results: {
      total: number;
      limitation: number;
    };
  };
};

const MOVIES: readonly { id: string; name: string; rating: number; duration: number; released: string }[] = [
  { id: 'citizen-kane', name: 'Citizen Kane', rating: 8.3, duration: 119, released: '1941-05-01' },
  { id: 'the-godfather', name: 'The Godfather', rating: 9.2, duration: 175, released: '1972-03-24' },
  { id: 'casablanca', name: 'Casablanca', rating: 8.5, duration: 102, released: '1942-11-26' },
  { id: 'the-wizard-of-oz', name: 'The Wizard of Oz', rating: 8.1, duration: 102, released: '1939-08-25' },
  { id: 'lawrence-of-arabia', name: 'Lawrence of Arabia', rating: 8.3, duration: 227, released: '1962-12-10' },
  { id: 'psycho', name: 'Psycho', rating: 8.5, duration: 109, released: '1960-06-16' },
  { id: '2001-a-space-odyssey', name: '2001: A Space Odyssey', rating: 8.3, duration: 149, released: '1968-04-03' },
  { id: 'star-wars', name: 'Star Wars', rating: 8.6, duration: 121, released: '1977-05-25' },
  { id: 'singin-in-the-rain', name: "Singin' in the Rain", rating: 8.3, duration: 103, released: '1952-04-11' },
  { id: 'sunset-boulevard', name: 'Sunset Boulevard', rating: 8.4, duration: 110, released: '1950-08-10' },
  { id: 'vertigo', name: 'Vertigo', rating: 8.3, duration: 128, released: '1958-05-09' },
  { id: 'seven-samurai', name: 'Seven Samurai', rating: 8.6, duration: 207, released: '1954-04-26' },
  { id: 'the-searchers', name: 'The Searchers', rating: 7.9, duration: 119, released: '1956-05-26' },
  { id: '12-angry-men', name: '12 Angry Men', rating: 9.0, duration: 96, released: '1957-04-10' },
  { id: 'some-like-it-hot', name: 'Some Like It Hot', rating: 8.2, duration: 121, released: '1959-03-29' },
  { id: 'the-sound-of-music', name: 'The Sound of Music', rating: 8.1, duration: 172, released: '1965-03-02' },
  { id: 'the-good-the-bad-and-the-ugly', name: 'The Good, the Bad and the Ugly', rating: 8.8, duration: 178, released: '1966-12-23' },
  { id: 'the-exorcist', name: 'The Exorcist', rating: 8.1, duration: 122, released: '1973-12-26' },
  { id: 'chinatown', name: 'Chinatown', rating: 8.1, duration: 130, released: '1974-06-20' },
  { id: 'jaws', name: 'Jaws', rating: 8.1, duration: 124, released: '1975-06-20' },
  { id: 'one-flew-over-the-cuckoos-nest', name: "One Flew Over the Cuckoo's Nest", rating: 8.7, duration: 133, released: '1975-11-19' },
  { id: 'rocky', name: 'Rocky', rating: 8.1, duration: 120, released: '1976-12-03' },
  { id: 'annie-hall', name: 'Annie Hall', rating: 7.9, duration: 93, released: '1977-04-20' },
  { id: 'alien', name: 'Alien', rating: 8.5, duration: 117, released: '1979-05-25' },
  { id: 'apocalypse-now', name: 'Apocalypse Now', rating: 8.4, duration: 153, released: '1979-08-15' },
  { id: 'raiders-of-the-lost-ark', name: 'Raiders of the Lost Ark', rating: 8.4, duration: 115, released: '1981-06-12' },
  { id: 'et-the-extra-terrestrial', name: 'E.T. the Extra-Terrestrial', rating: 7.9, duration: 115, released: '1982-06-11' },
  { id: 'blade-runner', name: 'Blade Runner', rating: 8.1, duration: 117, released: '1982-06-25' },
  { id: 'amadeus', name: 'Amadeus', rating: 8.4, duration: 160, released: '1984-09-19' },
  { id: 'back-to-the-future', name: 'Back to the Future', rating: 8.5, duration: 116, released: '1985-07-03' },
  { id: 'die-hard', name: 'Die Hard', rating: 8.2, duration: 132, released: '1988-07-15' },
  { id: 'goodfellas', name: 'Goodfellas', rating: 8.7, duration: 145, released: '1990-09-19' },
  { id: 'the-silence-of-the-lambs', name: 'The Silence of the Lambs', rating: 8.6, duration: 118, released: '1991-02-14' },
  { id: 'schindlers-list', name: "Schindler's List", rating: 9.0, duration: 195, released: '1993-12-15' },
  { id: 'pulp-fiction', name: 'Pulp Fiction', rating: 8.8, duration: 154, released: '1994-10-14' },
  { id: 'the-shawshank-redemption', name: 'The Shawshank Redemption', rating: 9.3, duration: 142, released: '1994-09-23' },
  { id: 'toy-story', name: 'Toy Story', rating: 8.3, duration: 81, released: '1995-11-22' },
  { id: 'the-matrix', name: 'The Matrix', rating: 8.7, duration: 136, released: '1999-03-31' },
  { id: 'spirited-away', name: 'Spirited Away', rating: 8.6, duration: 125, released: '2001-07-20' },
  { id: 'the-lord-of-the-rings-the-fellowship-of-the-ring', name: 'The Lord of the Rings: The Fellowship of the Ring', rating: 8.9, duration: 178, released: '2001-12-19' },
  { id: 'parasite', name: 'Parasite', rating: 8.5, duration: 132, released: '2019-05-30' },
  { id: 'city-lights', name: 'City Lights', rating: 8.5, duration: 87, released: '1931-01-30' },
  { id: 'king-kong', name: 'King Kong', rating: 7.9, duration: 100, released: '1933-03-02' },
  { id: 'snow-white-and-the-seven-dwarfs', name: 'Snow White and the Seven Dwarfs', rating: 7.6, duration: 83, released: '1937-12-21' },
  { id: 'gone-with-the-wind', name: 'Gone with the Wind', rating: 8.2, duration: 238, released: '1939-12-15' },
  { id: 'double-indemnity', name: 'Double Indemnity', rating: 8.3, duration: 107, released: '1944-04-24' },
  { id: 'rear-window', name: 'Rear Window', rating: 8.5, duration: 112, released: '1954-09-01' },
  { id: 'on-the-waterfront', name: 'On the Waterfront', rating: 8.1, duration: 108, released: '1954-07-28' },
  { id: 'metropolis', name: 'Metropolis', rating: 8.3, duration: 153, released: '1927-01-10' },
  { id: 'the-gold-rush', name: 'The Gold Rush', rating: 8.1, duration: 95, released: '1925-06-26' },
];

function createInitialWebhooks(): MockWebhook[] {
  return MOVIES.map((movie, index) => ({
    id: movie.id,
    name: movie.name,
    url: `https://www.imdb.com/find/?q=${encodeURIComponent(movie.name)}`,
    rating: movie.rating,
    duration: movie.duration,
    active: index % 2 === 0,
    created_at: new Date(`${movie.released}T12:00:00.000Z`).toISOString(),
  }));
}

let webhooks = createInitialWebhooks();

export function resetMockWebhooks(): void {
  webhooks = createInitialWebhooks();
}

export function listWebhooks(url: URL): MockResult<MockWebhookList> {
  const session = readCurrentUser();
  if (!session.ok) {
    return session;
  }

  const page = readPositiveInt(url.searchParams.get('page'), 1);
  const limit = readPositiveInt(url.searchParams.get('limit'), 10);
  const search = (url.searchParams.get('search') ?? '').trim().toLowerCase();
  const filtered = webhooks.filter((webhook) => {
    if (search === '') {
      return true;
    }

    return webhook.name.toLowerCase().includes(search);
  });
  const ranked = [...filtered].sort((left, right) => right.rating - left.rating);
  const last = Math.max(1, Math.ceil(ranked.length / limit));
  const start = (page - 1) * limit;

  return {
    ok: true,
    value: {
      data: ranked.slice(start, start + limit).map(copyWebhook),
      paging: {
        pages: {
          current: page,
          last,
        },
        results: {
          total: filtered.length,
          limitation: limit,
        },
      },
    },
  };
}

export function readWebhook(id: string): MockResult<MockWebhook> {
  const session = readCurrentUser();
  if (!session.ok) {
    return session;
  }

  const webhook = webhooks.find((item) => item.id === id);
  if (webhook === undefined) {
    return notFound();
  }

  return {
    ok: true,
    value: copyWebhook(webhook),
  };
}

export function updateWebhook(id: string, body: unknown): MockResult<MockWebhook> {
  const session = readCurrentUser();
  if (!session.ok) {
    return session;
  }

  const index = webhooks.findIndex((item) => item.id === id);
  if (index < 0) {
    return notFound();
  }

  const record = isRecord(body) ? body : {};
  const name = typeof record.name === 'string' ? record.name.trim() : '';
  const url = typeof record.url === 'string' ? record.url.trim() : '';
  const fieldErrors: MockFieldErrors = {};

  if (name === '') {
    fieldErrors.name = ['Name is required.'];
  }
  if (url === '') {
    fieldErrors.url = ['URL is required.'];
  } else if (!isAbsoluteHttpUrl(url)) {
    fieldErrors.url = ['Must be a valid HTTP/HTTPS URL.'];
  }

  if (Object.keys(fieldErrors).length > 0) {
    return validation(fieldErrors);
  }

  const current = webhooks[index];
  if (current === undefined) {
    return notFound();
  }

  const updated: MockWebhook = {
    ...current,
    name,
    url,
  };
  webhooks[index] = updated;
  return {
    ok: true,
    value: copyWebhook(updated),
  };
}

function copyWebhook(webhook: MockWebhook): MockWebhook {
  return { ...webhook };
}

function notFound(): MockFailure {
  return {
    ok: false,
    status: 404,
    type: 'NotFoundException',
    message: 'Webhook not found.',
  };
}

function validation(fieldErrors: MockFieldErrors): MockFailure {
  return {
    ok: false,
    status: 422,
    type: 'ValidationException',
    message: 'The given data was invalid.',
    fieldErrors,
  };
}

function readPositiveInt(value: string | null, fallback: number): number {
  if (value === null || value.trim() === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
