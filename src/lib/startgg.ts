import type {
  StartggEvent,
  StartggStanding,
  StartggSet,
  StartggTournamentData,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STARTGG_ENDPOINT = "https://api.start.gg/gql/alpha";
const SMASH_ULTIMATE_VIDEOGAME_ID = 1386;

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startggQuery<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const token = process.env.STARTGG_API_TOKEN;
  if (!token) {
    throw new Error(
      "STARTGG_API_TOKEN environment variable is not set. Generate one at https://start.gg/admin/profile/developer",
    );
  }

  const response = await fetch(STARTGG_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(
      `start.gg API returned HTTP ${response.status}: ${response.statusText}`,
    );
  }

  const json = (await response.json()) as {
    data?: T;
    errors?: { message: string }[];
  };

  if (json.errors && json.errors.length > 0) {
    const messages = json.errors.map((e) => e.message).join("; ");
    throw new Error(`start.gg GraphQL error: ${messages}`);
  }

  if (!json.data) {
    throw new Error("start.gg API returned an empty data payload");
  }

  return json.data;
}

// ---------------------------------------------------------------------------
// GraphQL query strings
// ---------------------------------------------------------------------------

const TOURNAMENT_EVENTS_QUERY = `
query TournamentEvents($slug: String!, $videogameId: [ID]!) {
  tournament(slug: $slug) {
    id
    name
    startAt
    events(filter: { videogameId: $videogameId }) {
      id
      name
      numEntrants
    }
  }
}
`;

const EVENT_STANDINGS_QUERY = `
query EventStandings($eventId: ID!, $page: Int!, $perPage: Int!) {
  event(id: $eventId) {
    id
    name
    standings(query: { perPage: $perPage, page: $page }) {
      pageInfo {
        total
        totalPages
      }
      nodes {
        placement
        entrant {
          id
          name
          participants {
            id
            gamerTag
            prefix
            player {
              id
              gamerTag
            }
          }
        }
      }
    }
  }
}
`;

const EVENT_SETS_QUERY = `
query EventSets($eventId: ID!, $page: Int!, $perPage: Int!) {
  event(id: $eventId) {
    id
    name
    sets(page: $page, perPage: $perPage, sortType: STANDARD) {
      pageInfo {
        total
        totalPages
      }
      nodes {
        id
        displayScore
        fullRoundText
        winnerId
        slots {
          id
          entrant {
            id
            name
            participants {
              player {
                id
                gamerTag
              }
            }
          }
          standing {
            placement
            stats {
              score {
                value
              }
            }
          }
        }
      }
    }
  }
}
`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract the tournament slug and optional event slug from a start.gg URL.
 *
 * Accepts URLs like:
 *   https://www.start.gg/tournament/genesis-x/event/ultimate-singles/overview
 *   https://www.start.gg/tournament/genesis-x/events
 *   https://start.gg/tournament/elon-weekly-42
 *
 * Returns { tournamentSlug, eventSlug } or null if invalid.
 */
export function extractSlugs(url: string): {
  tournamentSlug: string;
  eventSlug: string | null;
} | null {
  const tournamentMatch = url.match(/start\.gg\/tournament\/([^/]+)/);
  if (!tournamentMatch) return null;

  const eventMatch = url.match(
    /start\.gg\/tournament\/[^/]+\/event\/([^/]+)/
  );

  return {
    tournamentSlug: tournamentMatch[1],
    eventSlug: eventMatch ? eventMatch[1] : null,
  };
}

/**
 * Fetch tournament metadata and all Smash Ultimate events for a tournament.
 * Events are sorted by entrant count descending (largest first).
 */
export async function fetchTournamentEvents(
  slug: string,
): Promise<StartggTournamentData> {
  interface TournamentEventsResponse {
    tournament: {
      id: number;
      name: string;
      startAt: number | null;
      events: StartggEvent[];
    } | null;
  }

  const data = await startggQuery<TournamentEventsResponse>(
    TOURNAMENT_EVENTS_QUERY,
    { slug, videogameId: [SMASH_ULTIMATE_VIDEOGAME_ID] },
  );

  if (!data.tournament) {
    throw new Error(
      `Tournament not found for slug "${slug}". Check the URL and try again.`,
    );
  }

  // Sort events by entrant count descending so the main event is first
  const events = (data.tournament.events ?? []).sort(
    (a, b) => b.numEntrants - a.numEntrants
  );

  return {
    name: data.tournament.name,
    startAt: data.tournament.startAt,
    events,
  };
}

/**
 * Fetch all standings (placements) for a given event, handling pagination.
 *
 * Uses perPage 100 to stay under the 1000 object complexity cap (~8 objects per standing).
 * Adds a 400ms delay between paginated requests to respect rate limits.
 * (80 req/min limit, but burst-safe since imports are single-threaded.)
 */
export async function fetchEventStandings(
  eventId: number,
  perPage: number = 100,
): Promise<StartggStanding[]> {
  interface StandingsResponse {
    event: {
      id: number;
      name: string;
      standings: {
        pageInfo: { total: number; totalPages: number };
        nodes: StartggStanding[];
      } | null;
    } | null;
  }

  const allStandings: StartggStanding[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    if (page > 1) {
      await delay(400);
    }

    const data = await startggQuery<StandingsResponse>(
      EVENT_STANDINGS_QUERY,
      { eventId, page, perPage },
    );

    if (!data.event?.standings) {
      break;
    }

    const { pageInfo, nodes } = data.event.standings;
    totalPages = pageInfo.totalPages;

    if (nodes) {
      allStandings.push(...nodes);
    }

    page++;
  } while (page <= totalPages);

  return allStandings;
}

/**
 * Fetch all sets (match/bracket data) for a given event, handling pagination.
 *
 * Uses perPage 40 to stay under the 1000 object complexity cap (~17 objects per set).
 * Adds a 400ms delay between paginated requests to respect rate limits.
 */
export async function fetchEventSets(
  eventId: number,
  perPage: number = 40,
): Promise<StartggSet[]> {
  interface SetsResponse {
    event: {
      id: number;
      name: string;
      sets: {
        pageInfo: { total: number; totalPages: number };
        nodes: StartggSet[];
      } | null;
    } | null;
  }

  const allSets: StartggSet[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    if (page > 1) {
      await delay(400);
    }

    const data = await startggQuery<SetsResponse>(EVENT_SETS_QUERY, {
      eventId,
      page,
      perPage,
    });

    if (!data.event?.sets) {
      break;
    }

    const { pageInfo, nodes } = data.event.sets;
    totalPages = pageInfo.totalPages;

    if (nodes) {
      allSets.push(...nodes);
    }

    page++;
  } while (page <= totalPages);

  return allSets;
}
