export const PLANS = {
  free: {
    name: "Free",
    price: 0,
    description: "基础功能，适合体验",
    features: [
      "每日 1 次方案生成",
      "每日 5 次 AI 对话",
      "每日 10 次工具搜索",
      "基础教程访问",
      "Claude Sonnet 模型",
    ],
    limits: {
      planGenerations: 1,
      aiRequests: 5,
      toolSearches: 10,
    },
  },
  pro: {
    name: "Pro",
    price: 29,
    description: "解锁全部功能，无限使用",
    features: [
      "无限方案生成",
      "无限 AI 对话",
      "无限工具搜索",
      "全部教程访问",
      "Claude Opus 模型可选",
      "优先客服支持",
    ],
    limits: {
      planGenerations: -1,
      aiRequests: -1,
      toolSearches: -1,
    },
  },
} as const;

const PRO_PRICE_ID = process.env.STRIPE_PRO_MONTHLY_PRICE_ID ?? "price_placeholder";

export function getPlanByPriceId(priceId: string): "pro" | null {
  return priceId === PRO_PRICE_ID ? "pro" : null;
}

export function getFreeLimits() {
  return PLANS.free.limits;
}

export function getProLimits() {
  return PLANS.pro.limits;
}
