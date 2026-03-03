/* ============================================================
   PIRATES — Dynamic Layout
   ============================================================ */

const REF_W = 960;
const REF_H = 1440;
const UI_SCALE_BOOST = 1.20;
const CHARACTER_SCALE_BOOST = 1.45;
const BASE_TEXT_SIZE_FROM_PIRATES = 30;

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
  const k = Math.min(w / REF_W, h / REF_H) * UI_SCALE_BOOST;
  const narrowContentShiftY = isMobile ? 120 * k : 0;
  const handBaseOffset = isMobile ? 380 : 240;
  const navBaseOffset = 50;
  const uniformFontPx = (BASE_TEXT_SIZE_FROM_PIRATES * k) + 'px';
  const centerY = h * 0.43;
  const handY = h - handBaseOffset * k;
  const yPhase = centerY + 194 * k - narrowContentShiftY;
  const yDiv2Raw = handY - 136 * k - (isMobile ? 200 * k : 0);
  const yDiv2 = Math.max(yDiv2Raw, yPhase + 24 * k);
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
    Y_HAND:    handY - 60 * k,
    Y_HLBL:    handY - 60 * k + 54 * k,
    Y_NAV:     h - navBaseOffset * k,
    NARROW_HAND_SPLIT: isMobile,
    SC:    10 * k * CHARACTER_SCALE_BOOST,
    SC_SM: 5 * k * CHARACTER_SCALE_BOOST,
    UI_FS: uniformFontPx,
    fs: () => uniformFontPx,
    fsPx: () => uniformFontPx,

    // Modal map layout
    MAP_MODAL_W:    Math.min(w - 60 * k, 760 * k),
    MAP_MODAL_H:    Math.min(h - 250 * k, 860 * k),
    MAP_MODAL_PAD:  24 * k,
    MAP_HEAD_H:     84 * k,
    MAP_FOOT_H:     40 * k,
    MAP_NODE_R:     22 * k,
    MAP_LAYER_SP:   95 * k,
    MAP_NODE_FS:    28 * k,
    MAP_SHIP_R:     30 * k,
  };
}
