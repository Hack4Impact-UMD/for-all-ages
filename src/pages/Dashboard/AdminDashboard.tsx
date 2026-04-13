import { useMemo, useState, useEffect, useRef } from 'react'
import layoutStyles from './Dashboard.module.css'
import adminStyles from './AdminDashboard.module.css'
import WeekSelector from './components/WeekSelector/WeekSelector'
import PersonTag from './components/PersonTag/PersonTag'
import { getAllMatches } from '../../services/matches'
import { getWeek } from '../../services/weeks'
import { getDoc, doc } from 'firebase/firestore'
import { db } from '../../firebase'
import type { Match, Week, PersonTagVariant } from '../../types'
import { subscribeToProgramState, type ProgramState } from '../../services/programState'
import CallLogModal from './components/PopUpWindow/CallLogModal'
import SearchIcon from '@mui/icons-material/Search'
import FilterListIcon from '@mui/icons-material/FilterList'

type CallStatusFilter =  'Submitted' | 'Not Submitted'

interface MatchRow {
  match: Match & { id: string }
  label: CallStatusFilter | null
  variant: PersonTagVariant | null
  name1: string
  name2: string
}

const WEEKS = 20

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export default function AdminDashboard() {
  const [selectedWeek, setSelectedWeek] = useState(0)
  const [allMatches, setAllMatches] = useState<(Match & { id: string })[]>([])
  const [weekData, setWeekData] = useState<Week | null>(null)
  const [allWeeksData, setAllWeeksData] = useState<Record<number, string[]>>({})
  const [participantNames, setParticipantNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [matchesLoading, setMatchesLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [programState, setProgramState] = useState<ProgramState | null>(null)
  const [activeMatch, setActiveMatch] = useState<(Match & { id: string }) | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [callStatusFilters, setCallStatusFilters] = useState<CallStatusFilter[]>([])
  const [callFilterOpen, setCallFilterOpen] = useState(false)

  const hasInitializedWeek = useRef(false)
  const callFilterRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const unsubscribe = subscribeToProgramState(
      (state) => setProgramState(state),
      (err) => console.error('ProgramState subscription error', err)
    )
    return unsubscribe
  }, [])

  // Sync selected week once on initial load
  useEffect(() => {
    if (programState && typeof programState.week === 'number' && !hasInitializedWeek.current) {
      setSelectedWeek(Math.max(0, programState.week - 1))
      hasInitializedWeek.current = true
    }
  }, [programState])

  // Fetch all matches + participant names once on mount
  useEffect(() => {
    async function loadMatches() {
      try {
        setMatchesLoading(true)
        const matchesData = await getAllMatches()
        setAllMatches(matchesData)

        const uniqueIds = new Set<string>()
        matchesData.forEach(m => { uniqueIds.add(m.participant1_id); uniqueIds.add(m.participant2_id) })

        const names: Record<string, string> = {}
        await Promise.all(Array.from(uniqueIds).map(async (id) => {
          const snap = await getDoc(doc(db, 'participants', id))
          names[id] = snap.exists() ? (snap.data().displayName || snap.data().name || 'Unknown') : 'Unknown'
        }))
        setParticipantNames(names)
      } catch {
        setError('Failed to load matches.')
      } finally {
        setMatchesLoading(false)
      }
    }
    loadMatches()
  }, [])

  // Fetch all weeks once for progress bars
  useEffect(() => {
    async function loadAllWeeks() {
      const results = await Promise.allSettled(
        Array.from({ length: WEEKS }, (_, i) => getWeek(i + 1))
      )
      const data: Record<number, string[]> = {}
      results.forEach((r, i) => {
        data[i + 1] = r.status === 'fulfilled' && r.value ? r.value.calls : []
      })
      setAllWeeksData(data)
    }
    loadAllWeeks()
  }, [])

  // Fetch selected week data; sync into allWeeksData for accurate progress display
  useEffect(() => {
    async function loadWeekData() {
      try {
        setLoading(true)
        const week = await getWeek(selectedWeek + 1)
        setWeekData(week)
        setAllWeeksData(prev => ({ ...prev, [selectedWeek + 1]: week?.calls ?? [] }))
      } catch {
        setWeekData(null)
      } finally {
        setLoading(false)
      }
    }
    loadWeekData()
  }, [selectedWeek])

  // Close filter dropdown on outside click
  useEffect(() => {
    if (!callFilterOpen) return
    const handler = (e: MouseEvent | TouchEvent) => {
      if (!callFilterRef.current?.contains(e.target as Node)) setCallFilterOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [callFilterOpen])


  // Search option based on the names of participants
  const filteredMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return allMatches
    return allMatches.filter(m => {
      const n1 = (participantNames[m.participant1_id] || '').toLowerCase()
      const n2 = (participantNames[m.participant2_id] || '').toLowerCase()
      return n1.includes(q) || n2.includes(q)
    })
  }, [allMatches, searchQuery, participantNames])

  const currentGlobalWeek = programState?.week ?? 1
  const viewingWeek = selectedWeek + 1
  const isCurrentWeek = viewingWeek === currentGlobalWeek
  const isPastWeek = viewingWeek < currentGlobalWeek
  const isFutureWeek = viewingWeek > currentGlobalWeek

  // Compute per-row status
  const matchRows = useMemo((): MatchRow[] => {
    return filteredMatches.map(match => {
      const hasLog = weekData?.calls.includes(match.id) ?? false
      let label: CallStatusFilter | null
      let variant: PersonTagVariant | null

      if (isFutureWeek) {
        // Upcoming week — no status yet
        label = null
        variant = null
      } else if (hasLog) {
        // Current week submitted -> green "Complete"
        label = 'Submitted'
        variant = 'green'
      } else if (isPastWeek) {
        // Past week, no log -> red "Not Submitted"
        label = 'Not Submitted'
        variant = 'rose'
      } else {
        // Current week, no log -> yellow "Not Submitted"
        label = 'Not Submitted'
        variant = 'gold'
      }

      return {
        match,
        label,
        variant,
        name1: participantNames[match.participant1_id] || 'Loading...',
        name2: participantNames[match.participant2_id] || 'Loading...',
      }
    })
  }, [filteredMatches, weekData, participantNames, isPastWeek, isFutureWeek])


  const stats = useMemo(() => ({
    total: filteredMatches.length,
    complete: matchRows.filter(r => r.variant === 'green').length,
    notSubmitted: matchRows.filter(r => r.variant !== 'green').length,
  }), [matchRows, filteredMatches.length])

  const visibleRows = useMemo(() => {
    if (callStatusFilters.length === 0) return matchRows
    return matchRows.filter(r => r.label !== null && callStatusFilters.includes(r.label))
  }, [matchRows, callStatusFilters])

  // Top right badge showing the status of that week
  const weekStatusBadge = isPastWeek ? { label: 'Completed', cls: adminStyles.badgeCompleted } :
    ( isCurrentWeek ? { label: 'Ongoing', cls: adminStyles.badgeOngoing }
    : { label: 'Upcoming', cls: adminStyles.badgeUpcoming })

  return (
    <div className={layoutStyles.page}>
      <div className={layoutStyles.surface}>
        <section className={layoutStyles.selectorSection}>
          <WeekSelector
            weeks={Array.from({ length: WEEKS }, (_, i) => `Week ${i + 1}`)}
            selectedWeekIndex={selectedWeek}
            onSelect={setSelectedWeek}
            statuses={Array.from({ length: WEEKS }, (_, i) => {
              const wk = i + 1
              if (wk < currentGlobalWeek) return 'completed'
              if (wk === currentGlobalWeek) return 'current'
              return 'future'
            })}
          />
        </section>

        <section className={`${layoutStyles.contentSection} ${adminStyles.scheduleSection}`}>
          <div className={adminStyles.scheduleHeader}>
            <div className={adminStyles.searchContainer}>
              <SearchIcon className={adminStyles.searchIcon} aria-hidden="true" />
              <input
                type="text"
                aria-label="Search participants"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={adminStyles.searchInput}
              />
            </div>
            <h2 className={layoutStyles.sectionHeading}>Dashboard</h2>
            <div />
          </div>

          {error && <div className={adminStyles.errorBox}>{error}</div>}
          {!error && searchQuery.trim() && !matchesLoading && filteredMatches.length === 0 && (
            <div className={adminStyles.noResults}>No matches found for "{searchQuery.trim()}"</div>
          )}

          {matchesLoading || loading ? (
            <div className={adminStyles.loading}>Loading Week {selectedWeek + 1}...</div>
          ) : (
            <div className={adminStyles.scheduleCard}>

              {/* Week header */}
              <div className={adminStyles.weekHeader}>
                <h3 className={adminStyles.weekTitle}>Week {viewingWeek}</h3>
                <span className={`${adminStyles.weekBadge} ${weekStatusBadge.cls}`}>{weekStatusBadge.label}</span>
              </div>


              

              {/* Filter */}
              <div className={adminStyles.filterBar} ref={callFilterRef}>
                <button
                  type="button"
                  className={adminStyles.filterButton}
                  onClick={() => setCallFilterOpen(o => !o)}
                >
                  <FilterListIcon className={adminStyles.filterIcon} />
                  <span>Filter calls</span>
                </button>
                {callFilterOpen && (
                  <div className={adminStyles.filterPopover}>
                    {(['Submitted', 'Not Submitted'] as CallStatusFilter[]).map(status => (
                      <label key={status} className={adminStyles.filterOption}>
                        <input
                          type="checkbox"
                          checked={callStatusFilters.includes(status)}
                          onChange={() =>
                            setCallStatusFilters(prev =>
                              prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
                            )
                          }
                        />
                        <span>{status}</span>
                      </label>
                    ))}
                    <button
                      type="button"
                      className={adminStyles.clearFilterButton}
                      onClick={() => setCallStatusFilters([])}
                    >
                      Clear filters
                    </button>
                  </div>
                )}
              </div>

              {/* Stats — current and past weeks */}
              {(isCurrentWeek || isPastWeek) && (
                <div className={adminStyles.statsRow}>
                  <div className={adminStyles.statBox}>
                    <span className={adminStyles.statHeader}>Calls Scheduled</span>
                    <span className={adminStyles.statValue}>{stats.total} <span className={adminStyles.statUnit}>this week</span></span>
                  </div>
                  <div className={adminStyles.statBox}>
                    <span className={adminStyles.statHeader}>Log Complete</span>
                    <span className={`${adminStyles.statValue} ${adminStyles.statValueGreen}`}>{stats.complete} <span className={adminStyles.statUnit}>pairs</span></span>
                  </div>
                  <div className={adminStyles.statBox}>
                    <span className={adminStyles.statHeader}>{isPastWeek ? 'Missed' : 'Log Not Submitted'}</span>
                    <span className={`${adminStyles.statValue} ${isPastWeek ? adminStyles.statValueRed : adminStyles.statValueGold}`}>{stats.notSubmitted} <span className={adminStyles.statUnit}>pairs</span></span>
                  </div>
                </div>
              )}

              
              {/* Match table */}
              <div className={adminStyles.matchTable}>
                <div className={adminStyles.tableHeader}>
                  <span>Student Name</span>
                  <span>Older Adult Name</span>
                  <span>Call Status</span>
                  <span>Progress</span>
                </div>
                {visibleRows.length === 0 ? (
                  <div className={adminStyles.emptyTable}>No matches found</div>
                ) : (
                  visibleRows.map(({ match, label, variant, name1, name2 }) => (
                    <div
                      key={match.id}
                      className={adminStyles.tableRow}
                      onClick={() => { if (variant === 'green') setActiveMatch(match) }}
                      style={{ cursor: variant === 'green' ? 'pointer' : 'default' }}
                    >
                      <span className={adminStyles.participantCell}>
                        <span className={adminStyles.avatar}>{getInitials(name1)}</span>
                        <span>{name1}</span>
                      </span>
                      <span className={adminStyles.participantCell}>
                        <span className={adminStyles.avatar}>{getInitials(name2)}</span>
                        <span>{name2}</span>
                      </span>
                      <div className={adminStyles.statusCell}>
                        {label && variant
                          ? <PersonTag names={label} variant={variant} />
                          : <span className={adminStyles.noStatus}>—</span>
                        }
                      </div>
                      <div className={adminStyles.progressBlocks}>
                        {Array.from({ length: WEEKS }, (_, i) => {
                          const wk = i + 1
                          if (wk > currentGlobalWeek) {
                            return <span key={wk} className={`${adminStyles.block} ${adminStyles.blockFuture}`} />
                          }
                          const submitted = (allWeeksData[wk] ?? []).includes(match.id)
                          const isCurrent = wk === currentGlobalWeek
                          return (
                            <span
                              key={wk}
                              className={`${adminStyles.block} ${submitted ? adminStyles.blockGreen : adminStyles.blockRed} ${isCurrent ? adminStyles.blockCurrent : ''}`}
                            />
                          )
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>

            </div>
          )}
        </section>
      </div>

      {activeMatch && (
        <CallLogModal
          match={activeMatch}
          participantNames={participantNames}
          weekNumber={selectedWeek + 1}
          onClose={() => setActiveMatch(null)}
        />
      )}
    </div>
  )
}
