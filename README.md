# OneSaaS Starter Kit

SaaS 프로젝트를 빠르게 시작할 수 있는 스타터 킷입니다.

## 기술 스택

- **프레임워크**: Next.js 14 (App Router)
- **스타일링**: Tailwind CSS
- **데이터베이스**: Supabase (PostgreSQL)
- **ORM**: Prisma
- **AI**: Vercel AI SDK (OpenAI, Anthropic, Google)
- **배포**: Vercel
- **개발 도구**: Claude Code + MCP

## 시작하기

### 1. 자동 설정 (권장)

```bash
npx degit onesass/onesass-starter my-saas-app
cd my-saas-app
pnpm install
pnpm setup
```

설정 마법사가 다음을 자동으로 처리합니다:
- GitHub 저장소 생성
- Supabase 프로젝트 생성
- Vercel 배포 설정
- AI Gateway 구성
- Claude Code MCP 설정

### 2. 개발 서버 실행

```bash
pnpm dev
```

[http://localhost:3000](http://localhost:3000)에서 확인하세요.

### 3. 데이터베이스 마이그레이션

```bash
pnpm db:push
```

## 프로젝트 구조

```
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── api/          # API Routes
│   │   └── page.tsx      # 홈페이지
│   ├── components/       # React 컴포넌트
│   ├── lib/              # 유틸리티 함수
│   ├── hooks/            # React 훅
│   └── types/            # TypeScript 타입
├── prisma/
│   └── schema.prisma     # 데이터베이스 스키마
├── public/               # 정적 파일
└── scripts/
    └── setup.mjs         # 설정 스크립트
```

## 스크립트

| 명령어 | 설명 |
|--------|------|
| `pnpm dev` | 개발 서버 실행 |
| `pnpm build` | 프로덕션 빌드 |
| `pnpm start` | 프로덕션 서버 실행 |
| `pnpm setup` | 프로젝트 설정 마법사 |
| `pnpm db:push` | DB 스키마 적용 |
| `pnpm db:studio` | Prisma Studio 실행 |

## 환경 변수

`.env.example`을 `.env`로 복사하고 필요한 값을 설정하세요:

```bash
cp .env.example .env
```

## 라이선스

MIT
