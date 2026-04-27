const TEAM_MEMBERS = [
  { name: '전영은', email: 'youngeun@wepick.kr' },
  { name: '권상현', email: 'sanghyeon@wepick.kr' },
  { name: '이유림', email: 'youlim@wepick.kr' },
  { name: '이정하', email: 'jungha@wepick.kr' },
  { name: '이정주', email: 'jeongju@wepick.kr' },
  { name: '조희연', email: 'heeyeon@wepick.kr' },
  { name: '서청원', email: 'cheongwon@wepick.kr' },
]

// 특정 날짜(YYYY-MM-DD)부터 테이블 노출을 중단할 멤버 정의
// 기존 데이터는 DB에 그대로 보존됨
const HIDE_FROM: Record<string, string> = {
  'heeyeon@wepick.kr': '2026-04-28', // 4월 5주차부터 노출 제외
}

/** referenceDate(YYYY-MM-DD) 시점 기준 노출 가능한 멤버만 반환 */
export function filterVisibleMembers<T extends { email: string }>(
  members: T[],
  referenceDate: string,
): T[] {
  return members.filter((m) => {
    const hideFrom = HIDE_FROM[m.email]
    return !hideFrom || referenceDate < hideFrom
  })
}

export async function getTeamMemberName(email: string): Promise<string | null> {
  const member = TEAM_MEMBERS.find((m) => m.email === email)
  return member?.name ?? null
}

export async function getTeamMemberByName(displayName: string): Promise<{ name: string; email: string } | null> {
  const member = TEAM_MEMBERS.find((m) => displayName.includes(m.name))
  return member ?? null
}

export async function getAllTeamMembers(): Promise<{ name: string; email: string }[]> {
  return TEAM_MEMBERS
}
