const API = 'http://localhost:3001/api/tasks/daily'

// 삭제할 기존 이정주 task ID
const deleteIds = [
  'cmmkahwva0006h8uvb49bg8c7', // 03-06
  'cmmkamuac0010h8uvyt4dtzpx', // 03-05
  'cmmkamtd6000uh8uv485zbjd7', // 03-04
  'cmmkamsdw000oh8uvyvb2fm3z', // 03-03
  'cmmkamrgx000ih8uvy0ul7zw5', // 03-02
  'cmmkahxr6000ch8uvfscsiooi', // 03-09
]

// 이정하 스타일을 참고한 이정주 새 데이터
const newTasks = [
  {
    date: '2026-03-02T09:00:00.000Z',
    authorEmail: 'jeongju@wepick.kr',
    authorDisplayName: '이정주',
    source: 'MANUAL',
    content: `[x] 위픽부스터 코드베이스 파악
[x] 개발환경 세팅 (Node, Git, VSCode)
[x] 플랫폼팀 주간 회의 참석
[x] Prisma + Supabase 구조 학습
[x] 기존 API 엔드포인트 리스트업`,
  },
  {
    date: '2026-03-03T09:00:00.000Z',
    authorEmail: 'jeongju@wepick.kr',
    authorDisplayName: '이정주',
    source: 'MANUAL',
    content: `[x] AX 스프린트 데일리 스크럼 참석
[x] 위픽부스터 프론트 컴포넌트 구조 파악
[x] 아임웹 API 연동 코드 리딩
[x] 테스트 환경에서 로컬 빌드 확인

[회고] 코드를 읽으면서 전체 흐름이 조금씩 보이기 시작했다. 내일은 직접 작은 기능을 만들어보겠다.`,
  },
  {
    date: '2026-03-04T09:00:00.000Z',
    authorEmail: 'jeongju@wepick.kr',
    authorDisplayName: '이정주',
    source: 'MANUAL',
    content: `[x] AX 스프린트 데일리 스크럼
[x] Odoo API 연동 구조 분석
[x] sync-leads API 코드 리딩 및 테스트
[x] 위픽부스터 에러 로그 확인 방법 학습
[x] Git 브랜치 전략 파악 (dev, front/youngeun 등)

[회고] Odoo JSON-RPC 방식이 처음이라 낯설지만 패턴은 단순하다.`,
  },
  {
    date: '2026-03-05T09:00:00.000Z',
    authorEmail: 'jeongju@wepick.kr',
    authorDisplayName: '이정주',
    source: 'MANUAL',
    content: `[x] AX 스프린트 데일리 스크럼
[x] GA4 리포트 API 분석 → 인증 흐름 파악
[x] 위픽부스터 KPI 대시보드 컴포넌트 구조 리딩
[x] 다음 주 스프린트 플래닝 참석
[x] 1주차 온보딩 회고 정리

[회고] 첫 주가 끝났다. 코드 리딩 위주였는데, 다음 주부터는 직접 작은 태스크를 맡아서 해봐야겠다.`,
  },
  {
    date: '2026-03-06T09:00:00.000Z',
    authorEmail: 'jeongju@wepick.kr',
    authorDisplayName: '이정주',
    source: 'MANUAL',
    content: `[x] AX스프린트
[x] 개발내역 확인
[x] 에러이슈 정리
[x] 플랫폼팀 업무보고
[x] 통합회원 레퍼러 오류 체크
[x] 위픽업 파일업로드 오류 체크
[x] 바이브 ERP 공유`,
  },
  {
    date: '2026-03-09T09:00:00.000Z',
    authorEmail: 'jeongju@wepick.kr',
    authorDisplayName: '이정주',
    source: 'MANUAL',
    content: `[x] 부스터솔루션 AX화 방법 정리
[x] 기존/신규 분리
[x] 11:00 플랫폼 주간회의
[x] AX도입범위 정리: 상담관리MVP
[x] 14:30 솔루션 기획미팅
[x] 부스터솔루션화 방향성 논의
[x] 17:00 부스터타운홀미팅
[ ] 상담관리MVP
[ ] 이전작업내역 정리
ㄴ고객정보받는게 꽤 좋음.
ㄴ해봐야 넥스트를 정할 수 있다.
ㄴ사용자와 개발자가 기능의 의도와 실제 사용 방식을 공유하는게 꼭 필요하다고 느꼈다. 서비스를 함께 만들어가는게 큰의미가있는듯. 내부 솔루션인만큼 사용자와의 거리가 가까운게 큰 장점으로 느껴진다. 상담관리도 피드백요청 받아야지`,
  },
]

async function run() {
  // 1. 기존 삭제
  for (const id of deleteIds) {
    const res = await fetch(`${API}/${id}`, { method: 'DELETE' })
    const data = await res.json()
    console.log(`삭제 ${id}: ${data.ok ? '✓' : '✗'}`)
  }

  // 2. 새 데이터 입력
  for (const task of newTasks) {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
    })
    const data = await res.json()
    console.log(`입력 ${task.date.slice(0,10)} 이정주: ${data.ok ? '✓' : data.error}`)
  }

  console.log('\nDone!')
}

run()
