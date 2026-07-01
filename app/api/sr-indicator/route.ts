import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// ── MQL5 Indicator (MetaTrader 5) ─────────────────────────────────────────────
function generateMT5(): string {
  return `//+------------------------------------------------------------------+
//|  GIOS_SR_Levels.mq5                                               |
//|  Auto Support & Resistance — Gold Intelligence OS                  |
//|  Algorithm: Multi-timeframe Swing High/Low + Pivot Points          |
//|  © EA Profit Lab                                                   |
//+------------------------------------------------------------------+
#property copyright   "EA Profit Lab / Gold Intelligence OS"
#property link        "https://gold-intelligence-os.vercel.app"
#property version     "2.00"
#property indicator_chart_window
#property indicator_plots 0

//--- Input Parameters
input ENUM_TIMEFRAMES InpMajorTF    = PERIOD_D1;   // Major Timeframe (Swing)
input ENUM_TIMEFRAMES InpMinorTF    = PERIOD_H4;   // Minor Timeframe (Short-term)
input int             InpSwingBars  = 5;            // Swing High/Low lookback bars
input int             InpMaxLevels  = 8;            // Max levels per side
input double          InpMergeZone  = 0.3;          // Merge zone (% of ATR)
input bool            InpShowPivot  = true;         // Show Daily Pivots
input bool            InpAlertOn    = true;         // Alert when price near level
input double          InpAlertPct   = 0.1;          // Alert distance (% of price)
input color           InpColorR     = clrCrimson;   // Resistance color
input color           InpColorS     = clrDodgerBlue;// Support color
input color           InpColorPivot = clrGoldenrod; // Pivot color
input int             InpLineWidth  = 2;            // Line width
input ENUM_LINE_STYLE InpLineStyle  = STYLE_SOLID;  // Line style

//--- Object prefix
#define PREFIX "GIOS_SR_"

//--- Last alert state
datetime lastAlertTime = 0;

//+------------------------------------------------------------------+
//| Indicator init                                                     |
//+------------------------------------------------------------------+
int OnInit() {
   EventSetTimer(300); // refresh every 5 min
   DrawLevels();
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Cleanup                                                            |
//+------------------------------------------------------------------+
void OnDeinit(const int reason) {
   EventKillTimer();
   DeleteAllObjects();
}

//+------------------------------------------------------------------+
//| Timer — redraw periodically                                        |
//+------------------------------------------------------------------+
void OnTimer() { DrawLevels(); }

//+------------------------------------------------------------------+
//| Main calculation                                                   |
//+------------------------------------------------------------------+
int OnCalculate(const int rates_total, const int prev_calculated,
                const datetime &time[], const double &open[],
                const double &high[], const double &low[], const double &close[],
                const long &tick_volume[], const long &volume[], const int &spread[]) {
   if (prev_calculated == 0) DrawLevels();
   if (InpAlertOn) CheckAlerts(close[rates_total - 1]);
   return rates_total;
}

//+------------------------------------------------------------------+
//| Check if price is near any SR level                                |
//+------------------------------------------------------------------+
void CheckAlerts(double price) {
   if (TimeCurrent() - lastAlertTime < 300) return; // throttle 5 min
   double threshold = price * InpAlertPct / 100.0;
   for (int i = ObjectsTotal(0, 0, OBJ_HLINE) - 1; i >= 0; i--) {
      string name = ObjectName(0, i, 0, OBJ_HLINE);
      if (StringFind(name, PREFIX) < 0) continue;
      double level = ObjectGetDouble(0, name, OBJPROP_PRICE);
      if (MathAbs(price - level) <= threshold) {
         string type = StringFind(name, "R") >= 0 ? "RESISTANCE" : "SUPPORT";
         Alert(Symbol(), " — Price approaching ", type, " at ", DoubleToString(level, Digits()));
         lastAlertTime = TimeCurrent();
         break;
      }
   }
}

//+------------------------------------------------------------------+
//| Delete all GIOS objects                                            |
//+------------------------------------------------------------------+
void DeleteAllObjects() {
   for (int i = ObjectsTotal(0, 0, OBJ_HLINE) - 1; i >= 0; i--) {
      string name = ObjectName(0, i, 0, OBJ_HLINE);
      if (StringFind(name, PREFIX) >= 0) ObjectDelete(0, name);
   }
   for (int i = ObjectsTotal(0, 0, OBJ_TEXT) - 1; i >= 0; i--) {
      string name = ObjectName(0, i, 0, OBJ_TEXT);
      if (StringFind(name, PREFIX) >= 0) ObjectDelete(0, name);
   }
}

//+------------------------------------------------------------------+
//| Draw a horizontal line with label                                  |
//+------------------------------------------------------------------+
void DrawHLine(string name, double price, color clr, string label) {
   if (!ObjectCreate(0, name, OBJ_HLINE, 0, 0, price)) {
      ObjectMove(0, name, 0, 0, price);
   }
   ObjectSetInteger(0, name, OBJPROP_COLOR,     clr);
   ObjectSetInteger(0, name, OBJPROP_WIDTH,     InpLineWidth);
   ObjectSetInteger(0, name, OBJPROP_STYLE,     InpLineStyle);
   ObjectSetInteger(0, name, OBJPROP_BACK,      true);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE,false);

   string tname = name + "_T";
   if (!ObjectCreate(0, tname, OBJ_TEXT, 0, iTime(Symbol(), PERIOD_CURRENT, 0), price)) {
      ObjectMove(0, tname, 0, iTime(Symbol(), PERIOD_CURRENT, 0), price);
   }
   ObjectSetString(0,  tname, OBJPROP_TEXT,      label + " " + DoubleToString(price, Digits()));
   ObjectSetInteger(0, tname, OBJPROP_COLOR,     clr);
   ObjectSetInteger(0, tname, OBJPROP_FONTSIZE,  8);
   ObjectSetInteger(0, tname, OBJPROP_SELECTABLE,false);
}

//+------------------------------------------------------------------+
//| Calculate ATR for merging nearby levels                            |
//+------------------------------------------------------------------+
double GetATR(ENUM_TIMEFRAMES tf, int period = 14) {
   double atrBuf[];
   int handle = iATR(Symbol(), tf, period);
   if (handle == INVALID_HANDLE) return 0;
   if (CopyBuffer(handle, 0, 0, 1, atrBuf) <= 0) return 0;
   IndicatorRelease(handle);
   return atrBuf[0];
}

//+------------------------------------------------------------------+
//| Merge levels that are within zone distance                         |
//+------------------------------------------------------------------+
void MergeLevels(double &levels[], int &count) {
   double atr = GetATR(PERIOD_D1);
   double zone = atr * InpMergeZone;
   for (int i = 0; i < count - 1; i++) {
      for (int j = i + 1; j < count; j++) {
         if (MathAbs(levels[i] - levels[j]) < zone) {
            levels[i] = (levels[i] + levels[j]) / 2.0; // average
            for (int k = j; k < count - 1; k++) levels[k] = levels[k + 1];
            count--;
            j--;
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Find swing levels on a timeframe                                   |
//+------------------------------------------------------------------+
void FindSwingLevels(ENUM_TIMEFRAMES tf, double &resistance[], int &rCount,
                                         double &support[],   int &sCount) {
   int bars = 100;
   double highs[], lows[];
   ArrayResize(highs, bars);
   ArrayResize(lows,  bars);
   if (CopyHigh(Symbol(), tf, 0, bars, highs) <= 0) return;
   if (CopyLow (Symbol(), tf, 0, bars, lows)  <= 0) return;

   double curPrice = iClose(Symbol(), PERIOD_CURRENT, 0);
   int n = InpSwingBars;

   for (int i = n; i < bars - n; i++) {
      // Swing High
      bool isHigh = true;
      for (int k = 1; k <= n; k++) {
         if (highs[i] <= highs[i - k] || highs[i] <= highs[i + k]) { isHigh = false; break; }
      }
      if (isHigh && highs[i] > curPrice && rCount < InpMaxLevels) {
         resistance[rCount++] = highs[i];
      }
      // Swing Low
      bool isLow = true;
      for (int k = 1; k <= n; k++) {
         if (lows[i] >= lows[i - k] || lows[i] >= lows[i + k]) { isLow = false; break; }
      }
      if (isLow && lows[i] < curPrice && sCount < InpMaxLevels) {
         support[sCount++] = lows[i];
      }
   }
}

//+------------------------------------------------------------------+
//| Main drawing function                                              |
//+------------------------------------------------------------------+
void DrawLevels() {
   DeleteAllObjects();
   double resistance[], support[];
   ArrayResize(resistance, InpMaxLevels * 2);
   ArrayResize(support,    InpMaxLevels * 2);
   int rCount = 0, sCount = 0;

   // Multi-timeframe swing levels
   FindSwingLevels(InpMajorTF, resistance, rCount, support, sCount);
   FindSwingLevels(InpMinorTF, resistance, rCount, support, sCount);

   // Merge nearby levels
   MergeLevels(resistance, rCount);
   MergeLevels(support,    sCount);

   // Sort resistance ascending, support descending
   ArraySort(resistance);
   ArraySort(support);

   // Draw resistance (nearest ones above price first)
   for (int i = 0; i < MathMin(rCount, InpMaxLevels); i++) {
      string name = PREFIX + "R" + IntegerToString(i);
      DrawHLine(name, resistance[i], InpColorR, "R" + IntegerToString(i + 1));
   }
   // Draw support
   for (int i = sCount - 1; i >= MathMax(0, sCount - InpMaxLevels); i--) {
      string name = PREFIX + "S" + IntegerToString(sCount - 1 - i);
      DrawHLine(name, support[i], InpColorS, "S" + IntegerToString(sCount - i));
   }

   // Daily Pivots
   if (InpShowPivot) {
      double dH = iHigh(Symbol(), PERIOD_D1, 1);
      double dL = iLow (Symbol(), PERIOD_D1, 1);
      double dC = iClose(Symbol(), PERIOD_D1, 1);
      double pivot = (dH + dL + dC) / 3.0;
      double r1 = 2 * pivot - dL;
      double s1 = 2 * pivot - dH;
      double r2 = pivot + (dH - dL);
      double s2 = pivot - (dH - dL);

      DrawHLine(PREFIX + "PP",  pivot, InpColorPivot, "PP");
      DrawHLine(PREFIX + "PR1", r1,    InpColorR,     "R1");
      DrawHLine(PREFIX + "PS1", s1,    InpColorS,     "S1");
      DrawHLine(PREFIX + "PR2", r2,    InpColorR,     "R2");
      DrawHLine(PREFIX + "PS2", s2,    InpColorS,     "S2");
   }

   ChartRedraw(0);
}
`;
}

