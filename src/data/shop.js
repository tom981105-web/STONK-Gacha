export const shopItems = [
  {
    id: "normal-capsule-ticket",
    name: "일반 캡슐 티켓",
    type: "ticket",
    price: 300,
    quantity: 1,
    description: "다음 일반 캡슐 뽑기에 사용할 보관용 티켓."
  },
  {
    id: "premium-capsule-ticket",
    name: "프리미엄 캡슐 티켓",
    type: "ticket",
    price: 1200,
    quantity: 1,
    description: "다음 프리미엄 캡슐 뽑기에 사용할 보관용 티켓."
  },
  {
    id: "ten-draw-discount",
    name: "10연차 할인권",
    type: "coupon",
    price: 2000,
    quantity: 1,
    description: "10연차 캡슐 주문에 쓰는 할인 쿠폰."
  },
  {
    id: "legendary-piece",
    name: "Legendary 조각",
    type: "piece",
    price: 3000,
    quantity: 1,
    description: "추후 합성에 쓰는 Legendary 등급 조각."
  },
  {
    id: "mythic-piece",
    name: "Mythic 조각",
    type: "piece",
    price: 10000,
    quantity: 1,
    description: "추후 합성에 쓰는 Mythic 등급 조각."
  },
  {
    id: "special-frame-box",
    name: "스페셜 프레임 박스",
    type: "box",
    price: 2500,
    quantity: 1,
    description: "봉인된 프레임 박스. 개봉은 추후 업데이트 예정."
  },
  {
    id: "theme-box",
    name: "테마 박스",
    type: "box",
    price: 4000,
    quantity: 1,
    description: "봉인된 테마 박스. 개봉은 추후 업데이트 예정."
  },
  {
    id: "effect-box",
    name: "이펙트 박스",
    type: "box",
    price: 4000,
    quantity: 1,
    description: "봉인된 이펙트 박스. 개봉은 추후 업데이트 예정."
  }
];

export function getShopItem(itemId) {
  return shopItems.find((item) => item.id === itemId);
}
