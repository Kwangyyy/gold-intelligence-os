"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Bilingual } from "./types";

export type Lang = "th" | "en";

// Flat dictionary of static UI strings. Enum values (conditions, labels, …)
// are translated by the helper maps below, not here.
const DICT: Record<string, Bilingual> = {
  appTitle: { th: "Gold Intelligence OS", en: "Gold Intelligence OS" },
  appSubtitle: {
    th: "ระบบวิเคราะห์ทองคำ XAUUSD โดย EA Profit Lab",
    en: "XAUUSD Intelligence by EA Profit Lab",
  },
  marketOverview: { th: "ภาพรวมตลาด", en: "Market Overview" },
  live: { th: "เรียลไทม์", en: "LIVE" },
  delayed: { th: "ข้อมูลสำรอง", en: "FALLBACK" },
  lastUpdated: { th: "อัปเดตล่าสุด", en: "Last updated" },

  // hero cards
  cardPrice: { th: "ราคาทองคำ", en: "Gold Price" },
  cardRecommendation: { th: "คำแนะนำ AI", en: "AI Recommendation" },
  cardScore: { th: "คะแนนตลาด", en: "Market Score" },
  cardVolatility: { th: "ความผันผวน", en: "Volatility" },
  cardNewsRisk: { th: "ความเสี่ยงข่าว", en: "News Risk" },

  // stats
  open: { th: "เปิด", en: "Open" },
  high: { th: "สูงสุด", en: "High" },
  low: { th: "ต่ำสุด", en: "Low" },
  spread: { th: "สเปรด", en: "Spread" },
  atr: { th: "ATR วันนี้", en: "ATR Today" },
  dailyRange: { th: "กรอบราคาวันนี้", en: "Daily Range" },
  dailyChange: { th: "เปลี่ยนแปลงวันนี้", en: "Daily Change" },
  marketCondition: { th: "สภาวะตลาด", en: "Market Condition" },
  prevClose: { th: "ราคาปิดก่อนหน้า", en: "Prev Close" },

  // session
  session: { th: "ช่วงตลาด", en: "Session" },
  currentSession: { th: "ช่วงตลาดปัจจุบัน", en: "Current Session" },
  londonOpen: { th: "เปิดลอนดอนใน", en: "London opens in" },
  newYorkOpen: { th: "เปิดนิวยอร์กใน", en: "New York opens in" },
  openNow: { th: "เปิดอยู่", en: "Open now" },

  // recommendation panel
  confidence: { th: "ความเชื่อมั่น", en: "Confidence" },
  riskLevel: { th: "ระดับความเสี่ยง", en: "Risk Level" },
  mainReasons: { th: "เหตุผลหลัก", en: "Main Reasons" },
  oppositeRisk: { th: "ความเสี่ยงฝั่งตรงข้าม", en: "Opposite Risk" },
  invalidation: { th: "จุดที่มุมมองผิด", en: "Invalidation" },
  suggestedAction: { th: "สิ่งที่ควรทำ", en: "Suggested Action" },
  aiReasoning: { th: "เหตุผลของ AI", en: "AI Reasoning" },
  showReasoning: { th: "ดูเหตุผล", en: "Show reasoning" },
  hideReasoning: { th: "ซ่อนเหตุผล", en: "Hide reasoning" },
  poweredByGemini: { th: "วิเคราะห์โดย Gemini", en: "Powered by Gemini" },
  ruleBasedFallback: { th: "โหมดสำรอง (กฎพื้นฐาน)", en: "Rule-based fallback" },
  newsImpact: { th: "ผลกระทบต่อทองคำ", en: "Impact on Gold" },

  // news
  nextEvent: { th: "ข่าวถัดไป", en: "Next Event" },
  forecast: { th: "คาดการณ์", en: "Forecast" },
  previous: { th: "ครั้งก่อน", en: "Previous" },
  noUpcomingNews: { th: "ไม่มีข่าวสำคัญเร็ว ๆ นี้", en: "No high-impact news soon" },
  newsWarning: {
    th: "⚠ ข่าวแรงใกล้ออกภายใน 30 นาที — ระวังความผันผวน",
    en: "⚠ High-impact news within 30 min — expect volatility",
  },

  // misc
  inMinutes: { th: "นาที", en: "min" },
  inHours: { th: "ชม.", en: "h" },
  notTradingAdvice: {
    th: "ไม่ใช่คำแนะนำการลงทุน",
    en: "Not financial advice",
  },
  disclaimerTitle: { th: "คำเตือนความเสี่ยง", en: "Risk Disclaimer" },
  disclaimerBody: {
    th: "การลงทุนมีความเสี่ยง ผู้ลงทุนควรศึกษาข้อมูลก่อนตัดสินใจ ระบบนี้เป็นเครื่องมือช่วยวิเคราะห์ ไม่ใช่การรับประกันผลกำไร และผลลัพธ์ในอดีตไม่ได้ยืนยันผลลัพธ์ในอนาคต",
    en: "Trading involves risk. Study the information before deciding. This system is an analysis tool, not a guarantee of profit, and past results do not confirm future results.",
  },
  sourceNote: {
    th: "ราคาอ้างอิงจากสัญญาทองคำล่วงหน้า COMEX (GC=F) ใกล้เคียงกับ XAUUSD spot",
    en: "Price referenced from COMEX gold futures (GC=F), a close proxy for XAUUSD spot",
  },
  loading: { th: "กำลังโหลดข้อมูลตลาด…", en: "Loading market data…" },

  // nav
  navOverview: { th: "ภาพรวมตลาด", en: "Overview" },
  navChart: { th: "กราฟ", en: "Chart" },
  navMultiTimeframe: { th: "หลายไทม์เฟรม", en: "Multi-Timeframe" },

  // chart page
  chartTitle: { th: "กราฟทองคำ XAUUSD", en: "XAUUSD Live Chart" },
  chartSubtitle: {
    th: "กราฟราคาทองจริง เลือกได้หลายไทม์เฟรม พร้อมอินดิเคเตอร์ (เพิ่มเองได้จากแถบเครื่องมือ)",
    en: "Real-time gold chart across timeframes with indicators (add more from the toolbar)",
  },
  chartSource: {
    th: "กราฟจาก TradingView (ข้อมูลจริง) · เพิ่ม/ปรับอินดิเคเตอร์ได้จากแถบเครื่องมือบนกราฟ",
    en: "Chart by TradingView (real data) · add or edit indicators from the chart toolbar",
  },
  hintChart: {
    th: "เลือกไทม์เฟรมด้านบน หรือกดไอคอน 'อินดิเคเตอร์' (fx) บนกราฟเพื่อเพิ่มเครื่องมือ เช่น EMA, RSI, MACD",
    en: "Pick a timeframe above, or click the 'Indicators' (fx) icon on the chart to add tools like EMA, RSI, MACD.",
  },
  navTechnical: { th: "เทคนิคอล", en: "Technical" },
  navChat: { th: "AI Copilot", en: "AI Copilot" },
  navContent: { th: "คอนเทนต์", en: "Content" },

  // content studio
  contentTitle: { th: "Content Studio", en: "Content Studio" },
  contentSubtitle: {
    th: "สร้างบทวิเคราะห์ แคปชั่น และแฮชแท็กจากข้อมูลจริงอัตโนมัติ",
    en: "Auto-generate briefs, captions & hashtags from live data",
  },
  ctTone: { th: "โทนภาษา", en: "Tone" },
  ctToneProfessional: { th: "ทางการ", en: "Professional" },
  ctToneFriendly: { th: "เป็นกันเอง", en: "Friendly" },
  ctToneTrendy: { th: "วัยรุ่น", en: "Trendy" },
  ctBrief: { th: "บทวิเคราะห์ (Brief)", en: "Gold Brief" },
  ctCaption: { th: "แคปชั่นโซเชียล", en: "Social Caption" },
  ctHashtags: { th: "แฮชแท็ก", en: "Hashtags" },
  ctCopy: { th: "คัดลอก", en: "Copy" },
  ctCopied: { th: "คัดลอกแล้ว ✓", en: "Copied ✓" },
  ctRefresh: { th: "รีเฟรชข้อมูล", en: "Refresh data" },
  loadingContent: { th: "กำลังสร้างคอนเทนต์…", en: "Generating content…" },
  navLevels: { th: "แนวรับแนวต้าน", en: "S / R" },
  navSmc: { th: "Smart Money", en: "Smart Money" },
  navCorrelation: { th: "Correlation", en: "Correlation" },
  navRisk: { th: "ความเสี่ยง", en: "Risk" },
  navWhatif: { th: "What-if", en: "What-if" },
  navPlan: { th: "แผนเทรด", en: "Trade Plan" },
  navAlerts: { th: "แจ้งเตือน", en: "Alerts" },
  navPortfolio: { th: "พอร์ต/EA", en: "Portfolio" },

  // portfolio page
  pfTitle: { th: "พอร์ตและ EA Monitor", en: "Portfolio & EA Monitor" },
  pfSubtitle: {
    th: "ภาพรวมบัญชี สถานะ EA และสุขภาพพอร์ต",
    en: "Account overview, EA status & portfolio health",
  },
  pfDemo: {
    th: "⚠ บัญชีจำลอง (Demo) — ยังไม่ได้เชื่อมต่อ MT5 จริง ตัวเลขเป็นการจำลอง โดยกำไร/ขาดทุนลอยตัวอิงราคาทองจริง",
    en: "⚠ Simulated demo account — not connected to a real MT5. Numbers are mock; floating P/L tracks the real gold price.",
  },
  pfBalance: { th: "ยอดเงิน (Balance)", en: "Balance" },
  pfEquity: { th: "อิควิตี้ (Equity)", en: "Equity" },
  pfFloating: { th: "กำไร/ขาดทุนลอยตัว", en: "Floating P/L" },
  pfDrawdown: { th: "Drawdown", en: "Drawdown" },
  pfMarginLevel: { th: "ระดับมาร์จิ้น", en: "Margin Level" },
  pfMarginUsed: { th: "มาร์จิ้นที่ใช้", en: "Margin Used" },
  pfFreeMargin: { th: "มาร์จิ้นคงเหลือ", en: "Free Margin" },
  pfToday: { th: "กำไรวันนี้", en: "Today" },
  pfWeek: { th: "สัปดาห์นี้", en: "This Week" },
  pfMonth: { th: "เดือนนี้", en: "This Month" },
  pfEquityCurve: { th: "กราฟอิควิตี้", en: "Equity Curve" },
  pfPositions: { th: "สถานะที่เปิดอยู่", en: "Open Positions" },
  pfExposure: { th: "ขนาดสถานะรวม", en: "Lot Exposure" },
  pfNetDir: { th: "ทิศทางสุทธิ", en: "Net Direction" },
  pfHealth: { th: "สุขภาพพอร์ต", en: "Portfolio Health" },
  pfEAs: { th: "สถานะ EA", en: "EA Status" },
  pfWinRate: { th: "อัตราชนะ", en: "Win Rate" },
  pfProfitFactor: { th: "Profit Factor", en: "Profit Factor" },
  pfRecovery: { th: "Recovery Factor", en: "Recovery Factor" },
  pfGrid: { th: "Grid ปัจจุบัน", en: "Current Grid" },
  pfRunning: { th: "ทำงาน", en: "Running" },
  pfPaused: { th: "พัก", en: "Paused" },
  pfLong: { th: "ซื้อสุทธิ", en: "Net Long" },
  pfShort: { th: "ขายสุทธิ", en: "Net Short" },
  pfFlat: { th: "สมดุล", en: "Flat" },
  hpHealthy: { th: "แข็งแรง", en: "Healthy" },
  hpWatch: { th: "เฝ้าระวัง", en: "Watch" },
  hpRisky: { th: "เสี่ยง", en: "Risky" },
  hpCritical: { th: "วิกฤต", en: "Critical" },
  loadingPf: { th: "กำลังโหลดข้อมูลพอร์ต…", en: "Loading portfolio…" },

  // subscription tier (preview)
  tierFree: { th: "ฟรี", en: "Free" },
  tierPremium: { th: "พรีเมียม", en: "Premium" },
  tierPro: { th: "โปร", en: "Pro" },
  tierLabel: { th: "แพ็กเกจ", en: "Plan" },
  lockedTitle: { th: "ฟีเจอร์นี้ต้องอัปเกรด", en: "This feature needs an upgrade" },
  lockedBody: {
    th: "ฟีเจอร์นี้เปิดให้เฉพาะแพ็กเกจที่สูงกว่าบัญชีของคุณ",
    en: "This page is available on a higher plan than your account.",
  },
  lockedNeedLogin: {
    th: "ต้องเข้าสู่ระบบก่อนใช้งานฟีเจอร์นี้",
    en: "Sign in to access this feature.",
  },
  lockedNoSelfServe: {
    th: "ระบบสมัครสมาชิกแบบชำระเงินยังไม่เปิดให้บริการตอนนี้ — ติดต่อ EA Profit Lab หากต้องการทดลองใช้งานแพ็กเกจที่สูงขึ้น",
    en: "Paid plans aren't open yet — contact EA Profit Lab if you'd like early access to a higher tier.",
  },
  upgradeTo: { th: "อัปเกรดเป็น", en: "Upgrade to" },
  tierPreviewNote: {
    th: "หมายเหตุ: นี่คือตัวอย่างระบบแพ็กเกจ ไม่ใช่ระบบสมาชิก/ชำระเงินจริง",
    en: "Note: this is a preview of the plan tiers — not real auth or billing.",
  },

  // module hub
  hubTitle: { th: "เครื่องมือทั้งหมด", en: "All Tools" },
  hub_chart_view: { th: "กราฟทองจริงหลายไทม์เฟรม + อินดิเคเตอร์", en: "Real gold chart, multi-timeframe + indicators" },
  hub_technical: { th: "แนวโน้มทุกไทม์เฟรมพร้อมมุมมองรวม", en: "Trend across every timeframe with an overall bias" },
  hub_indicators: { th: "อินดิเคเตอร์ครบชุด + คะแนนเทคนิคอล", en: "Full indicator suite + technical score" },
  hub_smc: { th: "โครงสร้างราคา ออเดอร์บล็อก สภาพคล่อง", en: "Market structure, order blocks, liquidity" },
  hub_levels: { th: "แนวรับแนวต้านจากหลายแหล่งรวมกัน", en: "Multi-source support & resistance levels" },
  hub_correlation: { th: "ตลาดอื่นหนุนหรือกดดันทอง", en: "Which markets help or hurt gold" },
  hub_plan: { th: "แผนเทรดพร้อมจุดเข้า/SL/TP", en: "A ready plan with entry / SL / TP" },
  hub_risk: { th: "คำนวณขนาดล็อตและความเสี่ยง", en: "Lot-size & risk calculator" },
  hub_whatif: { th: "จำลองผลกระทบจากข่าวสำคัญ", en: "Simulate the impact of key events" },
  hub_portfolio: { th: "ภาพรวมบัญชีและสถานะ EA (จำลอง)", en: "Account & EA overview (simulated)" },
  hub_alerts: { th: "ตั้งแจ้งเตือนราคาและสัญญาณ", en: "Set price & signal alerts" },
  hub_chat: { th: "ถามตอบกับ AI จากข้อมูลในระบบ", en: "Ask the AI about the live data" },
  hub_content: { th: "สร้างบทวิเคราะห์/แคปชั่นจากข้อมูลจริง", en: "Generate briefs & captions from live data" },

  // beginner / pro mode
  modeBeginner: { th: "มือใหม่", en: "Beginner" },
  modePro: { th: "มืออาชีพ", en: "Pro" },
  beginnerWhatToDo: { th: "สรุปง่าย ๆ ควรทำอะไร", en: "Simple summary — what to do" },
  beginnerRiskFirst: { th: "ดูความเสี่ยงก่อนเสมอ", en: "Always check the risk first" },
  beginnerSeePro: { th: "อยากดูรายละเอียดทั้งหมด? สลับเป็นโหมดมืออาชีพ", en: "Want full detail? Switch to Pro mode." },
  // per-page beginner hints
  hintIndicators: {
    th: "หน้านี้รวมอินดิเคเตอร์หลายตัว ดู 'คะแนนเทคนิคอล' ด้านบนเป็นภาพรวมก็พอ ยิ่งเขียว = ยิ่งเป็นขาขึ้น",
    en: "This page bundles many indicators — the 'Technical Score' at top is the summary. Greener = more bullish.",
  },
  hintSmc: {
    th: "Smart Money คือการดูพฤติกรรมเงินก้อนใหญ่ ดู 'มุมมอง SMC' และโซนสำคัญก็พอสำหรับเริ่มต้น",
    en: "Smart Money tracks big-player behavior. For a start, just read the 'SMC Bias' and the key zones.",
  },
  hintLevels: {
    th: "แนวรับ = ราคาที่มักเด้งขึ้น, แนวต้าน = ราคาที่มักย่อลง 'แนวที่สำคัญที่สุด' คือจุดที่ควรจับตา",
    en: "Support = where price tends to bounce; resistance = where it tends to stall. Watch the 'Key Level'.",
  },
  hintCorrelation: {
    th: "ตารางนี้บอกว่าตลาดอื่นหนุนหรือกดดันทอง ดู 'คะแนนสนับสนุนทองคำ' เป็นภาพรวม",
    en: "This shows whether other markets help or hurt gold. The 'Gold Support Score' is the summary.",
  },
  hintPlan: {
    th: "นี่คือแผนเทรดตัวอย่าง: จุดเข้า, จุดตัดขาดทุน (SL) และเป้ากำไร (TP) อย่าลืมใส่ทุนและ % ความเสี่ยงเพื่อคำนวณล็อต",
    en: "This is a sample plan: entry, stop loss (SL), and targets (TP). Enter your balance and risk % to size the lot.",
  },

  // alert center page
  alertsTitle: { th: "ศูนย์แจ้งเตือน", en: "Alert Center" },
  alertsSubtitle: {
    th: "ตั้งแจ้งเตือนราคา คะแนนตลาด และคำแนะนำ AI แบบเรียลไทม์",
    en: "Set real-time alerts on price, market score, and AI signals",
  },
  alCreate: { th: "สร้างการแจ้งเตือน", en: "Create Alert" },
  alType: { th: "ประเภท", en: "Type" },
  alValue: { th: "ค่า", en: "Value" },
  alAdd: { th: "เพิ่ม", en: "Add" },
  alActive: { th: "กำลังเฝ้าดู", en: "Active" },
  alTriggered: { th: "แจ้งเตือนแล้ว", en: "Triggered" },
  alNoAlerts: { th: "ยังไม่มีการแจ้งเตือน", en: "No alerts yet" },
  alTimeline: { th: "ประวัติการแจ้งเตือน", en: "Triggered Timeline" },
  alNoTriggers: { th: "ยังไม่มีการแจ้งเตือนเกิดขึ้น", en: "Nothing has triggered yet" },
  alEnableNotif: { th: "เปิดการแจ้งเตือนเบราว์เซอร์", en: "Enable browser notifications" },
  alNotifOn: { th: "การแจ้งเตือนเปิดอยู่", en: "Notifications on" },
  alDelete: { th: "ลบ", en: "Delete" },
  alClear: { th: "ล้างประวัติ", en: "Clear" },
  alRearm: { th: "ตั้งใหม่", en: "Re-arm" },
  alWatching: { th: "กำลังเฝ้าดูราคา", en: "Watching" },
  alChannelsNote: {
    th: "เวอร์ชันนี้รองรับการแจ้งเตือนผ่านเบราว์เซอร์ (Telegram/Discord/LINE/Email จะเพิ่มภายหลัง)",
    en: "This build supports browser notifications (Telegram/Discord/LINE/Email coming later).",
  },
  // alert type names
  al_price_above: { th: "ราคาสูงกว่า", en: "Price above" },
  al_price_below: { th: "ราคาต่ำกว่า", en: "Price below" },
  al_score_above: { th: "คะแนนตลาดสูงกว่า", en: "Market score above" },
  al_score_below: { th: "คะแนนตลาดต่ำกว่า", en: "Market score below" },
  al_reco_change: { th: "คำแนะนำ AI เปลี่ยน", en: "AI recommendation changes" },
  al_news_30m: { th: "ข่าวแรงภายใน 30 นาที", en: "High-impact news within 30 min" },

  // trade plan page
  planTitle: { th: "ตัวสร้างแผนเทรด", en: "Trading Plan Generator" },
  planSubtitle: {
    th: "แผนเทรด XAUUSD จากคำแนะนำ AI แนวรับแนวต้าน และความผันผวน",
    en: "An XAUUSD plan from the AI view, S/R levels & volatility",
  },
  planBias: { th: "มุมมอง", en: "Bias" },
  planDirection: { th: "ทิศทาง", en: "Direction" },
  planLong: { th: "ซื้อ (Long)", en: "Long" },
  planShort: { th: "ขาย (Short)", en: "Short" },
  planNoTrade: { th: "ยังไม่เทรด", en: "No Trade" },
  planEntryZone: { th: "โซนเข้า", en: "Entry Zone" },
  planStopLoss: { th: "Stop Loss", en: "Stop Loss" },
  planInvalidation: { th: "จุดที่แผนผิด", en: "Invalidation" },
  planRR: { th: "Risk : Reward (ถึง TP2)", en: "Risk : Reward (to TP2)" },
  planReasons: { th: "เหตุผล", en: "Rationale" },
  planAlternative: { th: "แผนสำรอง", en: "Alternative Scenario" },
  planSizing: { th: "คำนวณขนาดสถานะ", en: "Position Sizing" },
  planLots: { th: "ขนาดล็อต", en: "Lot Size" },
  planTargets: { th: "เป้าหมายทำกำไร", en: "Take Profits" },
  planNewsWarn: {
    th: "⚠ มีข่าวแรงใกล้ออก — ระวังความผันผวนและพิจารณาลดขนาด",
    en: "⚠ High-impact news is near — expect volatility, consider smaller size",
  },
  loadingPlan: { th: "กำลังสร้างแผนเทรด…", en: "Building trading plan…" },
  planError: { th: "ไม่สามารถสร้างแผนได้ ลองใหม่อีกครั้ง", en: "Could not build a plan. Please retry." },

  // what-if page
  whatifTitle: { th: "จำลองสถานการณ์ (What-if)", en: "What-if Scenarios" },
  whatifSubtitle: {
    th: "ประเมินผลกระทบของเหตุการณ์สำคัญต่อทองคำและพอร์ตของคุณ",
    en: "Estimate how key events could move gold and your position",
  },
  wiPosition: { th: "สถานะของคุณ", en: "Your Position" },
  wiLots: { th: "ขนาดล็อต", en: "Lot Size" },
  wiScenario: { th: "สถานการณ์", en: "Scenario" },
  wiGold: { th: "ทิศทางทอง", en: "Gold" },
  wiMove: { th: "คาดการเคลื่อนไหว", en: "Expected Move" },
  wiTarget: { th: "ราคาเป้าหมาย", en: "Target" },
  wiPnl: { th: "กำไร/ขาดทุน", en: "Your P/L" },
  wiDrawdown: { th: "ความเสี่ยง", en: "Risk" },
  wiAction: { th: "สิ่งที่ควรทำ", en: "Suggested Action" },
  wiAlternative: { th: "แผนสำรอง", en: "Alternative" },
  wiDetails: { th: "ดูรายละเอียด", en: "Details" },
  loadingWhatif: { th: "กำลังเตรียมสถานการณ์…", en: "Preparing scenarios…" },

  // scenario names
  sc_cpi_hot: { th: "CPI สูงกว่าคาด", en: "CPI hotter than expected" },
  sc_cpi_cool: { th: "CPI ต่ำกว่าคาด", en: "CPI cooler than expected" },
  sc_fed_hawkish: { th: "Fed สาย Hawkish", en: "Fed turns hawkish" },
  sc_fed_dovish: { th: "Fed สาย Dovish", en: "Fed turns dovish" },
  sc_dxy_up: { th: "DXY แข็งค่า +1%", en: "DXY strengthens +1%" },
  sc_yield_spike: { th: "บอนด์ยีลด์ 10 ปีพุ่ง", en: "US10Y yield spikes" },
  sc_geopolitics: { th: "ความเสี่ยงภูมิรัฐศาสตร์/สงคราม", en: "Geopolitical / war risk" },
  sc_break_resistance: { th: "ทองเบรกแนวต้าน", en: "Gold breaks resistance" },
  sc_break_support: { th: "ทองหลุดแนวรับ", en: "Gold breaks support" },

  // risk management page
  riskTitle: { th: "ผู้ช่วยจัดการความเสี่ยง", en: "Risk Management Assistant" },
  riskSubtitle: {
    th: "คำนวณขนาดล็อต ความเสี่ยง และมาร์จิ้นสำหรับ XAUUSD",
    en: "Position sizing, risk & margin for XAUUSD",
  },
  rmInputs: { th: "ข้อมูลนำเข้า", en: "Inputs" },
  rmBalance: { th: "ทุนในบัญชี (USD)", en: "Account Balance (USD)" },
  rmRiskPct: { th: "ความเสี่ยงต่อไม้ (%)", en: "Risk per Trade (%)" },
  rmLeverage: { th: "เลเวอเรจ", en: "Leverage" },
  rmDirection: { th: "ทิศทาง", en: "Direction" },
  rmBuy: { th: "ซื้อ (Buy)", en: "Buy" },
  rmSell: { th: "ขาย (Sell)", en: "Sell" },
  rmEntry: { th: "ราคาเข้า", en: "Entry Price" },
  rmStop: { th: "ราคา Stop Loss", en: "Stop Loss" },
  rmUseLive: { th: "ใช้ราคาล่าสุด", en: "Use live price" },
  rmResults: { th: "ผลการคำนวณ", en: "Results" },
  rmLotSize: { th: "ขนาดล็อตแนะนำ", en: "Recommended Lot Size" },
  rmRiskAmount: { th: "เงินที่เสี่ยง", en: "Risk Amount" },
  rmSlDistance: { th: "ระยะ SL", en: "SL Distance" },
  rmPotentialLoss: { th: "ขาดทุนหากชน SL", en: "Loss if SL hit" },
  rmNotional: { th: "มูลค่าสถานะ", en: "Position Value" },
  rmMargin: { th: "มาร์จิ้นที่ใช้", en: "Required Margin" },
  rmMarginPct: { th: "มาร์จิ้น % ของทุน", en: "Margin % of balance" },
  rmTakeProfit: { th: "เป้าทำกำไร (RR)", en: "Take Profit (RR)" },
  rmReward: { th: "กำไร", en: "Reward" },
  rmRiskLevel: { th: "ระดับความเสี่ยงของไม้นี้", en: "Trade Risk Level" },
  rmVolAdj: { th: "ปรับตามความผันผวน (ATR)", en: "Volatility Adjustment (ATR)" },
  rmAtrToday: { th: "ATR วันนี้", en: "ATR Today" },
  rmRecommendedSl: { th: "ระยะ SL แนะนำ", en: "Suggested SL distance" },
  rmRecommendedLots: { th: "ล็อตที่ปรับแล้ว", en: "Adjusted lot size" },
  rmTooTight: {
    th: "⚠ SL แคบกว่า ATR หนึ่งช่วง อาจโดนกวาดง่าย",
    en: "⚠ SL is tighter than one ATR — prone to noise stop-outs",
  },
  rmPortfolio: { th: "ความร้อนพอร์ต (Portfolio Heat)", en: "Portfolio Heat" },
  rmOpenTrades: { th: "จำนวนไม้ที่เปิดพร้อมกัน", en: "Concurrent open trades" },
  rmTotalHeat: { th: "ความเสี่ยงรวม", en: "Total risk at once" },
  rmNewsWarn: {
    th: "⚠ ข่าวแรงใกล้ออกภายใน 30 นาที — แนะนำงดเปิดไม้ใหม่หรือลดความเสี่ยง",
    en: "⚠ High-impact news within 30 min — avoid new trades or cut risk",
  },
  riskLow: { th: "ต่ำ", en: "Low" },
  riskMedium: { th: "ปานกลาง", en: "Medium" },
  riskHigh: { th: "สูง", en: "High" },
  riskExtreme: { th: "สูงมาก", en: "Extreme" },
  riskDoNotTrade: { th: "ไม่ควรเทรด", en: "Do Not Trade" },

  // correlation page
  corrTitle: { th: "Intermarket Correlation", en: "Intermarket Correlation" },
  corrSubtitle: {
    th: "ความสัมพันธ์ของสินทรัพย์อื่นกับราคาทองคำ",
    en: "How related markets line up with gold",
  },
  goldSupportScore: { th: "คะแนนสนับสนุนทองคำ", en: "Gold Support Score" },
  supportiveFactors: { th: "ปัจจัยหนุนทอง", en: "Supportive Factors" },
  pressureFactors: { th: "ปัจจัยกดดันทอง", en: "Pressure Factors" },
  divergenceAlert: { th: "สัญญาณขัดแย้ง", en: "Divergence Alert" },
  correlationCol: { th: "ความสัมพันธ์", en: "Correlation" },
  changeCol: { th: "เปลี่ยนแปลง", en: "Change" },
  instrumentCol: { th: "สินทรัพย์", en: "Instrument" },
  supportive: { th: "หนุน", en: "Supportive" },
  pressure_: { th: "กดดัน", en: "Pressure" },
  neutralImpact: { th: "เป็นกลาง", en: "Neutral" },
  loadingCorr: { th: "กำลังคำนวณความสัมพันธ์…", en: "Computing correlations…" },
  corrError: { th: "ไม่สามารถโหลดข้อมูลได้ ลองใหม่อีกครั้ง", en: "Could not load data. Please retry." },
  goldVs: { th: "ทองคำวันนี้", en: "Gold today" },
  noDivergence: { th: "ไม่พบสัญญาณขัดแย้ง", en: "No divergences detected" },

  // smc page
  smcTitle: { th: "Smart Money Concept", en: "Smart Money Concept" },
  smcSubtitle: {
    th: "โครงสร้างราคา ออเดอร์บล็อก และสภาพคล่องของ XAUUSD",
    en: "XAUUSD market structure, order blocks & liquidity",
  },
  smcBias: { th: "มุมมอง SMC", en: "SMC Bias" },
  premiumDiscount: { th: "พรีเมียม / ดิสเคานต์", en: "Premium / Discount" },
  premium: { th: "พรีเมียม", en: "Premium" },
  discount: { th: "ดิสเคานต์", en: "Discount" },
  equilibrium: { th: "สมดุล", en: "Equilibrium" },
  keyOrderBlock: { th: "ออเดอร์บล็อกสำคัญ", en: "Key Order Block" },
  liquidityTarget: { th: "เป้าสภาพคล่อง", en: "Liquidity Target" },
  invalidationZone: { th: "จุดที่มุมมองผิด", en: "Invalidation" },
  possibleSweep: { th: "โซนกวาดสภาพคล่อง", en: "Possible Sweep" },
  orderBlocks: { th: "ออเดอร์บล็อก", en: "Order Blocks" },
  fairValueGaps: { th: "Fair Value Gaps", en: "Fair Value Gaps" },
  liquidityPools: { th: "โซนสภาพคล่อง", en: "Liquidity Pools" },
  structureEvents: { th: "เหตุการณ์โครงสร้าง", en: "Structure Events" },
  buyside: { th: "ฝั่งซื้อ (บน)", en: "Buy-side" },
  sellside: { th: "ฝั่งขาย (ล่าง)", en: "Sell-side" },
  bullishZone: { th: "ขาขึ้น", en: "Bullish" },
  bearishZone: { th: "ขาลง", en: "Bearish" },
  mitigated: { th: "ถูกใช้แล้ว", en: "Mitigated" },
  active: { th: "ยังใช้งานได้", en: "Active" },
  filled: { th: "เติมแล้ว", en: "Filled" },
  open_: { th: "ยังเปิด", en: "Open" },
  swept: { th: "ถูกกวาดแล้ว", en: "Swept" },
  resting: { th: "ยังคงอยู่", en: "Resting" },
  loadingSmc: { th: "กำลังวิเคราะห์โครงสร้าง…", en: "Analyzing structure…" },
  smcError: { th: "ไม่สามารถโหลดข้อมูลได้ ลองใหม่อีกครั้ง", en: "Could not load data. Please retry." },
  zoneLabel: { th: "โซน", en: "Zone" },
  noneYet: { th: "ยังไม่พบ", en: "None detected" },

  // support & resistance page
  srTitle: { th: "แนวรับและแนวต้าน", en: "Support & Resistance" },
  srSubtitle: {
    th: "แนวรับแนวต้านของ XAUUSD จากหลายแหล่งรวมกัน",
    en: "Multi-source XAUUSD support & resistance levels",
  },
  resistance: { th: "แนวต้าน", en: "Resistance" },
  support: { th: "แนวรับ", en: "Support" },
  currentPrice: { th: "ราคาปัจจุบัน", en: "Current Price" },
  keyLevelTitle: { th: "แนวที่สำคัญที่สุด", en: "Key Level" },
  strength: { th: "ความแข็งแกร่ง", en: "Strength" },
  confluence: { th: "จุดบรรจบ", en: "Confluence" },
  loadingSr: { th: "กำลังคำนวณแนวรับแนวต้าน…", en: "Computing levels…" },
  srError: { th: "ไม่สามารถโหลดข้อมูลได้ ลองใหม่อีกครั้ง", en: "Could not load data. Please retry." },
  awayShort: { th: "ห่าง", en: "away" },

  // chat
  chatTitle: { th: "AI Copilot", en: "AI Copilot" },
  chatSubtitle: {
    th: "ถามตอบกับ AI โดยอ้างอิงข้อมูลตลาดและทุกไทม์เฟรมแบบเรียลไทม์",
    en: "Ask the AI, grounded in the live market & multi-timeframe data",
  },
  chatPlaceholder: { th: "พิมพ์คำถามเกี่ยวกับทองคำ…", en: "Ask about gold…" },
  chatSend: { th: "ส่ง", en: "Send" },
  chatThinking: { th: "กำลังคิด…", en: "Thinking…" },
  chatError: { th: "ขออภัย ตอบไม่ได้ในตอนนี้ ลองใหม่อีกครั้ง", en: "Sorry, couldn't answer right now. Please try again." },
  chatEmptyTitle: { th: "เริ่มถาม AI Copilot", en: "Ask the AI Copilot" },
  chatEmptyHint: {
    th: "ลองเลือกคำถามด้านล่าง หรือพิมพ์คำถามของคุณเอง",
    en: "Pick a suggested question below, or type your own.",
  },
  chatYou: { th: "คุณ", en: "You" },
  chatAi: { th: "AI Copilot", en: "AI Copilot" },
  chatSuggest1: { th: "วันนี้ทองควร Buy หรือ Sell?", en: "Should I buy or sell gold today?" },
  chatSuggest2: { th: "ทำไม AI ถึงแนะนำแบบนี้?", en: "Why is the AI recommending this?" },
  chatSuggest3: { th: "ภาพรวมหลายไทม์เฟรมเป็นอย่างไร?", en: "What's the multi-timeframe picture?" },
  chatSuggest4: { th: "ข่าวถัดไปเสี่ยงกับทองยังไง?", en: "How risky is the next news event for gold?" },

  // technical intelligence page
  techTitle: { th: "เทคนิคอลอินเทลลิเจนซ์", en: "Technical Intelligence" },
  techSubtitle: {
    th: "รวมอินดิเคเตอร์และคะแนนทางเทคนิคของ XAUUSD ในไทม์เฟรมที่เลือก",
    en: "Full indicator suite & technical score for XAUUSD on the selected timeframe",
  },
  technicalScoreLabel: { th: "คะแนนเทคนิคอล", en: "Technical Score" },
  trendScoreLabel: { th: "คะแนนแนวโน้ม", en: "Trend Score" },
  momentumScoreLabel: { th: "คะแนนโมเมนตัม", en: "Momentum Score" },
  volatilityScoreLabel: { th: "คะแนนความผันผวน", en: "Volatility Score" },
  reversalRiskLabel: { th: "ความเสี่ยงกลับตัว", en: "Reversal Risk" },
  breakoutProbLabel: { th: "โอกาสเบรกเอาต์", en: "Breakout Prob." },
  catTrend: { th: "แนวโน้ม (Trend)", en: "Trend" },
  catMomentum: { th: "โมเมนตัม (Momentum)", en: "Momentum" },
  catVolatility: { th: "ความผันผวน (Volatility)", en: "Volatility" },
  catLevels: { th: "แนวรับแนวต้าน (Levels)", en: "Levels" },
  selectTimeframe: { th: "เลือกไทม์เฟรม", en: "Timeframe" },
  loadingTech: { th: "กำลังคำนวณอินดิเคเตอร์…", en: "Computing indicators…" },
  techError: { th: "ไม่สามารถโหลดข้อมูลได้ ลองใหม่อีกครั้ง", en: "Could not load data. Please retry." },
  sigBull: { th: "ขาขึ้น", en: "Bullish" },
  sigBear: { th: "ขาลง", en: "Bearish" },
  sigNeutral: { th: "เป็นกลาง", en: "Neutral" },

  // multi-timeframe page
  mtfTitle: { th: "วิเคราะห์หลายไทม์เฟรม", en: "Multi-Timeframe Analysis" },
  mtfSubtitle: {
    th: "แนวโน้มและสัญญาณทางเทคนิคของ XAUUSD ในทุกไทม์เฟรม",
    en: "XAUUSD trend & technical signals across every timeframe",
  },
  overallBias: { th: "มุมมองโดยรวม", en: "Overall Bias" },
  bullishTfs: { th: "ขาขึ้น", en: "Bullish" },
  bearishTfs: { th: "ขาลง", en: "Bearish" },
  neutralTfs: { th: "เป็นกลาง", en: "Neutral" },
  loadingMtf: { th: "กำลังคำนวณอินดิเคเตอร์ทุกไทม์เฟรม…", en: "Computing indicators across timeframes…" },
  mtfError: { th: "ไม่สามารถโหลดข้อมูลได้ ลองใหม่อีกครั้ง", en: "Could not load data. Please retry." },

  // matrix column headers
  colTimeframe: { th: "ไทม์เฟรม", en: "TF" },
  colTrend: { th: "แนวโน้ม", en: "Trend" },
  colEma: { th: "EMA", en: "EMA" },
  colRsi: { th: "RSI", en: "RSI" },
  colMacd: { th: "MACD", en: "MACD" },
  colAdx: { th: "ADX", en: "ADX" },
  colAtr: { th: "ATR", en: "ATR" },
  colStructure: { th: "โครงสร้าง", en: "Structure" },
  colSignal: { th: "สัญญาณ", en: "Signal" },
  colConfidence: { th: "เชื่อมั่น", en: "Conf." },
  naShort: { th: "ไม่มีข้อมูล", en: "N/A" },

  // economic calendar page
  navCalendar: { th: "ปฏิทินข่าว", en: "Calendar" },
  calendarTitle: { th: "ปฏิทินข่าวเศรษฐกิจ", en: "Economic Calendar" },
  calendarSubtitle: {
    th: "ข่าวสำคัญที่มีผลต่อทองคำ พร้อม AI วิเคราะห์ผลกระทบ",
    en: "Key events impacting gold, with AI impact analysis",
  },
  calNextEvent: { th: "ข่าวถัดไป", en: "Next Event" },
  calThisWeek: { th: "สัปดาห์นี้", en: "This Week" },
  calNextWeek: { th: "สัปดาห์หน้า", en: "Next Week" },
  calHighOnly: { th: "แรงเท่านั้น", en: "High Impact Only" },
  calAllEvents: { th: "ทั้งหมด", en: "All Events" },
  calForecast: { th: "คาดการณ์", en: "Forecast" },
  calPrevious: { th: "ก่อนหน้า", en: "Previous" },
  calActual: { th: "ผลจริง", en: "Actual" },
  calAiAnalysis: { th: "AI วิเคราะห์ผลต่อทอง", en: "AI: Gold Impact" },
  calGoldRelevance: { th: "ผลต่อทอง", en: "Gold" },
  calPast: { th: "ผ่านไปแล้ว", en: "Past" },
  calNoEvents: { th: "ไม่มีข่าวสำคัญในสัปดาห์นี้", en: "No major events this week" },
  loadingCalendar: { th: "กำลังโหลดปฏิทิน…", en: "Loading calendar…" },
  calCountdown: { th: "อีก", en: "in" },
  calCountdownPast: { th: "ผ่านไปแล้ว", en: "ago" },
  hub_calendar: { th: "ปฏิทินข่าวเศรษฐกิจ + AI วิเคราะห์ผลต่อทอง", en: "Economic calendar + AI gold impact" },

  // trade journal page
  navJournal: { th: "Journal", en: "Journal" },
  journalTitle: { th: "Trade Journal", en: "Trade Journal" },
  journalSubtitle: {
    th: "บันทึกและวิเคราะห์ผลการเทรดของคุณ",
    en: "Log and analyze your personal trade history",
  },
  journalAddTrade: { th: "บันทึกไม้ใหม่", en: "Log Trade" },
  journalWinRate: { th: "อัตราชนะ", en: "Win Rate" },
  journalTotalPnL: { th: "กำไร/ขาดทุนรวม", en: "Total P&L" },
  journalAvgRR: { th: "RR เฉลี่ย", en: "Avg R:R" },
  journalProfitFactor: { th: "Profit Factor", en: "Profit Factor" },
  journalEquityCurve: { th: "กราฟกำไรสะสม", en: "Equity Curve" },
  journalNoTrades: {
    th: "ยังไม่มีไม้ที่บันทึก กด 'บันทึกไม้ใหม่' เพื่อเริ่ม",
    en: "No trades logged yet. Click 'Log Trade' to start.",
  },
  journalExport: { th: "Export CSV", en: "Export CSV" },
  journalDate: { th: "วันที่", en: "Date" },
  journalDir: { th: "ทิศ", en: "Dir" },
  journalEntry: { th: "เข้า", en: "Entry" },
  journalExit: { th: "ออก", en: "Exit" },
  journalSL: { th: "SL", en: "SL" },
  journalTP: { th: "TP", en: "TP" },
  journalLots: { th: "ล็อต", en: "Lots" },
  journalPnL: { th: "P&L ($)", en: "P&L ($)" },
  journalRR: { th: "R:R", en: "R:R" },
  journalSetup: { th: "Setup", en: "Setup" },
  journalResult: { th: "ผล", en: "Result" },
  journalNotes: { th: "หมายเหตุ", en: "Notes" },
  journalBestTrade: { th: "ไม้ดีสุด", en: "Best Trade" },
  journalWorstTrade: { th: "ไม้แย่สุด", en: "Worst Trade" },
  journalTotalTrades: { th: "จำนวนไม้", en: "Trades" },
  journalBuy: { th: "ซื้อ", en: "Buy" },
  journalSell: { th: "ขาย", en: "Sell" },
  journalWin: { th: "ชนะ", en: "Win" },
  journalLoss: { th: "แพ้", en: "Loss" },
  journalBreakeven: { th: "เสมอ", en: "B/E" },
  journalRunning: { th: "กำลังเปิด", en: "Running" },
  journalOpenTime: { th: "เวลาเปิด", en: "Open Time" },
  journalCloseTime: { th: "เวลาปิด", en: "Close Time" },
  journalDelete: { th: "ลบ", en: "Del" },
  journalConfirmDelete: { th: "ลบไม้นี้?", en: "Delete this trade?" },
  journalMaxDD: { th: "Max Drawdown", en: "Max DD" },
  hub_journal: { th: "บันทึกการเทรดและวิเคราะห์ผลงาน", en: "Log trades & analyze performance" },

  // EA builder page
  navEaBuilder: { th: "EA Builder", en: "EA Builder" },
  hub_ea_builder: { th: "สร้าง MQL4/5 EA จาก indicator ที่เลือก", en: "Generate MQL4/5 EA from your chosen indicators" },

  // Backtester page
  navBacktest: { th: "Backtester", en: "Backtester" },
  hub_backtest: { th: "ทดสอบ strategy บนข้อมูลจริง XAUUSD ย้อนหลัง", en: "Test strategies on real XAUUSD historical data" },
  navBrief:    { th: "AI Daily Brief",   en: "AI Daily Brief"  },
  hub_brief:   { th: "รายงานตลาดทองคำประจำวัน สร้างโดย Gemini AI", en: "AI-generated daily gold market report" },
  navScanner:      { th: "Signal Scanner",    en: "Signal Scanner"    },
  hub_scanner:     { th: "สแกน 12 indicators × 6 Timeframes แบบ heatmap", en: "12 indicators × 6 TFs live heatmap" },
  navSeasonality:  { th: "Gold Seasonality",  en: "Gold Seasonality"  },
  hub_seasonality: { th: "pattern รายเดือน รายวัน และรายปีจากข้อมูล 12 ปี", en: "Monthly/weekday/annual patterns — 12 yr data" },
  navPaper:        { th: "Paper Trader",       en: "Paper Trader"       },
  hub_paper:       { th: "ฝึกเทรด virtual ไม่ใช้เงินจริง บัญชีเริ่มต้น $10,000", en: "Virtual trading — $10,000 demo account, live P&L" },
  navNews:         { th: "Gold News",          en: "Gold News"          },
  navCalculator:   { th: "คำนวณ Lot Size",     en: "Lot Calculator"     },
  navPriceAlerts:  { th: "Price Alerts",       en: "Price Alerts"       },
  navMarkets:      { th: "Markets",            en: "Markets"            },
  navSignalLog:    { th: "Signal Log",         en: "Signal Log"         },
  navHeatmap:      { th: "Volatility Heatmap", en: "Volatility Heatmap" },
  navMt5:          { th: "MT5 Bridge",         en: "MT5 Bridge"         },
  navEconCalendar: { th: "Economic Calendar",  en: "Economic Calendar"  },
  navPerformance:  { th: "Performance",        en: "Performance"        },
  navIntermarket:  { th: "Intermarket",        en: "Intermarket"        },
  navMultiScanner: { th: "Multi-Symbol Scan",   en: "Multi-Symbol Scan"  },
  navAiEa:         { th: "AI EA Optimizer",     en: "AI EA Optimizer"    },
  navSrIndicator:  { th: "S/R Indicator",       en: "S/R Indicator"      },
  navCmeOi:        { th: "CME Open Interest",   en: "CME Open Interest"  },
  navEaMonitor:    { th: "EA Monitor",           en: "EA Monitor"         },
  navAiModel:        { th: "AI Model Training",   en: "AI Model Training"   },
  navAiModelHistory: { th: "AI Signal History",   en: "AI Signal History"   },
  navTradeIdeas:     { th: "Trade Ideas (AI)",    en: "Trade Ideas (AI)"    },
  navMarketRegime:   { th: "Market Regime",       en: "Market Regime"       },
  navForecast:       { th: "Gold Forecast",       en: "Gold Forecast"       },
  navPatterns:       { th: "Price Action Patterns", en: "Price Action Patterns" },
  navSessions:       { th: "Session Analysis",      en: "Session Analysis"      },
  navVolatility:     { th: "Volatility Dashboard",  en: "Volatility Dashboard"  },
  navSeasonality2:   { th: "Seasonality 10Y",       en: "Seasonality 10Y"       },
  navFibonacci:      { th: "Fibonacci Auto-Draw",   en: "Fibonacci Auto-Draw"   },
  navEconImpact:     { th: "Economic Impact",       en: "Economic Impact"       },
  navMomentum:       { th: "Momentum Tracker",     en: "Momentum Tracker"      },
  navTrendStrength:  { th: "Trend Strength (ADX)", en: "Trend Strength (ADX)"  },
  navNewsSentiment:  { th: "News Sentiment",       en: "News Sentiment"        },
  navPivots:         { th: "Pivot Points",          en: "Pivot Points"          },
  navDxyCorrelation: { th: "DXY Correlation",       en: "DXY Correlation"       },
  navFearGreed:      { th: "Fear & Greed Index",   en: "Fear & Greed Index"    },
  navMarketSummary:  { th: "Market Summary",       en: "Market Summary"        },
  navSupplyDemand:   { th: "Supply & Demand",      en: "Supply & Demand"       },
  navRoc:                  { th: "Rate of Change (ROC)",  en: "Rate of Change (ROC)"   },
  navIntermarketHeatmap:   { th: "Intermarket Heatmap",  en: "Intermarket Heatmap"    },
  navScalpLevels:          { th: "Intraday Scalp Levels", en: "Intraday Scalp Levels"  },
  navMacroScore:           { th: "Macro Score Card",      en: "Macro Score Card"       },
  navRangeForecast:        { th: "Range Forecast",        en: "Range Forecast"         },
  navOptionsFlow:          { th: "Options Flow & IV",     en: "Options Flow & IV"      },
  navWeeklyBrief:          { th: "Weekly Gold Brief",     en: "Weekly Gold Brief"      },
  navCot:          { th: "COT Report",         en: "COT Report"         },
  navBroadcast:    { th: "Broadcast Settings", en: "Broadcast Settings" },
  hub_news:        { th: "AI วิเคราะห์ sentiment ข่าวทองคำ real-time", en: "AI gold news sentiment — real-time analysis" },

  // shared error / loading
  loadingError: { th: "โหลดข้อมูลไม่ได้ ลองใหม่อีกครั้ง", en: "Failed to load. Please try again." },

  // calendar timezone selector
  calTimezone: { th: "เขตเวลา", en: "Timezone" },

  // journal — edit & pagination
  journalEditTrade: { th: "แก้ไขไม้", en: "Edit Trade" },
  journalUpdate: { th: "บันทึกการแก้ไข", en: "Update" },
  journalPrev: { th: "← ก่อนหน้า", en: "← Prev" },
  journalNext: { th: "ถัดไป →", en: "Next →" },
  journalPageOf: { th: "หน้า {p} / {t}", en: "Page {p} of {t}" },

  // alerts — webhook
  alWebhookTitle: { th: "Webhook / Telegram Bot", en: "Webhook / Telegram Bot" },
  alWebhookUrl: { th: "Webhook URL", en: "Webhook URL" },
  alWebhookSave: { th: "บันทึก", en: "Save" },
  alWebhookTest: { th: "ทดสอบ", en: "Test" },
  alWebhookNote: { th: "เมื่อแจ้งเตือนทริกเกอร์ จะส่ง POST (JSON) ไปที่ URL นี้ — ใช้กับ Telegram Bot, Make.com หรือ Zapier ได้", en: "When an alert fires, a JSON POST is sent to this URL — works with Telegram Bot, Make.com, or Zapier." },
  alWebhookActive: { th: "✓ Webhook เปิดใช้งาน", en: "✓ Webhook active" },
  alWebhookSaved: { th: "บันทึกแล้ว ✓", en: "Saved ✓" },

  // backtest — timeframe
  btTimeframe: { th: "ไทม์เฟรม", en: "Timeframe" },

  // Telegram Bot (alerts)
  alTelegramTitle: { th: "Telegram Bot", en: "Telegram Bot" },
  alTelegramToken: { th: "Bot Token", en: "Bot Token" },
  alTelegramChatId: { th: "Chat ID", en: "Chat ID" },
  alTelegramNote: { th: "สร้าง Bot จาก @BotFather → รับ Token · ส่งข้อความหา Bot → /getMe เพื่อรับ Chat ID หรือใช้ @userinfobot", en: "Create a bot via @BotFather → get Token · Message the bot then use @userinfobot to get your Chat ID" },
  alTelegramActive: { th: "✓ Telegram เปิดใช้งาน", en: "✓ Telegram active" },
  alTelegramSaved: { th: "บันทึกแล้ว ✓", en: "Saved ✓" },

  // Journal AI Review
  journalAiBtn: { th: "AI วิเคราะห์ผลการเทรด", en: "AI Journal Review" },
  journalAiLoading: { th: "Gemini กำลังวิเคราะห์รูปแบบการเทรดของคุณ…", en: "Gemini is analysing your trading patterns…" },
  journalAiRating: { th: "คะแนนรวม", en: "Overall Score" },
  journalAiStrengths: { th: "จุดแข็ง", en: "Strengths" },
  journalAiWeaknesses: { th: "จุดที่ต้องปรับ", en: "Areas to Improve" },
  journalAiRecs: { th: "คำแนะนำ", en: "Recommendations" },
  journalAiBestSetup: { th: "Setup ที่ดีที่สุด", en: "Best Setup" },
  journalAiNoData: { th: "ต้องมีอย่างน้อย 5 ไม้ที่ปิดแล้วเพื่อวิเคราะห์", en: "Need at least 5 closed trades to analyse" },
  journalAiError: { th: "วิเคราะห์ไม่ได้ ลองอีกครั้ง", en: "Analysis failed. Please try again." },
  journalAiRefresh: { th: "วิเคราะห์ใหม่", en: "Re-analyse" },

  // MT5 Bridge (portfolio)
  pfMT5Title: { th: "MT5 Bridge", en: "MT5 Bridge" },
  pfMT5Connected: { th: "✓ เชื่อมต่อ MT5 แล้ว", en: "✓ MT5 connected" },
  pfMT5Disconnected: { th: "ยังไม่ได้เชื่อมต่อ MT5 — แสดงข้อมูลจำลอง", en: "MT5 not connected — showing simulated data" },
  pfMT5LastSync: { th: "ซิงค์ล่าสุด", en: "Last sync" },
  pfMT5HowTo: { th: "วิธีเชื่อมต่อ", en: "How to connect" },
  pfMT5ApiKey: { th: "API Key", en: "API Key" },
  pfMT5Endpoint: { th: "Endpoint", en: "Endpoint" },

  // EA Builder presets
  eaPresets: { th: "Presets ที่บันทึกไว้", en: "Saved Presets" },
  eaSavePreset: { th: "บันทึก Preset", en: "Save Preset" },
  eaLoadPreset: { th: "โหลด", en: "Load" },
  eaDeletePreset: { th: "ลบ", en: "Delete" },
  eaPresetName: { th: "ชื่อ Preset", en: "Preset name" },
  eaNoPresets: { th: "ยังไม่มี Preset — กด 'บันทึก Preset' เพื่อบันทึกการตั้งค่าปัจจุบัน", en: "No presets yet — click 'Save Preset' to save current config" },
  eaPresetSaved: { th: "บันทึกแล้ว ✓", en: "Saved ✓" },
};

