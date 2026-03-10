const TEAM_MEMBERS = [
  { name: '전영은', email: 'youngeun@wepick.kr' },
  { name: '권상현', email: 'sanghyeon@wepick.kr' },
  { name: '이유림', email: 'youlim@wepick.kr' },
  { name: '이정하', email: 'jungha@wepick.kr' },
  { name: '이정주', email: 'jeongju@wepick.kr' },
  { name: '조희연', email: 'heeyeon@wepick.kr' },
]

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
