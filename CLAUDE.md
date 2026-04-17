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

## ⚠️ 절대 커밋 금지

- **`.env.local`, `.env`, `.env.*` 파일은 절대로 `git add` / 커밋 / 푸시 금지.**
  - 이 파일들에는 API 키·DB 크리덴셜·시크릿이 들어간다. Git 히스토리에 한 번 올라가면 `force push`로 지워도 GitHub 캐시·fork·clone 등에 잔존.
  - `.gitignore` 에 이미 등록되어 있으나, 누군가 `git add -f` 로 강제 추가하거나 새 패턴의 env 파일을 만들 경우를 대비해 항상 확인.
  - 값을 공유해야 할 때는 **키 이름만** 담은 `.env.example` 만 커밋.
- **`.claude/settings.json`, `.claude/settings.local.json`, `.claude/launch.json`** 도 동일한 이유(Bash allow 리스트에 토큰이 평문으로 쌓일 수 있음)로 커밋 금지.
- 이미 유출된 토큰은 즉시 rotate → Vercel 환경변수 갱신 → 새 배포 순으로 처리.

## ⚠️ 매체 API 관련 규칙 (참고)

이 저장소에는 현재 매체 API 호출 코드가 없지만, 혹시라도 Meta/Google/Naver/TikTok/당근 등 매체사 API를 호출하는 코드를 추가해야 한다면:
- **IP `222.109.27.119`** 환경에서만 호출 가능 (사내 화이트리스트 IP)
- 다른 IP에서 호출 시 토큰 차단·계정 제재 위험
- 우선적으로는 booster-dashboard 쪽에 작성할 것

## 작업 기본 방향
- 기존 파일 수정 우선. 새 파일·문서 생성 최소화
