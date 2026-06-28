// Returns a ready-to-compile MQL5 EA with the server URL pre-filled.
// The client downloads it as a .mq5 file.

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function buildEACode(serverUrl: string): string {
  return `//+------------------------------------------------------------------+
//|  GoldIntelligenceOS_Bridge.mq5                                   |
//|  Auto-pushes MT5 account data to Gold Intelligence OS (GIOS)     |
//|  Version: 1.0  |  Compatible: MetaTrader 5 (Build 3800+)         |
//+------------------------------------------------------------------+
#property copyright "Gold Intelligence OS — EA Profit Lab"
#property version   "1.00"
#property strict

//── Inputs ────────────────────────────────────────────────────────────────────
input string InpServerUrl  = "${serverUrl}/api/mt5/push";   // GIOS Server URL
input string InpApiKey     = "mt5-bridge-key";              // API Key (set in .env.local MT5_API_KEY)
input int    InpIntervalSec = 15;                           // Push interval (seconds)
input bool   InpDebugLog    = false;                        // Print debug log

//── Globals ───────────────────────────────────────────────────────────────────
datetime g_lastPush = 0;
int      g_errCount = 0;

//+------------------------------------------------------------------+
int OnInit()
  {
   Print("GIOS Bridge EA started — target: ", InpServerUrl);
   EventSetTimer(InpIntervalSec);
   return INIT_SUCCEEDED;
  }

void OnDeinit(const int reason)
  {
   EventKillTimer();
   Comment("");
  }

void OnTimer() { PushData(); }

void OnTick()
  {
   if(TimeCurrent() - g_lastPush >= InpIntervalSec)
      PushData();
  }

//+------------------------------------------------------------------+
//| Build JSON body and push to GIOS                                  |
//+------------------------------------------------------------------+
void PushData()
  {
   g_lastPush = TimeCurrent();

   // ── Account fields ────────────────────────────────────────────
   double balance    = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity     = AccountInfoDouble(ACCOUNT_EQUITY);
   double floating   = AccountInfoDouble(ACCOUNT_PROFIT);
   double margin     = AccountInfoDouble(ACCOUNT_MARGIN);
   double freeMargin = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
   double marginLvl  = (margin > 0) ? (equity / margin * 100.0) : 0;
   string currency   = AccountInfoString(ACCOUNT_CURRENCY);
   long   leverage   = AccountInfoInteger(ACCOUNT_LEVERAGE);
   string server     = AccountInfoString(ACCOUNT_SERVER);
   long   accNum     = AccountInfoInteger(ACCOUNT_LOGIN);

   // ── Build positions array ─────────────────────────────────────
   string posArr = "[";
   int total = PositionsTotal();
   for(int i = 0; i < total; i++)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;

      string sym    = PositionGetString(POSITION_SYMBOL);
      long   pType  = PositionGetInteger(POSITION_TYPE);
      double lots   = PositionGetDouble(POSITION_VOLUME);
      double oprice = PositionGetDouble(POSITION_PRICE_OPEN);
      double cprice = PositionGetDouble(POSITION_PRICE_CURRENT);
      double sl     = PositionGetDouble(POSITION_SL);
      double tp     = PositionGetDouble(POSITION_TP);
      double profit = PositionGetDouble(POSITION_PROFIT);
      double swap   = PositionGetDouble(POSITION_SWAP);
      long   otime  = (long)PositionGetInteger(POSITION_TIME);
      string comment = PositionGetString(POSITION_COMMENT);

      string typeStr = (pType == POSITION_TYPE_BUY) ? "buy" : "sell";

      // Escape comment for JSON
      StringReplace(comment, "\"", "'");

      string pos = StringFormat(
        "{\"ticket\":%llu,\"symbol\":\"%s\",\"type\":\"%s\","
        "\"lots\":%.2f,\"openPrice\":%.5f,\"currentPrice\":%.5f,"
        "\"sl\":%.5f,\"tp\":%.5f,\"profit\":%.2f,\"swap\":%.2f,"
        "\"openTime\":%ld,\"comment\":\"%s\"}",
        ticket, sym, typeStr,
        lots, oprice, cprice,
        sl, tp, profit, swap,
        otime, comment
      );

      if(i > 0) posArr += ",";
      posArr += pos;
     }
   posArr += "]";

   // ── Build JSON payload ────────────────────────────────────────
   string body = StringFormat(
     "{\"balance\":%.2f,\"equity\":%.2f,\"floating\":%.2f,"
     "\"margin\":%.2f,\"freeMargin\":%.2f,\"marginLevel\":%.2f,"
     "\"currency\":\"%s\",\"leverage\":%ld,"
     "\"positions\":%s,"
     "\"server\":\"%s\",\"account\":\"%ld\"}",
     balance, equity, floating,
     margin, freeMargin, marginLvl,
     currency, leverage,
     posArr,
     server, accNum
   );

   // ── HTTP POST ─────────────────────────────────────────────────
   string headers = "Content-Type: application/json\\r\\nAuthorization: Bearer " + InpApiKey;
   char   reqData[], resData[];
   string resHeaders;
   StringToCharArray(body, reqData, 0, StringLen(body));

   int httpCode = WebRequest(
     "POST",
     InpServerUrl,
     headers,
     5000,
     reqData,
     resData,
     resHeaders
   );

   if(httpCode == 200)
     {
      g_errCount = 0;
      string status = StringFormat("GIOS Bridge ✓  Equity: %.2f %s  Pos: %d  %s",
        equity, currency, total, TimeToString(TimeCurrent(), TIME_DATE|TIME_MINUTES));
      Comment(status);
      if(InpDebugLog) Print("GIOS push OK | balance=", balance, " equity=", equity);
     }
   else
     {
      g_errCount++;
      string err = CharArrayToString(resData);
      Comment("GIOS Bridge ✗ HTTP ", httpCode, " | Errors: ", g_errCount, " | ", err);
      if(InpDebugLog) Print("GIOS push FAIL | code=", httpCode, " | ", err);
     }
  }
//+------------------------------------------------------------------+
`;
}

export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin;
  const code = buildEACode(origin);

  return new NextResponse(code, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": 'attachment; filename="GoldIntelligenceOS_Bridge.mq5"',
      "Cache-Control": "no-store",
    },
  });
}
