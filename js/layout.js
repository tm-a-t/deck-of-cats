/* ============================================================
   PIRATES — Dynamic Layout
   ============================================================ */

const REF_W = 400;
const REF_H = 800;
const UI_SCALE_BOOST = 1.0;
const MIN_UI_SCALE = 1.0;
const MAX_UI_SCALE = 3.2;
const CHARACTER_SCALE_BOOST = 1.55;
const BASE_TEXT_SIZE_FROM_PIRATES = 32;

function resolveViewportSize(fallbackW, fallbackH) {
  let w = fallbackW || 0;
  let h = fallbackH || 0;

  if (typeof window !== 'undefined') {
    if (window.innerWidth) w = window.innerWidth;
    if (window.innerHeight) h = window.innerHeight;

    const vv = window.visualViewport;
    if (vv && vv.width && vv.height) {
      const vvW = Math.round(vv.width);
      const vvH = Math.round(vv.height);
      w = Math.max(w, vvW);
      h = Math.max(h, vvH);
    }
  }

  return { w, h };
}

function isPortraitMobile(w, h) {
  const vp = resolveViewportSize(w, h);
  return vp.h > vp.w;
}

function computeLayout(w, h) {
  const isMobile = isPortraitMobile(w, h);
  const rawScale = Math.min(w / REF_W, h / REF_H) * UI_SCALE_BOOST;
  const k = Math.max(MIN_UI_SCALE, Math.min(MAX_UI_SCALE, rawScale));
  const fontPx = (px = BASE_TEXT_SIZE_FROM_PIRATES) => `${Math.round(px * k)}px`;
  const narrowContentShiftY = isMobile ? 120 * k : 0;
  const handNavBaseOffset = 50;
  const navBaseOffset = 26;
  const centerY = h * 0.43;
  const yPhase = centerY + 194 * k - narrowContentShiftY;
  const yNav = h - navBaseOffset * k;
  const handShipSpace = (h - handNavBaseOffset * k) - yPhase;
  const handFooterClearance = 60 * k;
  const handHalfH = 198 * k * 0.55;
  const footerAnchoredHandCenter = yNav - handFooterClearance - handHalfH;
  const flowHandCenter = yPhase + handShipSpace * 0.4;
  const yHandCenter = Math.max(footerAnchoredHandCenter, flowHandCenter);
  const yDiv2Raw = yHandCenter - 136 * k - (isMobile ? 200 * k : 0);
  const yDiv2 = Math.max(yDiv2Raw, yPhase + 24 * k);
  const yShipRow = yPhase + handShipSpace * 0.82;
  return {
    W: w, H: h, k,
    IS_MOBILE: isMobile,
    cx: w / 2,
    Y_ROUND:   24 * k,
    Y_INV:     66 * k,
    Y_CREW:    116 * k,
    Y_SHOP:    156 * k,
    Y_DIV1:    198 * k,
    Y_ISL_CY:  centerY - narrowContentShiftY,
    Y_ISL_LBL: centerY + 140 * k - narrowContentShiftY,
    Y_PHASE:   yPhase,
    Y_DIV2:    yDiv2,
    Y_HAND:    yHandCenter,
    Y_HLBL:    yHandCenter + 54 * k,
    Y_HAND_CENTER: yHandCenter,
    Y_SHIP_ROW: yShipRow,
    Y_NAV:     yNav,
    NARROW_HAND_SPLIT: isMobile,
    SC:    10 * k * CHARACTER_SCALE_BOOST,
    SC_SM: 5 * k * CHARACTER_SCALE_BOOST,
    UI_FS: fontPx(BASE_TEXT_SIZE_FROM_PIRATES),
    fs: (px = BASE_TEXT_SIZE_FROM_PIRATES) => fontPx(px),
    fsPx: (px = BASE_TEXT_SIZE_FROM_PIRATES) => fontPx(px),

    // Map panel layout
    MAP_PANEL_PAD:  24 * k,
    MAP_HEAD_H:     84 * k,
    MAP_FOOT_H:     40 * k,
    MAP_NODE_R:     22 * k,
    MAP_LAYER_SP:   95 * k,
    MAP_NODE_FS:    28 * k,
    MAP_SHIP_R:     30 * k,
  };
}
