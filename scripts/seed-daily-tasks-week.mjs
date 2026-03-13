const API = 'http://localhost:3001/api/tasks/daily'

const tasks = [
  // === 2026-03-02 (월) ===
  {
    date: '2026-03-02T09:00:00.000Z',
    authorEmail: 'youngeun@wepick.kr',
    authorDisplayName: '전영은',
    source: 'MANUAL',
    content: `[x] 주간 리드 현황 정리
[x] 일일 리드수 확인
[x] 전자책 판매 현황 리포팅
[x] 플랫폼팀 주간 회의 11:00
[x] AX 스프린트 킥오프 준비
[x] 관리지표 입력`,
  },
  {
    date: '2026-03-02T09:00:00.000Z',
    authorEmail: 'jungha@wepick.kr',
    authorDisplayName: '이정하',
    source: 'MANUAL',
    content: `[x] 위픽부스터 배포 확인
[x] 회원가입 플로우 버그 수정
[x] 플랫폼팀 주간 회의
[x] AX 스프린트 백로그 정리
[x] Odoo API 연동 이슈 체크`,
  },
  {
    date: '2026-03-02T09:00:00.000Z',
    authorEmail: 'youlim@wepick.kr',
    authorDisplayName: '이유림',
    source: 'MANUAL',
    content: `*플랫폼팀 주간 회의 (11:00~12:00)

[AX 스프린트]
• 프론트엔드 마이그레이션 현황 공유
• 아임웹 → Next.js 전환 진행률 정리
• 랜딩페이지 컴포넌트 리팩토링 시작`,
  },
  {
    date: '2026-03-02T09:00:00.000Z',
    authorEmail: 'sanghyeon@wepick.kr',
    authorDisplayName: '권상현',
    source: 'MANUAL',
    content: `[x] ERP 시스템 요구사항 정리
[x] 플랫폼 주간 회의
[x] 부스터 솔루션 DB 설계 초안
[x] API 엔드포인트 설계 검토`,
  },
  {
    date: '2026-03-02T09:00:00.000Z',
    authorEmail: 'heeyeon@wepick.kr',
    authorDisplayName: '조희연',
    source: 'MANUAL',
    content: `- 관리지표 입력 및 주간 회의록 작성
- 2월 마케팅 성과 리포트 마감
- 아임웹 회원 데이터 정리
- 네이버SA JG 캠페인 성과 분석`,
  },
  {
    date: '2026-03-02T09:00:00.000Z',
    authorEmail: 'jeongju@wepick.kr',
    authorDisplayName: '이정주',
    source: 'MANUAL',
    content: `- 신규 입사 온보딩 (2주차)
- 위픽부스터 서비스 파악
- CPA 상품 구조 학습
- Odoo CRM 사용법 익히기
- 카카오 비지니스 채널 응대 시작`,
  },

  // === 2026-03-03 (화) ===
  {
    date: '2026-03-03T09:00:00.000Z',
    authorEmail: 'youngeun@wepick.kr',
    authorDisplayName: '전영은',
    source: 'MANUAL',
    content: `[x] 일일 리드수 확인
[x] 전자책 CS 응대 2건
[x] AX 스프린트 데일리 스크럼
[x] 아임웹 리드 누락 건 확인 → CRM 수동 입력
[x] 대표님 주간 보고 자료 준비`,
  },
  {
    date: '2026-03-03T09:00:00.000Z',
    authorEmail: 'jungha@wepick.kr',
    authorDisplayName: '이정하',
    source: 'MANUAL',
    content: `[x] AX 스프린트 데일리 스크럼
[x] 통합회원 시스템 로그인 이슈 분석
[x] 위픽업 파일 업로드 기능 개선
[x] 에러 로그 모니터링 대시보드 세팅`,
  },
  {
    date: '2026-03-03T09:00:00.000Z',
    authorEmail: 'youlim@wepick.kr',
    authorDisplayName: '이유림',
    source: 'MANUAL',
    content: `[AX 스프린트]
• 시뮬레이터 페이지 Next.js 마이그레이션
• 반응형 레이아웃 수정
• AX 데일리 스크럼 참석

• 위픽오토 랜딩페이지 디자인 시안 검토 w/ 희연`,
  },
  {
    date: '2026-03-03T09:00:00.000Z',
    authorEmail: 'sanghyeon@wepick.kr',
    authorDisplayName: '권상현',
    source: 'MANUAL',
    content: `[x] AX 스프린트 데일리 스크럼
[x] ERP 프로토타입 개발 시작
[x] 매출 데이터 연동 API 구현
[x] Prisma 스키마 설계 리뷰`,
  },
  {
    date: '2026-03-03T09:00:00.000Z',
    authorEmail: 'heeyeon@wepick.kr',
    authorDisplayName: '조희연',
    source: 'MANUAL',
    content: `- GA4 주간 트래픽 리포팅
- 네이버SA 키워드 성과 분석
- AX 스프린트 문서 업데이트
- 리드마그넷 전환율 분석 자료 작성`,
  },
  {
    date: '2026-03-03T09:00:00.000Z',
    authorEmail: 'jeongju@wepick.kr',
    authorDisplayName: '이정주',
    source: 'MANUAL',
    content: `- 장기렌트 CPA 상품 구조 파악
- 개인회생 광고주 리스트 정리
- 카카오 비지니스 채널 CS 응대 3건
- Odoo 리드 등록 연습

[회고] 용어가 많아서 정리가 필요하다. 노션에 용어집 만들어야겠다.`,
  },

  // === 2026-03-04 (수) ===
  {
    date: '2026-03-04T09:00:00.000Z',
    authorEmail: 'youngeun@wepick.kr',
    authorDisplayName: '전영은',
    source: 'MANUAL',
    content: `[x] 일일 리드수 확인
[x] AX 스프린트 데일리 스크럼
[x] 전자책 신규 주문 처리 3건
[x] 아임웹 상품 페이지 오류 제보 → 정하 전달
[x] 대표님 주간 보고 (14:00)
[x] 리드마그넷 퍼널 데이터 검증`,
  },
  {
    date: '2026-03-04T09:00:00.000Z',
    authorEmail: 'jungha@wepick.kr',
    authorDisplayName: '이정하',
    source: 'MANUAL',
    content: `[x] AX 스프린트 데일리 스크럼
[x] 아임웹 상품 페이지 오류 수정
[x] 위픽부스터 결제 플로우 QA
[x] 통합회원 레퍼러 추적 기능 구현 중
[x] 바이브코딩 ERP 프로토타입 리뷰`,
  },
  {
    date: '2026-03-04T09:00:00.000Z',
    authorEmail: 'youlim@wepick.kr',
    authorDisplayName: '이유림',
    source: 'MANUAL',
    content: `[AX 스프린트]
• 케이스스터디 페이지 마이그레이션 완료
• 인사이트 페이지 마이그레이션 진행 중
• AX 데일리 스크럼 참석

• 위픽오토 문의 버튼 위치 변경 요청 정리`,
  },
  {
    date: '2026-03-04T09:00:00.000Z',
    authorEmail: 'sanghyeon@wepick.kr',
    authorDisplayName: '권상현',
    source: 'MANUAL',
    content: `[x] AX 스프린트 데일리 스크럼
[x] ERP 매출 대시보드 프론트 구현
[x] Odoo → Supabase 데이터 싱크 로직 개발
[x] 대표님 ERP 데모 시연 준비`,
  },
  {
    date: '2026-03-04T09:00:00.000Z',
    authorEmail: 'heeyeon@wepick.kr',
    authorDisplayName: '조희연',
    source: 'MANUAL',
    content: `- IMWEB 가입자 수 추이 분석
- 채널별 유입 성과 비교 자료 작성
- AX 스프린트 회의록 정리
- 광고 캠페인 ROI 분석 (2월)`,
  },
  {
    date: '2026-03-04T09:00:00.000Z',
    authorEmail: 'jeongju@wepick.kr',
    authorDisplayName: '이정주',
    source: 'MANUAL',
    content: `- CPA 제안서 작성 연습 (장기렌트)
- 카카오 비지니스 채널 CS 응대 2건
- 코어타겟 광고 플랫폼 파악
- 선배님들 영업 콜 옆에서 청취 학습

[회고] 실제 콜을 들어보니 톤앤매너가 중요하다는 걸 체감했다.`,
  },

  // === 2026-03-05 (목) ===
  {
    date: '2026-03-05T09:00:00.000Z',
    authorEmail: 'youngeun@wepick.kr',
    authorDisplayName: '전영은',
    source: 'MANUAL',
    content: `[x] 일일 리드수 확인
[x] AX 스프린트 데일리 스크럼
[x] 전자책 환불 요청 1건 처리
[x] 리드마그넷 퍼널 KPI 대시보드 검토
[x] 아임웹 AX 프로젝트 범위 논의 w/ 유림, 정하
[x] 다음 주 스프린트 백로그 정리`,
  },
  {
    date: '2026-03-05T09:00:00.000Z',
    authorEmail: 'jungha@wepick.kr',
    authorDisplayName: '이정하',
    source: 'MANUAL',
    content: `[x] AX 스프린트 데일리 스크럼
[x] 통합회원 레퍼러 추적 기능 완료 → QA 중
[x] 위픽업 이미지 리사이징 로직 최적화
[x] 아임웹 AX 프로젝트 범위 논의 w/ 영은, 유림
[x] 다음 주 스프린트 플래닝 준비`,
  },
  {
    date: '2026-03-05T09:00:00.000Z',
    authorEmail: 'youlim@wepick.kr',
    authorDisplayName: '이유림',
    source: 'MANUAL',
    content: `[AX 스프린트]
• 인사이트 페이지 마이그레이션 완료
• 전체 페이지 반응형 QA
• AX 데일리 스크럼 참석

• 아임웹 AX 프로젝트 범위 논의 w/ 영은, 정하
• 다음 주 스프린트 백로그 리뷰

✔ 이번 주에 마이그레이션 3페이지 완료. 다음 주 목표는 나머지 2페이지 + 통합 테스트.`,
  },
  {
    date: '2026-03-05T09:00:00.000Z',
    authorEmail: 'sanghyeon@wepick.kr',
    authorDisplayName: '권상현',
    source: 'MANUAL',
    content: `[x] AX 스프린트 데일리 스크럼
[x] ERP 대시보드 대표님 데모 시연 (완료)
[x] 피드백 반영 사항 정리
[x] 데이터 싱크 스케줄러 구현
[x] 다음 주 스프린트 플래닝 준비`,
  },
  {
    date: '2026-03-05T09:00:00.000Z',
    authorEmail: 'heeyeon@wepick.kr',
    authorDisplayName: '조희연',
    source: 'MANUAL',
    content: `- 주간 성과 리포트 마감
- GA4 + IMWEB 통합 데이터 정리
- 3월 마케팅 KPI 목표 설정안 초안
- 네이버SA JG 캠페인 다음 주 운영 계획

✔ 데이터를 정리하면서 채널별 효율 차이가 꽤 크다는 걸 발견. 다음 주에 심화 분석 필요.`,
  },
  {
    date: '2026-03-05T09:00:00.000Z',
    authorEmail: 'jeongju@wepick.kr',
    authorDisplayName: '이정주',
    source: 'MANUAL',
    content: `- 개인회생 CPA 상품 제안서 초안 완성
- 카카오 비지니스 채널 CS 응대 4건
- Odoo에 신규 리드 2건 등록
- 1주차 온보딩 회고 작성

[회고] 첫 주가 끝났다. 아직 모르는 게 많지만 팀 분위기가 좋아서 적응이 빠를 것 같다. 다음 주부터는 직접 영업 콜도 시작해보겠다.`,
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