const CONDITION_LABELS: Record<string, Bilingual> = {
  strong_bullish: { th: "ขาขึ้นแรง", en: "Strong Bullish" },
  bullish: { th: "ขาขึ้น", en: "Bullish" },
  sideway: { th: "ออกข้าง", en: "Sideway" },
  bearish: { th: "ขาลง", en: "Bearish" },
  strong_bearish: { th: "ขาลงแรง", en: "Strong Bearish" },
  high_volatility: { th: "ผันผวนสูง", en: "High Volatility" },
  low_liquidity: { th: "สภาพคล่องต่ำ", en: "Low Liquidity" },
};

const RECOMMENDATION_LABELS: Record<string, Bilingual> = {
  strong_buy: { th: "ซื้อแรง", en: "Strong Buy" },
  buy: { th: "ซื้อ", en: "Buy" },
  buy_on_pullback: { th: "รอย่อแล้วซื้อ", en: "Buy on Pullback" },
  wait: { th: "รอดู", en: "Wait" },
  sell_on_rally: { th: "รอเด้งแล้วขาย", en: "Sell on Rally" },
  sell: { th: "ขาย", en: "Sell" },
  strong_sell: { th: "ขายแรง", en: "Strong Sell" },
  no_trade: { th: "งดเทรด", en: "No Trade" },
  high_news_risk: { th: "เสี่ยงข่าวสูง", en: "High News Risk" },
};

