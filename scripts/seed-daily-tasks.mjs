const API = 'http://localhost:3001/api/tasks/daily'

const tasks = [
  // === 2026-03-06 ===
  {
    date: '2026-03-06T09:00:00.000Z',
    authorEmail: 'youngeun@wepick.kr',
    authorDisplayName: '전영은',
    source: 'MANUAL',
    content: `[x] AX 스프린트
[x] 일일 리드수 확인
[x] 전자책 현금영수증 발행 1건 → but 취소
[x] 병합 이후 확인
[x] 팀 스프린트 회의
[x] 대표님 월간보고 11:30
[x] 대표님 미팅 4:30~
[x] 상품 CS 관련 논의 w/ 정하, 희연
[x] 전자책 환불응대매뉴얼 작성중`,
  },
  {
    date: '2026-03-06T09:00:00.000Z',
    authorEmail: 'jungha@wepick.kr',
    authorDisplayName: '이정하',
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
    date: '2026-03-06T09:00:00.000Z',
    authorEmail: 'youlim@wepick.kr',
    authorDisplayName: '이유림',
    source: 'MANUAL',
    content: `*AX 스프린트 공유 회의 (11:30~12:45)
*바이브코딩 ERP 인사이트 공유 미팅 (16:30~18:40)

[AX 스프린트]
• AX 최종 반영 내역 확인 → 작업 인사이트 공유
• 상품 CS 관련 논의 w/ 유림, 희연
• 위픽오토 사이트 내 문의 버튼 숨김 처리 → 경로 및 버튼 위치 파일링`,
  },
  {
    date: '2026-03-06T09:00:00.000Z',
    authorEmail: 'sanghyeon@wepick.kr',
    authorDisplayName: '권상현',
    source: 'MANUAL',
    content: `[x] AX 스프린트 통합본 수정 (완료)
[x] 리뷰 (완료)
[x] 신규 ERP 리뷰 (완료, w/대표님)`,
  },
  {
    date: '2026-03-06T09:00:00.000Z',
    authorEmail: 'heeyeon@wepick.kr',
    authorDisplayName: '조희연',
    source: 'MANUAL',
    content: `[x] 관리지표 확인
[x] 아임웹 누락 리드 CRM 기재
[x] JG 2월 네이버SA 리포팅 아카이빙
[x] AX 스프린트 관련 문서 정리`,
  },
  {
    date: '2026-03-06T09:00:00.000Z',
    authorEmail: 'jeongju@wepick.kr',
    authorDisplayName: '이정주',
    source: 'MANUAL',
    content: `[x] 위픽부스터 블로그 파악
[x] 장기렌트DB 광고 관련 블로그 포스팅
[x] 카카오 비지니스 채널 응대 (CS, 상품제안서 발송)

[회고: 적응한다고 정신이 없는 1주차가 끝이났습니다.]
- 영업과 상담의 본질은 산업군에 상관없이 일맥상통한다는 것을 다시금 깨달았다.
- 빠른 시일 내에 업무 툴과 용어를 습득하여 현재 느끼는 '낯섦'을 '능숙함'으로 전환해야겠다.
- 나만의 강점을 극대화한 '나다운 영업 프로세스' 설계가 필요하다.`,
  },

  // === 2026-03-09 ===
  {
    date: '2026-03-09T09:00:00.000Z',
    authorEmail: 'youngeun@wepick.kr',
    authorDisplayName: '전영은',
    source: 'MANUAL',
    content: `[x] 상시업무
[x] 일일 리드수 확인
[x] 관리지표 확인 / 주간 리포팅 작성
[x] 전자책 환불응대매뉴얼 작성 및 공유
[x] 플랫폼팀 주간 회의 11:00
[x] 아임웹 AX 프로젝트 논의 (16:00~17:00)
[x] 타운홀 미팅 (17:00~18:00)`,
  },
  {
    date: '2026-03-09T09:00:00.000Z',
    authorEmail: 'heeyeon@wepick.kr',
    authorDisplayName: '조희연',
    source: 'MANUAL',
    content: `*플랫폼 주간 회의 (11:00~12:00)
*아임웹 AX 프로젝트 논의 (16:00~17:00)
*타운홀 미팅 (17:00~18:00)

- 관리지표 입력 및 회의록 작성
- 2M 마케팅 지표 작성 중
- 아임웹 누락 리드 CRM 기재 1건
- JG 2월 네이버SA 리포팅 아카이빙
- 아임웹 AX 프로젝트 진행 관련 문서 정리 w/ 유림, 정하

✔뭐든 그걸 하려는 목적과 이유, 함으로써 얻고자 하는 것을 미리 정하고 서로 합의된 상태에서 같이 걸어가는 게 중요한 것 같다.`,
  },
  {
    date: '2026-03-09T09:00:00.000Z',
    authorEmail: 'jungha@wepick.kr',
    authorDisplayName: '이정하',
    source: 'MANUAL',
    content: `[x] 부스터솔루션 AX화 방법 정리
[x] 기존/신규 분리
[x] 11:00 플랫폼 주간회의
[x] AX도입범위 정리: 상담관리MVP
[x] 14:30 솔루션 기획미팅 → 부스터솔루션화 방향성 논의
[x] 17:00 부스터타운홀미팅
[ ] 상담관리MVP → 이전작업내역 정리

사용자와 개발자가 기능의 의도와 실제 사용 방식을 공유하는게 꼭 필요하다고 느꼈다. 서비스를 함께 만들어가는게 큰 의미가 있는듯. 내부 솔루션인만큼 사용자와의 거리가 가까운게 큰 장점으로 느껴진다.`,
  },
  {
    date: '2026-03-09T09:00:00.000Z',
    authorEmail: 'youlim@wepick.kr',
    authorDisplayName: '이유림',
    source: 'MANUAL',
    content: `*플랫폼 주간 회의 (11:00~12:00)
*아임웹 AX 프로젝트 논의 (16:00~17:00)
*타운홀 미팅 (17:00~18:00)

[프론트 AX]
• 이전 AX 스프린트 전체 과정 및 정리
• 아임웹 AX 프로젝트 진행 관련 문서 정리 w.희연/유림

✔ 일의 범위나 가능여부를 명확하게 알고 시작하면 좋겠지만 지금은 해봐야지만 아는 것들이 대부분이다. 빠르게 알아내는것이 중요.`,
  },
  {
    date: '2026-03-09T09:00:00.000Z',
    authorEmail: 'sanghyeon@wepick.kr',
    authorDisplayName: '권상현',
    source: 'MANUAL',
    content: `[x] 부스터솔루션 AX화 방법 정리
[x] 플랫폼 주간 회의 (11:00)
[x] AX 도입 범위 정리
[x] 솔루션 기획 미팅 (14:30)
[x] 타운홀 미팅 (17:00)`,
  },
  {
    date: '2026-03-09T09:00:00.000Z',
    authorEmail: 'jeongju@wepick.kr',
    authorDisplayName: '이정주',
    source: 'MANUAL',
    content: `- 카카오 비지니스 채널응대 (신규2)
- CPA 제안 문자발송 (개인회생, 장기렌트)
- 코어타겟 광고 파악 및 문자 발송 (병의원)
- odoo 영업기획 생성 방법 파악 및 생성 (신규2)

[회고]
- 외우지 말고 이해를 하고 시작하며 업무에 임할 것`,
  },
]

async function seed() {
  let success = 0
  let fail = 0
  for (const task of tasks) {
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task),
      })
      const data = await res.json()
      if (data.ok) {
        console.log(`✓ ${task.date.slice(0,10)} ${task.authorDisplayName}`)
        success++
      } else {
        console.log(`✗ ${task.date.slice(0,10)} ${task.authorDisplayName}: ${data.error}`)
        fail++
      }
    } catch (e) {
      console.log(`✗ ${task.date.slice(0,10)} ${task.authorDisplayName}: ${e.message}`)
      fail++
    }
  }
  console.log(`\nDone: ${success} success, ${fail} failed`)
}

seed()
