// Database row types — match docs/schema.sql

export interface Semester {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  created_at: string;
}

export interface Player {
  id: string;
  gamer_tag: string;
  startgg_player_ids: string[];
  created_at: string;
}

export interface PlayerSemesterStatus {
  id: string;
  player_id: string;
  semester_id: string;
  is_elon_student: boolean;
}

export interface Tournament {
  id: string;
  semester_id: string;
  name: string;
  date: string;
  source: "startgg" | "manual";
  startgg_slug: string | null;
  startgg_event_id: string | null;
  total_participants: number;
  elon_participants: number;
  weight: number;
  created_at: string;
}

export interface TournamentResult {
  id: string;
  tournament_id: string;
  player_id: string;
  placement: number;
  score: number;
}

export interface PlayerSemesterScore {
  id: string;
  player_id: string;
  semester_id: string;
  total_score: number;
  tournament_count: number;
  average_score: number;
}

export interface GameSet {
  id: string;
  tournament_id: string;
  startgg_set_id: string | null;
  winner_player_id: string | null;
  loser_player_id: string | null;
  winner_score: number | null;
  loser_score: number | null;
  round: string | null;
  created_at: string;
}

// start.gg API response types

export interface StartggTournamentData {
  name: string;
  startAt: number | null;
  events: StartggEvent[];
}

export interface StartggEvent {
  id: number;
  name: string;
  numEntrants: number;
  teamRosterSize: { maxPlayers: number | null } | null; // null or maxPlayers 1 = singles, 2+ = doubles/teams
}

export interface StartggStanding {
  placement: number;
  entrant: {
    id: number;
    name: string;
    participants: {
      id: number;
      gamerTag: string;
      prefix: string | null;
      player: {
        id: number;
        gamerTag: string;
      } | null;
    }[];
  };
}

export interface StartggSetSlot {
  id: number;
  entrant: {
    id: number;
    name: string;
    participants: {
      player: {
        id: number;
        gamerTag: string;
      } | null;
    }[];
  } | null;
  standing: {
    placement: number;
    stats: {
      score: {
        value: number | null;
      };
    };
  } | null;
}

export interface StartggSet {
  id: string;
  displayScore: string | null;
  fullRoundText: string | null;
  winnerId: number | null;
  slots: StartggSetSlot[];
}

// Import preview types

export interface ImportPreview {
  tournamentName: string;
  tournamentDate: string;
  startggSlug: string;
  eventName: string;
  eventId: number;
  totalParticipants: number;
  standings: ImportStanding[];
}

export interface ImportStanding {
  /** Stable unique key for this standing — startggPlayerId or fallback index */
  key: string;
  placement: number;
  startggPlayerId: number | null;
  gamerTag: string;
  existingPlayerId: string | null;
  isElonStudent: boolean;
}

// Leaderboard types

export interface LeaderboardEntry {
  rank: number;
  player_id: string;
  gamer_tag: string;
  average_score: number;
  total_score: number;
  tournament_count: number;
}