const RISK_LABELS: Record<string, Bilingual> = {
  low: { th: "ต่ำ", en: "Low" },
  medium: { th: "ปานกลาง", en: "Medium" },
  high: { th: "สูง", en: "High" },
  extreme: { th: "สูงมาก", en: "Extreme" },
};

const VOLATILITY_LABELS: Record<string, Bilingual> = {
  low: { th: "ต่ำ", en: "Low" },
  normal: { th: "ปกติ", en: "Normal" },
  elevated: { th: "สูงขึ้น", en: "Elevated" },
  extreme: { th: "สูงมาก", en: "Extreme" },
};

// Risk-management labels (includes do_not_trade).
const RM_RISK_LABELS: Record<string, Bilingual> = {
  low: { th: "ต่ำ", en: "Low" },
  medium: { th: "ปานกลาง", en: "Medium" },
  high: { th: "สูง", en: "High" },
  extreme: { th: "สูงมาก", en: "Extreme" },
  do_not_trade: { th: "ไม่ควรเทรด", en: "Do Not Trade" },
};

// Intermarket instrument labels.
const INSTRUMENT_LABELS: Record<string, Bilingual> = {
  ins_dxy: { th: "DXY (ดัชนีดอลลาร์)", en: "DXY (Dollar Index)" },
  ins_us10y: { th: "US10Y (บอนด์ยีลด์ 10 ปี)", en: "US 10Y Yield" },
  ins_us2y: { th: "US2Y (บอนด์ยีลด์ 2 ปี)", en: "US 2Y Yield" },
  ins_silver: { th: "Silver (เงิน)", en: "Silver" },
  ins_oil: { th: "Oil (น้ำมัน WTI)", en: "Oil (WTI)" },
  ins_btc: { th: "Bitcoin", en: "Bitcoin" },
  ins_nasdaq: { th: "Nasdaq", en: "Nasdaq" },
  ins_sp500: { th: "S&P 500", en: "S&P 500" },
  ins_vix: { th: "VIX (ดัชนีความกลัว)", en: "VIX" },
  ins_usdjpy: { th: "USD/JPY", en: "USD/JPY" },
  ins_eurusd: { th: "EUR/USD", en: "EUR/USD" },
};

