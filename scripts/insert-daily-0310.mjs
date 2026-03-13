const tasks = [
  {
    date: "2026-03-10",
    authorEmail: "jeongju@wepick.kr",
    authorName: "이정주",
    content: `한가지 목표부터 구현하고 → 이후작업을 해야된다.
전체를 한번에 구현하려고하면 하나씩 고치는데 더 오래걸림.시작-끝을찾기어려움
레이아웃은 그려주면 훨씬 구현이 잘된다.
[x] 위픽업
[x] 신규입점문의 2건 ⇒ 상품등록완료 / 메일답변 완료
[x] 업데이트문의 2건 ⇒ 업데이트완료 / 메일답변 완료
[ ] 상담관리 MVP
[x] 기획안
[x] PRD 업데이트
[ ] 구현
[x] 잠재고객 후속관리탭추가
[x] 오늘할일 대시보드 추가
[ ] 상담나우 페이지 영역수정
[ ] 관리페이지`,
    source: "TEAMS",
  },
  {
    date: "2026-03-10",
    authorEmail: "youlim@wepick.kr",
    authorName: "이유림",
    content: `<업무>
[x] 상시업무
[x] 일일 리드수 확인
[x] 위픽부스터 회원가입 및 결제 가이드 업데이트 및 공유
[x] 관리자 메뉴 및 역할 분배 토의 w.정하희연
[x] dev 브랜치 병합 / 로컬 오류 해결중`,
    source: "TEAMS",
  },
  {
    date: "2026-03-10",
    authorEmail: "jungha@wepick.kr",
    authorName: "이정하",
    content: `*부스터 프론트 어드민 구조 기획 (11:30~ 13:00)

[프론트 AX]
• 어드민 메뉴 구조 정리 및 업무 분배
• 리드관리[리드/폼] 생성
  ㄴ폼 관리/생성 추가
  ㄴ리드 utm및 호출 위치 데이터 추가`,
    source: "TEAMS",
  },
];

async function insert() {
  for (const task of tasks) {
    const res = await fetch("http://localhost:3001/api/tasks/daily", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(task),
    });
    const data = await res.json();
    console.log(`${task.authorName} ${task.date}: ${data.ok ? "OK" : data.error}`);
  }
}

insert();
