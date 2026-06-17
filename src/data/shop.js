export const shopItems = [
  {
    id: "normal-capsule-ticket",
    name: "Normal Capsule Ticket",
    type: "ticket",
    price: 300,
    quantity: 1,
    description: "A stored ticket for a future Normal Capsule pull."
  },
  {
    id: "premium-capsule-ticket",
    name: "Premium Capsule Ticket",
    type: "ticket",
    price: 1200,
    quantity: 1,
    description: "A stored ticket for a future Premium Capsule pull."
  },
  {
    id: "ten-draw-discount",
    name: "10 Pull Discount Voucher",
    type: "coupon",
    price: 2000,
    quantity: 1,
    description: "A future discount voucher for a 10-pull capsule order."
  },
  {
    id: "legendary-piece",
    name: "Legendary Collection Piece",
    type: "piece",
    price: 3000,
    quantity: 1,
    description: "A saved Legendary-grade piece for future synthesis."
  },
  {
    id: "mythic-piece",
    name: "Mythic Collection Piece",
    type: "piece",
    price: 10000,
    quantity: 1,
    description: "A saved Mythic-grade piece for future synthesis."
  },
  {
    id: "special-frame-box",
    name: "Special Frame Box",
    type: "box",
    price: 2500,
    quantity: 1,
    description: "A sealed frame box. Opening is planned for Phase 3."
  },
  {
    id: "theme-box",
    name: "Theme Box",
    type: "box",
    price: 4000,
    quantity: 1,
    description: "A sealed theme box. Opening is planned for Phase 3."
  },
  {
    id: "effect-box",
    name: "Effect Box",
    type: "box",
    price: 4000,
    quantity: 1,
    description: "A sealed effect box. Opening is planned for Phase 3."
  }
];

export function getShopItem(itemId) {
  return shopItems.find((item) => item.id === itemId);
}
