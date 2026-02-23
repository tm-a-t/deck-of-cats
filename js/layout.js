/* ============================================================
   PIRATES — Dynamic Layout
   ============================================================ */

const REF_H = 1440;

function computeLayout(w, h) {
  const k = (h / REF_H) * 1.15;
  const narrowHandSplit = w <= 760;
  const narrowContentShiftY = narrowHandSplit ? 120 * k : 0;
  const uiFontPx = Math.max(14, Math.round(24 * k)) + 'px';
  const centerY = h * 0.43;
  const handY = h - 240 * k;
  return {
    W: w, H: h, k,
    cx: w / 2,
    Y_ROUND:   24 * k,
    Y_INV:     66 * k,
    Y_CREW:    116 * k,
    Y_SHOP:    156 * k,
    Y_DIV1:    198 * k,
    Y_ISL_CY:  centerY - narrowContentShiftY,
    Y_ISL_LBL: centerY + 140 * k - narrowContentShiftY,
    Y_PHASE:   centerY + 194 * k - narrowContentShiftY,
    Y_HAND:    handY - 60 * k,
    Y_HLBL:    handY - 60 * k + 54 * k,
    Y_NAV:     h - 50 * k,
    NARROW_HAND_SPLIT: narrowHandSplit,
    SC:    Math.max(3, Math.round(10 * k)),
    SC_SM: Math.max(2, Math.round(5 * k)),
    UI_FS: uiFontPx,
    fs: () => uiFontPx,

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
