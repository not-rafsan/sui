// Quick layout overlap check
const CW = 1080, CH = 1350;

// Circle geometry (from code: top circle 320px at top:-110 right:-110, bottom 280px at bottom:-100 left:-100)
const tc = { cx: CW + 110 - 160, cy: -110 + 160, r: 160 }; // top-right
const bc = { cx: -100 + 140, cy: CH + 100 - 140, r: 140 };   // bottom-left

function tw(text, fs, ls) { return text.length * fs * 0.55 + (text.length - 1) * ls; }

console.log("=== LAYOUT OVERLAP CHECK (1080x1350 canvas) ===\n");

// Top circle visible zone inside canvas
console.log("Top-right circle:");
console.log(`  Center: (${tc.cx}, ${tc.cy}), Radius: ${tc.r}`);
console.log(`  Left edge (inside canvas): ${tc.cx - tc.r}px from left`);
console.log(`  Bottom edge (inside canvas): ${tc.cy + tc.r}px from top`);

// Content "CHAPTER 01" 
const ch = "CHAPTER 01", fs = 124, ls = 5;
const w = tw(ch, fs, ls);
const left = (CW - w) / 2, right = (CW + w) / 2;
console.log(`\n"CHAPTER 01" at ${fs}px + ${ls}px spacing:`);
console.log(`  Width: ${Math.round(w)}px, extends ${Math.round(left)}px to ${Math.round(right)}px`);
console.log(`  Circle left edge: ${tc.cx - tc.r}px`);
console.log(`  Right edge of text vs circle: ${Math.round(right)} vs ${tc.cx - tc.r}`);
console.log(`  OVERLAP: ${right > tc.cx - tc.r ? "❌ YES" : "✅ NO"}`);

// Cover keyword
const kw = "DROPSHIPPING", kfs = 126, kls = 3;
const kwW = tw(kw, kfs, kls);
const kwLeft = (CW - kwW) / 2, kwRight = (CW + kwW) / 2;
console.log(`\n"DROPSHIPPING" at ${kfs}px + ${kls}px spacing:`);
console.log(`  Width: ${Math.round(kwW)}px, extends ${Math.round(kwLeft)}px to ${Math.round(kwRight)}px`);
console.log(`  OVERLAP with circle: ${kwRight > tc.cx - tc.r ? "❌ YES" : "✅ NO"}`);

// CTA
const cta = "SAVE TO START", cfs = 118, cls = 8;
const ctaW = tw(cta, cfs, cls);
const ctaL = (CW - ctaW) / 2, ctaR = (CW + ctaW) / 2;
console.log(`\n"SAVE TO START" at ${cfs}px + ${cls}px spacing:`);
console.log(`  Width: ${Math.round(ctaW)}px, extends ${Math.round(ctaL)}px to ${Math.round(ctaR)}px`);
console.log(`  OVERLAP with circle: ${ctaR > tc.cx - tc.r ? "❌ YES" : "✅ NO"}`);

// Bottom circle
console.log(`\nBottom-left circle:`);
console.log(`  Center: (${bc.cx}, ${bc.cy}), Radius: ${bc.r}`);
console.log(`  Right edge: ${bc.cx + bc.r}px from left`);
console.log(`  Top edge: ${bc.cy - bc.r}px from top`);
console.log(`  Content padding left: 100px`);
console.log(`  Text starts at 100px, circle ends at ${bc.cx + bc.r}px`);
console.log(`  OVERLAP: ${100 < bc.cx + bc.r ? "Check bullet text" : "✅ NO"}`);