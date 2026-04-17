# booster-internal — Claude 작업 지침

## 프로젝트 개요

- Next.js 16 / React 19 / Prisma / Supabase / Vercel 배포
- 주요 라우트:
  - `/kpis` — KPI 대시보드
  - `/leads` — 리드 관리
  - `/tasks` — 업무 관리

## 분리된 기능
- **광고성과분석** (`/ad-performance` 및 `/api/ad-*`) 은 별도 프로젝트 **booster-dashboard** 로 이관됨 (`C:\Users\jeony\Desktop\booster-dashboard`).
  이 저장소에 광고 통합 관련 코드를 다시 추가하지 말 것.

## ⚠️ 매체 API 관련 규칙 (참고)

이 저장소에는 현재 매체 API 호출 코드가 없지만, 혹시라도 Meta/Google/Naver/TikTok/당근 등 매체사 API를 호출하는 코드를 추가해야 한다면:
- **IP `222.109.27.119`** 환경에서만 호출 가능 (사내 화이트리스트 IP)
- 다른 IP에서 호출 시 토큰 차단·계정 제재 위험
- 우선적으로는 booster-dashboard 쪽에 작성할 것

## 작업 기본 방향
- 기존 파일 수정 우선. 새 파일·문서 생성 최소화
