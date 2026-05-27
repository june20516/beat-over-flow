# 구현 노트

진행 로그(태스크별 커밋·테스트 수)는 git 히스토리로 대체되었다. 이 파일에는 코드/커밋만
봐서는 알기 어려운 **설계·구현 결정(계획 이탈 포함)**과 **아직 사람이 확인해야 할 항목**만 남긴다.

설계 문서: `docs/superpowers/specs/`.

## 비자명한 구현 결정

- **테스트 환경에서 Node Blob/File 주입** (`src/test-setup.ts`): jsdom의 `Blob`은
  `.text()`/`.arrayBuffer()`를 구현하지 않아 assets 테스트가 깨지고 structuredClone 시
  Blob이 일반 Object로 변형된다. `node:buffer`의 spec 준수 구현으로 `globalThis.Blob`/`File`을
  교체해 우회. 이 때문에 `@types/node`가 devDependencies에 있다. (실 브라우저는 원래 정상)
- **퍼커션 샘플은 자작 합성** (`scripts/gen-samples.mjs`): ffmpeg/sox 부재로 6종을 직접 합성(CC0).
  16-bit PCM WAV 내용을 `.ogg` 파일명으로 저장 — `decodeAudioData`가 내용으로 판별하므로 재생됨.
- **autosave 테스트는 `runAllTimersAsync()` 사용**: `advanceTimersByTimeAsync(0)`는
  fake-indexeddb의 setImmediate 큐를 플러시하지 못해 타임아웃. 저장 동작은 동일.
- **예제 프로젝트 마커는 오프라인 분석으로 굽는다** (`scripts/analyze-demo.mjs`): wasm 디코더
  (`mpg123-decoder`, devDep)로 PCM을 얻어 스펙트럴 플럭스 온셋 검출→16분 그리드 양자화→대역
  라우팅→트랙당 전 구간 균등 솎기(`thinUniform`, 머리 편향 방지)로 `src/example/
  exampleData.generated.ts`를 생성. 런타임/일반 빌드는 디코더 비의존(생성물만 커밋). 순수 DSP는
  `scripts/analysisCore.mjs`로 분리해 vitest로 단위 검증. 추정 BPM·마커 음악성은 사람 청취 검증 권장.
- **인라인 이름 수정의 Escape 취소**: input을 언마운트하면 `onBlur`가 뒤늦게 발화해 저장돼 버리므로,
  Escape는 `cancelRef`를 세팅하고 blur만 호출 → 단일 커밋 경로(onBlur)가 ref를 보고 저장을 건너뛴다
  (ProjectList 카드 · Editor 상단 동일 패턴).

## Editor v2 — 계약 우선 원칙으로 인한 계획 이탈

설계(§4)·계약(§1)이 단일 기준이고 개별 계획과 어긋날 땐 계약을 따랐다.

- **Timeline 행 구조 재편**: 계획 v2-2엔 `Timeline.tsx` 수정이 없었으나 계약이 `TrackRow[]`를
  Timeline 하위로 규정 → Timeline을 헤더 행(좌 고정 컬럼 | 우 arrange) + `.timeline__rows`로 재구성.
- **시퀀서 인라인화 단일 커밋**: 계획 v2-5는 Task 3/4/5 분리였으나 중간 단계에서 tsc가 깨져
  ("태스크 종료 시 그린" 규약 위반) 세 변경을 한 그린 커밋으로 통합.

## 사람 검증 필요 (헤드리스로 확정 불가, 여전히 열려 있음)

단위 테스트·헤드리스 스크린샷으로 가능한 만큼은 검증했으나 아래는 실사용/청취로 확인 권장.

- **줌/팬 커서 앵커**: shift+wheel 줌이 커서 기준으로 정확히 확대되고 페이지 스크롤이 없는지
  (긴 오디오에서). 수학은 `zoomedViewport` 단위테스트로 검증됨.
- **auto-follow 느낌**: 수동 팬 시 추종 해제 → 재생 누르면 재활성되는 실제 사용 감(단위테스트는 통과).
- **드래그 정렬 감**: 드래그 중 시각 피드백(opacity/transform), 핸들 외 컨트롤과의 충돌 여부.
- **키 입력 차단**: play/record 모드에서 Space 등이 페이지 스크롤/버튼 클릭을 실제로 안 일으키는지.
- **소리/채점 청취**: perform 모드 미리듣기·채점 소리 (Web Audio 출력은 헤드리스 청취 불가).
