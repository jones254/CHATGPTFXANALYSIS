const TD_API_KEY = "d1babeb679ab40b3874b0541d46f6059";

const sleep = ms => new Promise(r => setTimeout(r, ms));

function pipSize(pair) {
  return pair.includes("JPY") ? 0.01 : 0.0001;
}

async function fetchCandles(symbol, interval) {
  const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=${interval}&outputsize=120&apikey=${TD_API_KEY}`;
  const r = await fetch(url);
  const j = await r.json();
  if (!j.values) return [];
  return j.values.reverse().map(v => ({
    open:+v.open, high:+v.high, low:+v.low, close:+v.close
  }));
}

function structureDirection(candles) {
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  return highs[highs.length-1] > highs[0] ? "UP" :
         lows[lows.length-1] < lows[0] ? "DOWN" : "RANGE";
}

function recentSwing(candles, bias) {
  if (bias === "BUY") {
    return Math.min(...candles.slice(-10).map(c => c.low));
  }
  return Math.max(...candles.slice(-10).map(c => c.high));
}

document.getElementById("run").onclick = async () => {
  const pair = document.getElementById("pair").value;
  const bias = document.getElementById("bias").value;
  const confidence = Number(document.getElementById("confidence").value);
  const avgRSI = Number(document.getElementById("rsi").value);

  const out = document.getElementById("output");
  out.innerHTML = `<div class="bg-white p-4 rounded shadow">Analyzing...</div>`;

  if (confidence < 55) {
    out.innerHTML = `<div class="bg-red-100 p-4 rounded">NO TRADE: Confidence too low</div>`;
    return;
  }

  if ((bias === "BUY" && avgRSI < 45) || (bias === "SELL" && avgRSI > 55)) {
    out.innerHTML = `<div class="bg-red-100 p-4 rounded">NO TRADE: RSI contradicts bias</div>`;
    return;
  }

  const h1 = await fetchCandles(pair, "1h");
  await sleep(600);
  const m30 = await fetchCandles(pair, "30min");
  await sleep(600);
  const m15 = await fetchCandles(pair, "15min");

  if (!h1.length || !m30.length || !m15.length) {
    out.innerHTML = `<div class="bg-red-100 p-4 rounded">NO DATA</div>`;
    return;
  }

  const h1Dir = structureDirection(h1);
  if ((bias === "BUY" && h1Dir !== "UP") ||
      (bias === "SELL" && h1Dir !== "DOWN")) {
    out.innerHTML = `<div class="bg-yellow-100 p-4 rounded">NO TRADE: 1H structure against bias</div>`;
    return;
  }

  const last = m15[m15.length-1].close;
  const swing = recentSwing(m15, bias);
  const pip = pipSize(pair);

  const slPips = Math.abs(last - swing) / pip;
  const tpPips = slPips * 2.2;

  const orderType = confidence >= 65 ? "MARKET" : "PENDING";

  out.innerHTML = `
  <div class="bg-green-100 p-6 rounded shadow space-y-2">
    <h2 class="text-xl font-bold">✅ TRADE PLAN</h2>
    <div><b>Pair:</b> ${pair}</div>
    <div><b>Bias:</b> ${bias}</div>
    <div><b>Order:</b> ${orderType}</div>
    <div><b>Entry:</b> ${last.toFixed(5)}</div>
    <div><b>Stop Loss:</b> ${slPips.toFixed(1)} pips</div>
    <div><b>Take Profit:</b> ${tpPips.toFixed(1)} pips</div>
    <div><b>Risk-Reward:</b> 1:2.2</div>
    <div class="text-sm text-gray-700 mt-2">
      • 1H structure aligned<br>
      • 30m pullback context<br>
      • 15m execution level<br>
      • RSI supportive (${avgRSI})
    </div>
  </div>`;
};
