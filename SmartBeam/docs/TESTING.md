# Testing

## Automated
- `npm test` — jest-expo: formatting, file types, PPTX/DOCX outline parser, ConnectionManager honesty rules (failed/guidance/lost links), presentation controller ↔ adapter integration, QR parsing.
- `cd backend && npm test` — upload validation (magic bytes), API key, serving/deletion, expiry sweep, room auth + long-poll.
- `npm run typecheck`.

## Real-hardware checklist (required before release)
Record phone model/Android version, receiver model/firmware, Wi-Fi band.

**Google Cast** — [ ] receiver listed within 10 s · [ ] connect confirms only after session starts · [ ] MP4 plays, seek/pause/volume work, position updates · [ ] JPG/PNG shows · [ ] custom receiver: PDF page 1 shows, next/prev/goto, pause badge, blackout, laser · [ ] switching Wi-Fi off → "disconnected" shown · [ ] receiver idle timeout / phone sleep · [ ] default receiver + PDF → clear "custom receiver required" message.

**External display** — [ ] HDMI/USB-C adapter detected · [ ] PDF/image/video render full-screen, phone UI stays separate · [ ] unplug → "display disconnected" + presentation continues locally · [ ] rotate phone mid-presentation.

**Miracast** — [ ] settings screen opens on Samsung/Xiaomi/Pixel/others · [ ] app never claims "connected" · [ ] full-screen local presenting is mirrored.

**QR room** — [ ] QR scans from TV/PC browser · [ ] consent prompt appears before upload · [ ] closing receiver page → app reports offline · [ ] uploads deleted after End (check server `data/content`).

**Files / documents** — [ ] each of PDF, PPT, PPTX, DOC, DOCX, JPG, JPEG, PNG, MP4, MOV imports and opens · [ ] 200-page PDF memory/scroll · [ ] password-protected PDF → friendly error · [ ] legacy .ppt without server → clear message · [ ] SAF folder grant persists after reboot · [ ] airplane mode: local PDF/video work.

**Presenter** — [ ] timer pauses with Pause · [ ] resume from History opens the last slide · [ ] notes show for PPTX · [ ] app killed mid-presentation → history keeps last slide.

**Privacy** — [ ] no broad storage permission in `adb shell dumpsys package com.smartbeam.app` · [ ] camera requested only on QR screen.
