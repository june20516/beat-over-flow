# TR-808(Fischer) 내장 샘플 도입 설계

## 배경

기존 드럼 원샷 6종(kick/snare/hat/clap/tom/perc)은 `scripts/gen-samples.mjs`로
사인파+노이즈 합성한 자작 사운드라 음감이 둔탁하다. 라이선스 문제 없는 표준적인
샘플로 교체한다.

## 결정

- **출처**: [tidalcycles/sounds-tr808-fischer](https://github.com/tidalcycles/sounds-tr808-fischer)
  — Michael Fischer가 샘플링한 롤랜드 TR-808 사운드, 16-bit/44.1kHz WAV.
- **라이선스**: CC0 1.0 Universal (퍼블릭 도메인, 출처표시 불필요, 상업적 재배포 가능).
- **고정 커밋**: `85fbecf1bec32553395625ea659e2a56dfd7c0e1` (재현성·무결성).
- **소싱**: 다운로드 스크립트(`scripts/fetch-samples.mjs`)로 6개 파일을 받아
  `public/samples/{id}.wav`로 저장. 사용자가 청취 후 변형 버전으로 교체 가능.
- **형식**: 확장자를 실제 내용에 맞춰 `.ogg` → `.wav`로 전환.

## 기본 매핑

| ID | 라벨 | Fischer 경로 | 비고 |
|----|------|-------------|------|
| kick | 킥 | `bd8/BD5000.WAV` | 베이스드럼, 중간 디케이 |
| snare | 스네어 | `sd8/SD5050.WAV` | 톤/스냅 균형 |
| hat | 하이햇 | `ch8/CH.WAV` | 클로즈드 햇 |
| clap | 클랩 | `cp8/CP.WAV` | 핸드클랩 |
| tom | 톰 | `mt8/MT50.WAV` | 미드 톰 |
| perc | 퍼커션 | `cb8/CB.WAV` | 카우벨 |

## 변경 범위

1. `scripts/fetch-samples.mjs` 신규 — 커밋 고정 raw URL에서 6개 파일 다운로드.
2. `package.json` — `"samples:fetch"` 스크립트 추가.
3. `public/samples/*.ogg`(6개) 삭제 → `*.wav`로 대체. `moodmode-demo.mp3` 유지.
4. `src/audio/builtinSamples.ts` — `sampleUrl()`이 `.wav` 반환.
5. `src/audio/builtinSamples.test.ts` — 기대값 `.wav`로 갱신.
6. `public/samples/licenses.md` — TR-808 Fischer 출처·CC0 1.0 전문 링크·커밋 SHA·
   매핑 표로 갱신. 라이선스 근거를 명확히 기록.
7. `scripts/gen-samples.mjs` — 오프라인 폴백으로 유지, 문서에 역할 명시.

## 범위 밖 (YAGNI)

- 6종 외 키트 확장(오픈햇/추가 퍼커션 등), 도메인 모델 변경.

## 검증

- `npm test` — `.wav` 계약 테스트 통과.
- `npm run dev` — 실제 재생 청취(수동).
