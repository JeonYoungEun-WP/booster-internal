const API = 'http://localhost:3001/api/tasks/weekly'

const weekStart = '2026-03-09' // 이번 주 월요일

const plans = [
  {
    authorEmail: 'youngeun@wepick.kr',
    weeklyPlan: `- 리드마그넷 퍼널 KPI 대시보드 최종 검토
- 전자책 3월 프로모션 기획
- 아임웹 AX 프로젝트 1차 범위 확정
- 일일 리드수 모니터링 + 주간 리포팅
- 대표님 주간 보고 (수)`,
  },
  {
    authorEmail: 'sanghyeon@wepick.kr',
    weeklyPlan: `- ERP 대시보드 피드백 반영 및 수정
- 매출 데이터 자동 싱크 안정화
- 부스터 솔루션 상담관리 MVP 설계
- AX 스프린트 백로그 처리`,
  },
  {
    authorEmail: 'youlim@wepick.kr',
    weeklyPlan: `- 아임웹 → Next.js 나머지 2페이지 마이그레이션
- 통합 QA 테스트 진행
- AX 프로젝트 프론트 문서 정리
- 위픽오토 UI 개선사항 반영`,
  },
  {
    authorEmail: 'jungha@wepick.kr',
    weeklyPlan: `- 통합회원 레퍼러 추적 QA 완료 및 배포
- 위픽업 파일 업로드 성능 최적화
- 상담관리 MVP 백엔드 설계 시작
- AX 스프린트 데일리 스크럼`,
  },
  {
    authorEmail: 'jeongju@wepick.kr',
    weeklyPlan: `- 상담관리 MVP 이전 작업내역 정리
- 부스터솔루션 AX화 상세 기획
- 플랫폼팀 개발 태스크 첫 담당
- 코드 리뷰 참여 시작`,
  },
  {
    authorEmail: 'heeyeon@wepick.kr',
    weeklyPlan: `- 3월 마케팅 KPI 목표 최종 확정
- GA4 + IMWEB 통합 분석 리포트 작성
- 네이버SA JG 캠페인 최적화
- 아임웹 AX 프로젝트 데이터 분석 지원`,
  },
]

async function seed() {
  for (const plan of plans) {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weekStart, ...plan }),
    })
    const data = await res.json()
    console.log(`${plan.authorEmail}: ${data.ok ? '✓' : data.error}`)
  }
  console.log('\nDone!')
}

seed()
