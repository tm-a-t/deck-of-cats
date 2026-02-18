/* ============================================================
   PIRATES — Dynamic Layout
   ============================================================ */

const REF_H = 1440;

function computeLayout(w, h) {
  const k = h / REF_H;
  return {
    W: w, H: h, k,
    cx: w / 2,
    Y_ROUND:   30 * k,
    Y_INV:     75 * k,
    Y_CREW:    130 * k,
    Y_DIV1:    175 * k,
    Y_ISL_CY:  370 * k,
    Y_ISL_LBL: 500 * k,
    Y_PHASE:   555 * k,
    Y_HAND:    680 * k,
    Y_HLBL:    745 * k,
    Y_BTN:     890 * k,
    Y_DIV2:    955 * k,
    Y_SHOP_L:  985 * k,
    Y_SHOP_C:  1030 * k,
    Y_SHOP_P:  1130 * k,
    Y_SHOP_PR: 1200 * k,
    Y_SHOP_NM: 1240 * k,
    Y_SHOP_DI: 1264 * k,
    Y_SHOP_DS: 1290 * k,
    Y_SHOP_BT: 1330 * k,
    SC:    Math.max(3, Math.round(10 * k)),
    SC_SM: Math.max(2, Math.round(5 * k)),
    fs: (px) => Math.max(10, Math.round(px * k)) + 'px',
  };
}
