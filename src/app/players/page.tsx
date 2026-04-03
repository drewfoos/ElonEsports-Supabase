import { createStaticClient } from '@/lib/supabase/static'
import { unstable_cache } from 'next/cache'
import { PlayersListClient } from './players-list-client'

export interface PlayerListItem {
  id: string
  gamer_tag: string
  tournament_count: number
  best_placement: number | null
  total_sets: number
  set_wins: number
}

const getPlayersData = unstable_cache(
  async () => {
    const supabase = createStaticClient()

    // 1. Fetch Elon player IDs first
    const statusRes = await supabase
      .from('player_semester_status')
      .select('player_id, players(id, gamer_tag)')
      .eq('is_elon_student', true)

    const statuses = statusRes.data ?? []

    // Deduplicate players (may appear in multiple semesters)
    const playerMap: Record<string, { id: string; gamer_tag: string }> = {}
    for (const s of statuses) {
      const player = s.players as unknown as { id: string; gamer_tag: string }
      playerMap[s.player_id] = player
    }

    const elonIds = Object.keys(playerMap)
    if (elonIds.length === 0) {
      return { players: [] as PlayerListItem[], fetchedAt: Date.now() }
    }

    // 2. Fetch only Elon players' results and sets in parallel
    // Sets query fetches both columns in one call (halves response payload)
    const [resultsRes, setsRes] = await Promise.all([
      supabase
        .from('tournament_results')
        .select('player_id, placement')
        .in('player_id', elonIds)
        .limit(10000),
      supabase
        .from('sets')
        .select('winner_player_id, loser_player_id')
        .or(`winner_player_id.in.(${elonIds.join(',')}),loser_player_id.in.(${elonIds.join(',')})`)
        .limit(10000),
    ])

    const results = resultsRes.data ?? []
    const sets = setsRes.data ?? []

    // Best placement + tournament count per player (single pass)
    const bestPlacement: Record<string, number> = {}
    const resultCount: Record<string, number> = {}
    for (const r of results) {
      if (!bestPlacement[r.player_id] || r.placement < bestPlacement[r.player_id]) {
        bestPlacement[r.player_id] = r.placement
      }
      resultCount[r.player_id] = (resultCount[r.player_id] ?? 0) + 1
    }

    // Set records (single pass over one array instead of two)
    const setWins: Record<string, number> = {}
    const setLosses: Record<string, number> = {}
    const elonIdSet = new Set(elonIds)
    for (const s of sets) {
      const w = s.winner_player_id as string
      const l = s.loser_player_id as string
      if (w && elonIdSet.has(w)) setWins[w] = (setWins[w] ?? 0) + 1
      if (l && elonIdSet.has(l)) setLosses[l] = (setLosses[l] ?? 0) + 1
    }

    // Assemble player list
    const players: PlayerListItem[] = Object.entries(playerMap).map(([pid, player]) => {
      const w = setWins[pid] ?? 0
      const l = setLosses[pid] ?? 0
      return {
        id: player.id,
        gamer_tag: player.gamer_tag,
        tournament_count: resultCount[pid] ?? 0,
        best_placement: bestPlacement[pid] ?? null,
        total_sets: w + l,
        set_wins: w,
      }
    })

    // Sort alphabetically by gamer tag
    players.sort((a, b) => a.gamer_tag.localeCompare(b.gamer_tag, undefined, { sensitivity: 'base' }))

    return { players, fetchedAt: Date.now() }
  },
  ['players-list'],
  { revalidate: 60 }
)

export default async function PlayersPage() {
  const { players, fetchedAt } = await getPlayersData()
  return <PlayersListClient players={players} fetchedAt={fetchedAt} />
}