// S/R source labels.
const SR_SOURCE_LABELS: Record<string, Bilingual> = {
  src_pivot: { th: "Pivot", en: "Pivot" },
  src_daily: { th: "รายวัน", en: "Daily H/L" },
  src_weekly: { th: "รายสัปดาห์", en: "Weekly H/L" },
  src_monthly: { th: "รายเดือน", en: "Monthly H/L" },
  src_fib: { th: "Fibonacci", en: "Fibonacci" },
  src_ema: { th: "EMA", en: "EMA" },
  src_donchian: { th: "Donchian", en: "Donchian" },
  src_swing: { th: "Swing/OB", en: "Swing/OB" },
  src_poc: { th: "Volume POC", en: "Volume POC" },
};

// Indicator display names (kept in English — standard trader terminology).
const INDICATOR_LABELS: Record<string, Bilingual> = {
  ind_ema20: { th: "EMA 20", en: "EMA 20" },
  ind_ema50: { th: "EMA 50", en: "EMA 50" },
  ind_ema100: { th: "EMA 100", en: "EMA 100" },
  ind_ema200: { th: "EMA 200", en: "EMA 200" },
  ind_sma20: { th: "SMA 20", en: "SMA 20" },
  ind_macd: { th: "MACD", en: "MACD" },
  ind_adx: { th: "ADX", en: "ADX" },
  ind_supertrend: { th: "SuperTrend", en: "SuperTrend" },
  ind_psar: { th: "Parabolic SAR", en: "Parabolic SAR" },
  ind_ichimoku: { th: "Ichimoku", en: "Ichimoku" },
  ind_vwap: { th: "VWAP", en: "VWAP" },
  ind_rsi: { th: "RSI", en: "RSI" },
  ind_stoch: { th: "Stochastic", en: "Stochastic" },
  ind_cci: { th: "CCI", en: "CCI" },
  ind_momentum: { th: "Momentum", en: "Momentum" },
  ind_roc: { th: "ROC", en: "ROC" },
  ind_bollinger: { th: "Bollinger Bands", en: "Bollinger Bands" },
  ind_atr: { th: "ATR", en: "ATR" },
  ind_keltner: { th: "Keltner Channel", en: "Keltner Channel" },
  ind_pivot: { th: "Pivot Point", en: "Pivot Point" },
  ind_donchian: { th: "Donchian Channel", en: "Donchian Channel" },
  ind_fib: { th: "Fibonacci", en: "Fibonacci" },
};

