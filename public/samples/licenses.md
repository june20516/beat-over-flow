# 내장 샘플 라이선스

## 드럼 원샷 (kick, snare, hat, clap, tom, perc)

내장 드럼 원샷 6종은 **TR-808(Fischer) 샘플 세트**에서 가져왔다.

- **출처 저장소**: <https://github.com/tidalcycles/sounds-tr808-fischer>
- **원저작자**: Michael Fischer (Technopolis) — 롤랜드 TR-808 Rhythm Composer를
  직접 샘플링한 사운드 세트.
- **라이선스**: **CC0 1.0 Universal** (퍼블릭 도메인 기증).
  전문: <https://creativecommons.org/publicdomain/zero/1.0/legalcode>
  → 출처표시 의무 없이 개인·상업 프로젝트에서 자유롭게 사용·수정·재배포 가능.
- **고정 커밋**: `85fbecf1bec32553395625ea659e2a56dfd7c0e1`
  (재현성과 무결성을 위해 특정 커밋에 고정해 받는다.)
- **포맷**: 16-bit PCM, 44.1kHz, mono WAV.

### ID ↔ 원본 파일 매핑

| 내장 ID | 라벨 | Fischer 원본 경로 |
|---------|------|------------------|
| kick | 킥 | `bd8/BD5000.WAV` |
| snare | 스네어 | `sd8/SD5050.WAV` |
| hat | 하이햇 | `ch8/CH.WAV` |
| clap | 클랩 | `cp8/CP.WAV` |
| tom | 톰 | `mt8/MT50.WAV` |
| perc | 퍼커션 (카우벨) | `cb8/CB.WAV` |

### 재다운로드 / 교체

```sh
npm run samples:fetch   # 또는: node scripts/fetch-samples.mjs
```

다른 변형(예: 더 타이트한 `bd8/BD2500.WAV`, 림샷 `rs8/RS.WAV`)으로 바꾸려면
`scripts/fetch-samples.mjs`의 `MAPPING` 경로만 수정하고 다시 실행한다.
저장소 내 모든 파일이 동일하게 CC0 1.0이므로 어떤 변형을 골라도 라이선스 제약이 없다.

## 데모 베이스플로우 (moodmode-demo.mp3)

`moodmode-demo.mp3`는 데모/개발 검증용 베이스플로우 트랙이다. 출처: MoodMode의
**저작권 없는(no-copyright / royalty-free) 음원**. 에디터(가로 스크롤/줌, 플레이헤드,
시퀀서 등)를 충분히 긴 트랙으로 검증하기 위해 포함한다.

## 오프라인 폴백 — 합성 원샷

`scripts/gen-samples.mjs`는 ffmpeg/sox 없이 사인파+노이즈로 원샷을 **직접 합성**하는
스크립트다(자작 사운드 → CC0). 네트워크가 없는 환경 등에서의 폴백 생성기로 보관하며,
현재 배포 샘플은 위의 TR-808(Fischer) 세트다.
