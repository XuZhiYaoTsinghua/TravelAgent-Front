import type { Lang } from '../i18n/translations';
import type { Plan, AgentEvent, AgentDecision, AgentAction } from '../types';

const planZh: Record<string, { activity?: string; placeName?: string; placeDesc?: string }> = {
  'place_kiyomizu': { placeName: '清水寺', placeDesc: '世界遗产木造寺院，俯瞰京都全景' },
  'place_fushimi': { placeName: '伏见稻荷大社', placeDesc: '千本鸟居，稻荷神总本社' },
  'place_arashiyama': { placeName: '岚山竹林', placeDesc: '幽静竹林小径，日本名胜百选' },
  'place_gion': { placeName: '祇园', placeDesc: '传统花街区，偶遇艺伎' },
  'place_kinkakuji': { placeName: '金阁寺', placeDesc: '金箔覆盖的禅宗寺院，世界遗产' },
  'place_nishiki': { placeName: '锦市场', placeDesc: '400年历史的传统美食街' },
  'place_hoshinoya': { placeName: '星野京都', placeDesc: '百年町屋改造的奢华日式旅馆' },
  'place_kichi': { placeName: 'Kichi Kichi 蛋包饭', placeDesc: '网红蛋包饭，现场表演制作' },
  'place_kanra': { placeName: '京都酒店 Kanra', placeDesc: '中高端町屋风格酒店' },
  'place_shinkansen': { placeName: '京都站', placeDesc: '新干线京都站' },
};

const eventZh: Record<string, string> = {
  'evt_001': '用户想要4月去京都4天2人旅行。需要查找交通、住宿和活动。',
  'evt_002': '调用 search_flights 搜索 2026-04-10 东京→大阪航班',
  'evt_003': '找到3个航班选项。对于这条路线，新干线比飞机更快更方便。',
  'evt_004': '新干线是更好的选择。现在需要找传统风格的住宿。',
  'evt_005': '调用 search_hotels 搜索岚山地区的日式旅馆',
  'evt_006': '星野京都4月10-13日有房。豪华型，带私人温泉。',
  'evt_007': '住宿已确认。下一步：预订热门餐厅和查看天气。',
  'evt_008': '已排队：search_restaurants、check_weather、generate_itinerary',
  'evt_009': '行程草案已准备好，等待用户确认后再预订。',
};

const decisionZh: Record<string, { title: string; description: string; options: Record<string, { label: string; description: string }> }> = {
  'dec_001': {
    title: '审核行程草案',
    description: '智能体准备了一份4天京都行程，共10项活动。请审核并批准以继续预订。',
    options: {
      'opt_001': { label: '批准并预订', description: '确认行程并继续预订所有项目' },
      'opt_002': { label: '要求修改', description: '要求智能体修改行程的特定部分' },
      'opt_003': { label: '拒绝', description: '放弃此行程并重新开始' },
    },
  },
  'dec_002': {
    title: '预算审批',
    description: '预估总费用为 $2,840，在你的 $3,000 预算范围内。是否批准继续？',
    options: {
      'opt_004': { label: '批准预算', description: '$2,840 的总费用可以接受' },
      'opt_005': { label: '降低成本', description: '要求智能体寻找更便宜的替代方案' },
    },
  },
  'dec_003': {
    title: '住宿替代方案',
    description: '星野京都（$310/晚）属于高端。是否考虑中端替代方案？',
    options: {
      'opt_006': { label: '保留星野京都', description: '入住豪华旅馆（3晚共 $1,240）' },
      'opt_007': { label: '换至 Kanra 酒店', description: '中端选择 $180/晚（共 $540，省 $700）' },
    },
  },
};

const actionZh: Record<string, { description: string; result?: string }> = {
  'act_001': { description: '搜索飞往大阪（关西机场）的航班', result: '找到3个选项：ANA、JAL、Peach' },
  'act_002': { description: '搜索岚山地区的日式旅馆', result: '星野京都 4月10-13日有房' },
  'act_003': { description: '预订 Kichi Kichi 蛋包饭' },
  'act_004': { description: '查看京都 4月10-13日天气' },
  'act_005': { description: '生成最终行程' },
};

const actionResultZh: Record<string, string> = {
  'act_003': '已确认2人12:30的预订',
  'act_004': '晴天，18-22°C。建议带薄外套。',
  'act_005': '行程已编制完成，4天共10项活动',
};

export function localizePlan(plan: Plan, lang: Lang): Plan {
  if (lang === 'en') return plan;
  return {
    ...plan,
    destination: plan.destination === 'Kyoto, Japan' ? '京都，日本' : plan.destination,
    items: plan.items.map((item) => {
      const tr = planZh[item.place.id];
      return {
        ...item,
        activity: tr?.activity ?? item.activity,
        place: {
          ...item.place,
          name: tr?.placeName ?? item.place.name,
          description: tr?.placeDesc ?? item.place.description,
        },
      };
    }),
  };
}

export function localizeEvents(events: AgentEvent[], lang: Lang): AgentEvent[] {
  if (lang === 'en') return events;
  return events.map((evt) => ({
    ...evt,
    content: eventZh[evt.id] ?? evt.content,
  }));
}

export function localizeDecisions(decisions: AgentDecision[], lang: Lang): AgentDecision[] {
  if (lang === 'en') return decisions;
  return decisions.map((dec) => {
    const tr = decisionZh[dec.id];
    if (!tr) return dec;
    return {
      ...dec,
      title: tr.title,
      description: tr.description,
      options: dec.options.map((opt) => ({
        ...opt,
        label: tr.options[opt.id]?.label ?? opt.label,
        description: tr.options[opt.id]?.description ?? opt.description,
      })),
    };
  });
}

export function localizeActions(actions: AgentAction[], lang: Lang): AgentAction[] {
  if (lang === 'en') return actions;
  return actions.map((act) => {
    const tr = actionZh[act.id] ?? actionZh[act.id.replace(/^gen-/, '')];
    if (!tr) return act;
    return {
      ...act,
      description: tr.description ?? act.description,
      result: tr.result ?? act.result,
    };
  });
}

export function localizeActionResult(originalId: string, fallback: string, lang: Lang): string {
  if (lang === 'en') return fallback;
  return actionResultZh[originalId] ?? fallback;
}
