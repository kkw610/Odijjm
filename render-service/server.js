import express from "express";
import { chromium } from "playwright";

// 카카오 지도 타일은 CORS 헤더가 없어서 브라우저 안에서 canvas로 캡처하는 방식(html-to-image)으로는
// 지도를 절대 못 찍는다 (CORS는 canvas 픽셀 "읽기"만 막을 뿐 화면에 "보여주는" 건 안 막으므로,
// 진짜 브라우저로 렌더링해서 화면 그대로 스크린샷 뜨면 문제없다). 그래서 결과 카드만 이 서버에서
// 헤드리스 브라우저로 직접 열어서 찍어 PNG로 돌려준다.
const WEB_ORIGIN = process.env.WEB_ORIGIN || "http://web";
const PORT = process.env.PORT || 3000;

const app = express();
let browserPromise = null;

function getBrowser() {
  if (!browserPromise) browserPromise = chromium.launch({ args: ["--no-sandbox"] });
  return browserPromise;
}

app.get("/render/card", async (req, res) => {
  const { teamCode, meetingId, uid } = req.query;
  if (!teamCode || !meetingId || !uid) {
    return res.status(400).json({ error: "teamCode, meetingId, uid는 필수예요." });
  }

  const url = `${WEB_ORIGIN}/t/${encodeURIComponent(teamCode)}/m/${encodeURIComponent(meetingId)}?showCard=${encodeURIComponent(uid)}`;

  let context;
  try {
    const browser = await getBrowser();
    context = await browser.newContext({
      viewport: { width: 480, height: 900 },
      deviceScaleFactor: 3,
    });
    const page = await context.newPage();

    // "load"까지 기다리면 카카오맵 타일 이미지가 전부 로드될 때까지 붙잡혀서 타임아웃 나기 쉽다.
    // HTML 파싱만 끝나면 이동한 걸로 치고, 실제로 필요한 건 .result-card 셀렉터 대기가 대신한다.
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForSelector(".result-card", { timeout: 20000 });
    // 지도가 다 그려지면 뜨는 마커(.rc-hero-map-pin)를 기다린다 — 카카오맵 SDK 로드 + 타일 페인트까지
    // 끝났다는 확실한 신호. 지도 키가 없거나 로드가 실패해도(타임아웃) 그냥 진행해서 이모지 폴백을 찍는다.
    await page.waitForSelector(".rc-hero-map-pin", { timeout: 8000 }).catch(() => {});

    const card = await page.$(".result-card");
    const buffer = await card.screenshot({ type: "png" });

    res.set("Content-Type", "image/png");
    res.set("Cache-Control", "no-store");
    res.send(buffer);
  } catch (err) {
    console.error("[render-service] 카드 렌더링 실패:", err.message);
    res.status(500).json({ error: "카드를 렌더링하지 못했어요." });
  } finally {
    if (context) await context.close().catch(() => {});
  }
});

app.get("/render/health", (_req, res) => res.send("ok"));

app.listen(PORT, () => {
  console.log(`[render-service] listening on ${PORT}, target origin ${WEB_ORIGIN}`);
});