const TREND_LABELS: Record<string, Bilingual> = {
  bullish: { th: "ขาขึ้น", en: "Bullish" },
  bearish: { th: "ขาลง", en: "Bearish" },
  neutral: { th: "เป็นกลาง", en: "Neutral" },
};

const EMA_STATUS_LABELS: Record<string, Bilingual> = {
  strong_up: { th: "เรียงขึ้นแรง", en: "Strong Up" },
  up: { th: "เหนือ EMA", en: "Above" },
  mixed: { th: "ผสม", en: "Mixed" },
  down: { th: "ใต้ EMA", en: "Below" },
  strong_down: { th: "เรียงลงแรง", en: "Strong Down" },
  na: { th: "—", en: "—" },
};

const MACD_LABELS: Record<string, Bilingual> = {
  bull: { th: "ขาขึ้น", en: "Bull" },
  bear: { th: "ขาลง", en: "Bear" },
  neutral: { th: "กลาง", en: "Flat" },
};

const SESSION_LABELS: Record<string, Bilingual> = {
  sydney: { th: "ซิดนีย์", en: "Sydney" },
  tokyo: { th: "โตเกียว", en: "Tokyo" },
  london: { th: "ลอนดอน", en: "London" },
  newyork: { th: "นิวยอร์ก", en: "New York" },
  london_newyork_overlap: { th: "ลอนดอน + นิวยอร์ก", en: "London + New York" },
  closed: { th: "ตลาดปิด", en: "Closed" },
};

