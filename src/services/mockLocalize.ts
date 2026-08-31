import type { Lang } from '../i18n/translations';
import type { Plan, AgentEvent, AgentAction } from '../types';

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