// ── MQL4 Indicator (MetaTrader 4) ─────────────────────────────────────────────
function generateMT4(): string {
  return `//+------------------------------------------------------------------+
//|  GIOS_SR_Levels.mq4                                               |
//|  Auto Support & Resistance — Gold Intelligence OS                  |
//|  © EA Profit Lab                                                   |
//+------------------------------------------------------------------+
#property copyright "EA Profit Lab / Gold Intelligence OS"
#property version   "2.00"
#property indicator_chart_window
#property indicator_plots 0

//--- Inputs
extern ENUM_TIMEFRAMES MajorTF    = PERIOD_D1;
extern ENUM_TIMEFRAMES MinorTF    = PERIOD_H4;
extern int             SwingBars  = 5;
extern int             MaxLevels  = 8;
extern bool            ShowPivots = true;
extern bool            AlertOn    = true;
extern double          AlertPct   = 0.1;
extern color           ColorR     = clrCrimson;
extern color           ColorS     = clrDodgerBlue;
extern color           ColorPivot = clrGoldenrod;
extern int             LineWidth  = 2;

#define PREFIX "GIOS_SR_"

datetime lastAlert = 0;

int init() {
   DrawLevels();
   return 0;
}

int deinit() {
   ObjectsDeleteAll(0, PREFIX);
   return 0;
}

int start() {
   static datetime lastDraw = 0;
   if (TimeCurrent() - lastDraw > 300) {
      DrawLevels();
      lastDraw = TimeCurrent();
   }
   if (AlertOn) CheckAlerts(Close[0]);
   return 0;
}

void CheckAlerts(double price) {
   if (TimeCurrent() - lastAlert < 300) return;
   double threshold = price * AlertPct / 100.0;
   int total = ObjectsTotal();
   for (int i = 0; i < total; i++) {
      string name = ObjectName(i);
      if (StringFind(name, PREFIX) < 0) continue;
      if (ObjectType(name) != OBJ_HLINE) continue;
      double level = ObjectGet(name, OBJPROP_PRICE1);
      if (MathAbs(price - level) <= threshold) {
         string t = (StringFind(name, "R") >= 0) ? "RESISTANCE" : "SUPPORT";
         Alert(Symbol(), " near ", t, " @ ", DoubleToStr(level, Digits));
         lastAlert = TimeCurrent();
         break;
      }
   }
}

void DrawLine(string name, double price, color clr, string label) {
   if (ObjectFind(name) < 0) ObjectCreate(name, OBJ_HLINE, 0, 0, price);
   ObjectSet(name, OBJPROP_PRICE1, price);
   ObjectSet(name, OBJPROP_COLOR,  clr);
   ObjectSet(name, OBJPROP_WIDTH,  LineWidth);
   ObjectSet(name, OBJPROP_BACK,   true);
   string tname = name + "_T";
   if (ObjectFind(tname) < 0) ObjectCreate(tname, OBJ_TEXT, 0, Time[0], price);
   ObjectSetText(tname, label + " " + DoubleToStr(price, Digits), 8);
   ObjectSet(tname, OBJPROP_COLOR, clr);
   ObjectSet(tname, OBJPROP_TIME1, Time[0]);
   ObjectSet(tname, OBJPROP_PRICE1,price);
}

void DrawLevels() {
   ObjectsDeleteAll(0, PREFIX);
   double curPrice = Close[0];
   double swH = 0, swL = 999999;
   int rIdx = 0, sIdx = 0;

   // Draw swing levels from both timeframes
   int timeframes[2] = {MajorTF, MinorTF};
   for (int tf = 0; tf < 2; tf++) {
      int bars = 100;
      for (int i = SwingBars; i < bars - SwingBars && rIdx + sIdx < MaxLevels * 2; i++) {
         double h = iHigh(Symbol(), timeframes[tf], i);
         double l = iLow (Symbol(), timeframes[tf], i);
         // Swing High
         bool isH = true;
         for (int k = 1; k <= SwingBars; k++) {
            if (h <= iHigh(Symbol(), timeframes[tf], i-k) || h <= iHigh(Symbol(), timeframes[tf], i+k)) { isH = false; break; }
         }
         if (isH && h > curPrice && rIdx < MaxLevels) {
            DrawLine(PREFIX + "R" + IntegerToString(rIdx), h, ColorR, "R" + IntegerToString(rIdx + 1));
            rIdx++;
         }
         // Swing Low
         bool isL = true;
         for (int k = 1; k <= SwingBars; k++) {
            if (l >= iLow(Symbol(), timeframes[tf], i-k) || l >= iLow(Symbol(), timeframes[tf], i+k)) { isL = false; break; }
         }
         if (isL && l < curPrice && sIdx < MaxLevels) {
            DrawLine(PREFIX + "S" + IntegerToString(sIdx), l, ColorS, "S" + IntegerToString(sIdx + 1));
            sIdx++;
         }
      }
   }

   // Pivots
   if (ShowPivots) {
      double dH = iHigh(Symbol(), PERIOD_D1, 1);
      double dL = iLow (Symbol(), PERIOD_D1, 1);
      double dC = iClose(Symbol(), PERIOD_D1, 1);
      double pivot = (dH + dL + dC) / 3.0;
      DrawLine(PREFIX + "PP",  pivot,              ColorPivot, "PP");
      DrawLine(PREFIX + "PR1", 2*pivot - dL,       ColorR,     "R1");
      DrawLine(PREFIX + "PS1", 2*pivot - dH,       ColorS,     "S1");
      DrawLine(PREFIX + "PR2", pivot + (dH - dL),  ColorR,     "R2");
      DrawLine(PREFIX + "PS2", pivot - (dH - dL),  ColorS,     "S2");
   }

   WindowRedraw();
}
`;
}

export async function GET(req: Request) {
  const type = new URL(req.url).searchParams.get("type") ?? "mt5";
  const isMT4 = type === "mt4";
  const code     = isMT4 ? generateMT4() : generateMT5();
  const filename = isMT4 ? "GIOS_SR_Levels.mq4" : "GIOS_SR_Levels.mq5";

  return new Response(code, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