interface I18nContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  t: (key: keyof typeof DICT) => string;
  tb: (b: Bilingual | undefined) => string;
  condition: (k: string) => string;
  recommendation: (k: string) => string;
  risk: (k: string) => string;
  volatility: (k: string) => string;
  sessionName: (k: string) => string;
  trend: (k: string) => string;
  emaStatus: (k: string) => string;
  macdState: (k: string) => string;
  indicator: (k: string) => string;
  indSignal: (k: string) => string;
  srSource: (k: string) => string;
  instrument2: (k: string) => string;
  rmRisk: (k: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("th");

  // Restore persisted language on mount.
  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("gios.lang") : null;
    if (saved === "th" || saved === "en") setLangState(saved);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("gios.lang", l);
      document.documentElement.lang = l;
    }
  }, []);

  const toggle = useCallback(() => setLang(lang === "th" ? "en" : "th"), [lang, setLang]);

  const value = useMemo<I18nContextValue>(() => {
    const pick = (b: Bilingual | undefined) => (b ? b[lang] : "");
    const fromMap = (m: Record<string, Bilingual>, k: string) => (m[k] ? m[k][lang] : k);
    return {
      lang,
      setLang,
      toggle,
      t: (key) => pick(DICT[key as string]),
      tb: (b) => pick(b),
      condition: (k) => fromMap(CONDITION_LABELS, k),
      recommendation: (k) => fromMap(RECOMMENDATION_LABELS, k),
      risk: (k) => fromMap(RISK_LABELS, k),
      volatility: (k) => fromMap(VOLATILITY_LABELS, k),
      sessionName: (k) => fromMap(SESSION_LABELS, k),
      trend: (k) => fromMap(TREND_LABELS, k),
      emaStatus: (k) => fromMap(EMA_STATUS_LABELS, k),
      macdState: (k) => fromMap(MACD_LABELS, k),
      indicator: (k) => fromMap(INDICATOR_LABELS, k),
      indSignal: (k) => fromMap({ bull: DICT.sigBull, bear: DICT.sigBear, neutral: DICT.sigNeutral }, k),
      srSource: (k) => fromMap(SR_SOURCE_LABELS, k),
      instrument2: (k) => fromMap(INSTRUMENT_LABELS, k),
      rmRisk: (k) => fromMap(RM_RISK_LABELS, k),
    };
  }, [lang, setLang, toggle]);

  return createElement(I18nContext.Provider, { value }, children);
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within LanguageProvider");
  return ctx;
}
