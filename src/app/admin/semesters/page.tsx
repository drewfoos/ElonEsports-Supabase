import { getSemesters } from '@/lib/actions/semesters'
import SemestersClient from './semesters-client'
import type { Semester } from '@/lib/types'

export default async function SemestersPage() {
  const result = await getSemesters()
  const semesters: Semester[] = 'error' in result ? [] : result

  return <SemestersClient initialSemesters={semesters} />
}
