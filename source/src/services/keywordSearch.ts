import type { Lang } from '../i18n/translations';

interface KeywordResult {
  keywords: string[];
  source: string;
}

const DEFAULT_KEYWORDS: Record<Lang, string[]> = {
  en: ['culture', 'scenery', 'food', 'history', 'nature', 'photography', 'shopping', 'nightlife'],
  zh: ['文化', '风景', '美食', '历史', '自然', '摄影', '购物', '夜生活'],
};

// 热门目的地关键词库（中英文双语）
// 优点：秒级响应、不依赖网络、结果精准
const CITY_DATABASE: Record<string, { zh: string[]; en: string[] }> = {
  // 日本
  'kyoto': {
    zh: ['寺庙', '神社', '和服体验', '抹茶', '怀石料理', '清水寺', '伏见稻荷大社', '金阁寺', '岚山', '艺伎'],
    en: ['Temples', 'Shrines', 'Kimono experience', 'Matcha', 'Kaiseki', 'Kiyomizu-dera', 'Fushimi Inari', 'Kinkaku-ji', 'Arashiyama', 'Geisha'],
  },
  '京都': {
    zh: ['寺庙', '神社', '和服体验', '抹茶', '怀石料理', '清水寺', '伏见稻荷大社', '金阁寺', '岚山', '艺伎'],
    en: ['Temples', 'Shrines', 'Kimono experience', 'Matcha', 'Kaiseki', 'Kiyomizu-dera', 'Fushimi Inari', 'Kinkaku-ji', 'Arashiyama', 'Geisha'],
  },
  'tokyo': {
    zh: ['涩谷', '浅草寺', '东京塔', '秋叶原', '寿司', '拉面', '购物', '动漫', '银座', 'teamLab'],
    en: ['Shibuya', 'Senso-ji', 'Tokyo Tower', 'Akihabara', 'Sushi', 'Ramen', 'Shopping', 'Anime', 'Ginza', 'teamLab'],
  },
  '东京': {
    zh: ['涩谷', '浅草寺', '东京塔', '秋叶原', '寿司', '拉面', '购物', '动漫', '银座', 'teamLab'],
    en: ['Shibuya', 'Senso-ji', 'Tokyo Tower', 'Akihabara', 'Sushi', 'Ramen', 'Shopping', 'Anime', 'Ginza', 'teamLab'],
  },
  'osaka': {
    zh: ['大阪城', '道顿堀', '章鱼烧', '环球影城', '美食', '购物', '水族馆', '梅田', '心斋桥', '拉面'],
    en: ['Osaka Castle', 'Dotonbori', 'Takoyaki', 'Universal Studios', 'Food', 'Shopping', 'Aquarium', 'Umeda', 'Shinsaibashi', 'Ramen'],
  },
  '大阪': {
    zh: ['大阪城', '道顿堀', '章鱼烧', '环球影城', '美食', '购物', '水族馆', '梅田', '心斋桥', '拉面'],
    en: ['Osaka Castle', 'Dotonbori', 'Takoyaki', 'Universal Studios', 'Food', 'Shopping', 'Aquarium', 'Umeda', 'Shinsaibashi', 'Ramen'],
  },

  // 中国
  'beijing': {
    zh: ['故宫', '长城', '颐和园', '天坛', '烤鸭', '胡同', '798艺术区', '南锣鼓巷', '历史', '文化'],
    en: ['Forbidden City', 'Great Wall', 'Summer Palace', 'Temple of Heaven', 'Peking duck', 'Hutong', '798 Art District', 'Nanluoguxiang', 'History', 'Culture'],
  },
  '北京': {
    zh: ['故宫', '长城', '颐和园', '天坛', '烤鸭', '胡同', '798艺术区', '南锣鼓巷', '历史', '文化'],
    en: ['Forbidden City', 'Great Wall', 'Summer Palace', 'Temple of Heaven', 'Peking duck', 'Hutong', '798 Art District', 'Nanluoguxiang', 'History', 'Culture'],
  },
  'shanghai': {
    zh: ['外滩', '东方明珠', '豫园', '南京路', '迪士尼', '美食', '购物', '田子坊', '武康路', '夜生活'],
    en: ['The Bund', 'Oriental Pearl', 'Yu Garden', 'Nanjing Road', 'Disneyland', 'Food', 'Shopping', 'Tianzifang', 'Wukang Road', 'Nightlife'],
  },
  '上海': {
    zh: ['外滩', '东方明珠', '豫园', '南京路', '迪士尼', '美食', '购物', '田子坊', '武康路', '夜生活'],
    en: ['The Bund', 'Oriental Pearl', 'Yu Garden', 'Nanjing Road', 'Disneyland', 'Food', 'Shopping', 'Tianzifang', 'Wukang Road', 'Nightlife'],
  },
  'xian': {
    zh: ['兵马俑', '大雁塔', '古城墙', '回民街', '肉夹馍', '历史', '文化', '华山', '碑林', '美食'],
    en: ['Terracotta Army', 'Giant Wild Goose Pagoda', 'City Wall', 'Muslim Quarter', 'Roujiamo', 'History', 'Culture', 'Huashan', 'Stone Stele Forest', 'Food'],
  },
  '西安': {
    zh: ['兵马俑', '大雁塔', '古城墙', '回民街', '肉夹馍', '历史', '文化', '华山', '碑林', '美食'],
    en: ['Terracotta Army', 'Giant Wild Goose Pagoda', 'City Wall', 'Muslim Quarter', 'Roujiamo', 'History', 'Culture', 'Huashan', 'Stone Stele Forest', 'Food'],
  },
  'chengdu': {
    zh: ['大熊猫', '宽窄巷子', '锦里', '火锅', '茶馆', '文化', '美食', '青城山', '都江堰', '串串香'],
    en: ['Giant Pandas', 'Kuanzhai Alley', 'Jinli Street', 'Hotpot', 'Teahouses', 'Culture', 'Food', 'Qingcheng Mountain', 'Dujiangyan', 'Chuanchuan'],
  },
  '成都': {
    zh: ['大熊猫', '宽窄巷子', '锦里', '火锅', '茶馆', '文化', '美食', '青城山', '都江堰', '串串香'],
    en: ['Giant Pandas', 'Kuanzhai Alley', 'Jinli Street', 'Hotpot', 'Teahouses', 'Culture', 'Food', 'Qingcheng Mountain', 'Dujiangyan', 'Chuanchuan'],
  },
  'hangzhou': {
    zh: ['西湖', '灵隐寺', '龙井茶', '宋城', '美食', '自然', '文化', '西溪湿地', '河坊街', '丝绸'],
    en: ['West Lake', 'Lingyin Temple', 'Longjing tea', 'Song Dynasty Town', 'Food', 'Nature', 'Culture', 'Xixi Wetland', 'Hefang Street', 'Silk'],
  },
  '杭州': {
    zh: ['西湖', '灵隐寺', '龙井茶', '宋城', '美食', '自然', '文化', '西溪湿地', '河坊街', '丝绸'],
    en: ['West Lake', 'Lingyin Temple', 'Longjing tea', 'Song Dynasty Town', 'Food', 'Nature', 'Culture', 'Xixi Wetland', 'Hefang Street', 'Silk'],
  },

  // 泰国
  'bangkok': {
    zh: ['大皇宫', '水上市场', '按摩', '冬阴功', '夜市', '寺庙', '美食', '购物', '考山路', '河滨夜市'],
    en: ['Grand Palace', 'Floating Market', 'Massage', 'Tom Yum Goong', 'Night Market', 'Temples', 'Food', 'Shopping', 'Khao San Road', 'Riverside'],
  },
  '曼谷': {
    zh: ['大皇宫', '水上市场', '按摩', '冬阴功', '夜市', '寺庙', '美食', '购物', '考山路', '河滨夜市'],
    en: ['Grand Palace', 'Floating Market', 'Massage', 'Tom Yum Goong', 'Night Market', 'Temples', 'Food', 'Shopping', 'Khao San Road', 'Riverside'],
  },
  'chiang mai': {
    zh: ['寺庙', '夜市', '大象营', '泰式按摩', '美食', '徒步', '文化', '周日夜市', '素贴山', '咖啡'],
    en: ['Temples', 'Night Market', 'Elephant camp', 'Thai massage', 'Food', 'Hiking', 'Culture', 'Sunday Market', 'Doi Suthep', 'Coffee'],
  },
  '清迈': {
    zh: ['寺庙', '夜市', '大象营', '泰式按摩', '美食', '徒步', '文化', '周日夜市', '素贴山', '咖啡'],
    en: ['Temples', 'Night Market', 'Elephant camp', 'Thai massage', 'Food', 'Hiking', 'Culture', 'Sunday Market', 'Doi Suthep', 'Coffee'],
  },

  // 韩国
  'seoul': {
    zh: ['景福宫', '明洞', '南山塔', '韩服体验', '烤肉', '泡菜', '购物', '弘大', '咖啡', '北村韩屋村'],
    en: ['Gyeongbokgung', 'Myeongdong', 'N Seoul Tower', 'Hanbok experience', 'BBQ', 'Kimchi', 'Shopping', 'Hongdae', 'Coffee', 'Bukchon'],
  },
  '首尔': {
    zh: ['景福宫', '明洞', '南山塔', '韩服体验', '烤肉', '泡菜', '购物', '弘大', '咖啡', '北村韩屋村'],
    en: ['Gyeongbokgung', 'Myeongdong', 'N Seoul Tower', 'Hanbok experience', 'BBQ', 'Kimchi', 'Shopping', 'Hongdae', 'Coffee', 'Bukchon'],
  },

  // 新加坡
  'singapore': {
    zh: ['滨海湾花园', '圣淘沙', '鱼尾狮', '环球影城', '美食', '购物', '动物园', '夜间动物园', '文化', '摩天轮'],
    en: ['Gardens by the Bay', 'Sentosa', 'Merlion', 'Universal Studios', 'Food', 'Shopping', 'Zoo', 'Night Safari', 'Culture', 'Ferris wheel'],
  },
  '新加坡': {
    zh: ['滨海湾花园', '圣淘沙', '鱼尾狮', '环球影城', '美食', '购物', '动物园', '夜间动物园', '文化', '摩天轮'],
    en: ['Gardens by the Bay', 'Sentosa', 'Merlion', 'Universal Studios', 'Food', 'Shopping', 'Zoo', 'Night Safari', 'Culture', 'Ferris wheel'],
  },

  // 法国
  'paris': {
    zh: ['埃菲尔铁塔', '卢浮宫', '凯旋门', '凡尔赛宫', '法式料理', '艺术', '购物', '塞纳河', '蒙马特', '咖啡馆'],
    en: ['Eiffel Tower', 'Louvre', 'Arc de Triomphe', 'Versailles', 'French cuisine', 'Art', 'Shopping', 'Seine River', 'Montmartre', 'Cafes'],
  },
  '巴黎': {
    zh: ['埃菲尔铁塔', '卢浮宫', '凯旋门', '凡尔赛宫', '法式料理', '艺术', '购物', '塞纳河', '蒙马特', '咖啡馆'],
    en: ['Eiffel Tower', 'Louvre', 'Arc de Triomphe', 'Versailles', 'French cuisine', 'Art', 'Shopping', 'Seine River', 'Montmartre', 'Cafes'],
  },

  // 英国
  'london': {
    zh: ['大本钟', '伦敦眼', '大英博物馆', '白金汉宫', '塔桥', '历史', '文化', '西区音乐剧', '购物', '下午茶'],
    en: ['Big Ben', 'London Eye', 'British Museum', 'Buckingham Palace', 'Tower Bridge', 'History', 'Culture', 'West End', 'Shopping', 'Afternoon tea'],
  },
  '伦敦': {
    zh: ['大本钟', '伦敦眼', '大英博物馆', '白金汉宫', '塔桥', '历史', '文化', '西区音乐剧', '购物', '下午茶'],
    en: ['Big Ben', 'London Eye', 'British Museum', 'Buckingham Palace', 'Tower Bridge', 'History', 'Culture', 'West End', 'Shopping', 'Afternoon tea'],
  },

  // 意大利
  'rome': {
    zh: ['斗兽场', '梵蒂冈', '许愿池', '古罗马', '历史', '文化', '美食', '披萨', '冰淇淋', '万神殿'],
    en: ['Colosseum', 'Vatican', 'Trevi Fountain', 'Ancient Rome', 'History', 'Culture', 'Food', 'Pizza', 'Gelato', 'Pantheon'],
  },
  '罗马': {
    zh: ['斗兽场', '梵蒂冈', '许愿池', '古罗马', '历史', '文化', '美食', '披萨', '冰淇淋', '万神殿'],
    en: ['Colosseum', 'Vatican', 'Trevi Fountain', 'Ancient Rome', 'History', 'Culture', 'Food', 'Pizza', 'Gelato', 'Pantheon'],
  },

  // 美国
  'new york': {
    zh: ['自由女神', '时代广场', '中央公园', '帝国大厦', '百老汇', '博物馆', '美食', '购物', '布鲁克林大桥', '夜生活'],
    en: ['Statue of Liberty', 'Times Square', 'Central Park', 'Empire State', 'Broadway', 'Museums', 'Food', 'Shopping', 'Brooklyn Bridge', 'Nightlife'],
  },
  '纽约': {
    zh: ['自由女神', '时代广场', '中央公园', '帝国大厦', '百老汇', '博物馆', '美食', '购物', '布鲁克林大桥', '夜生活'],
    en: ['Statue of Liberty', 'Times Square', 'Central Park', 'Empire State', 'Broadway', 'Museums', 'Food', 'Shopping', 'Brooklyn Bridge', 'Nightlife'],
  },

  // 印尼
  'bali': {
    zh: ['海滩', '寺庙', '冲浪', '瑜伽', '潜水', '自然', '文化', '乌布', '库塔', '火山'],
    en: ['Beaches', 'Temples', 'Surfing', 'Yoga', 'Diving', 'Nature', 'Culture', 'Ubud', 'Kuta', 'Volcano'],
  },
  '巴厘岛': {
    zh: ['海滩', '寺庙', '冲浪', '瑜伽', '潜水', '自然', '文化', '乌布', '库塔', '火山'],
    en: ['Beaches', 'Temples', 'Surfing', 'Yoga', 'Diving', 'Nature', 'Culture', 'Ubud', 'Kuta', 'Volcano'],
  },

  // 马来西亚
  'kuala lumpur': {
    zh: ['双子塔', '美食', '购物', '文化', '国家清真寺', '老火车站', '茨厂街', '黑风洞', '咖啡', '夜景'],
    en: ['Petronas Towers', 'Food', 'Shopping', 'Culture', 'National Mosque', 'Old Railway', 'Chinatown', 'Batu Caves', 'Coffee', 'Night view'],
  },
  '吉隆坡': {
    zh: ['双子塔', '美食', '购物', '文化', '国家清真寺', '老火车站', '茨厂街', '黑风洞', '咖啡', '夜景'],
    en: ['Petronas Towers', 'Food', 'Shopping', 'Culture', 'National Mosque', 'Old Railway', 'Chinatown', 'Batu Caves', 'Coffee', 'Night view'],
  },

  // 越南
  'hanoi': {
    zh: ['还剑湖', '老城区', '河内大教堂', '越南菜', '咖啡', '文化', '历史', '水上木偶', '夜市', '美食'],
    en: ['Hoan Kiem Lake', 'Old Quarter', 'St. Joseph Cathedral', 'Vietnamese food', 'Coffee', 'Culture', 'History', 'Water puppetry', 'Night market', 'Food'],
  },
  '河内': {
    zh: ['还剑湖', '老城区', '河内大教堂', '越南菜', '咖啡', '文化', '历史', '水上木偶', '夜市', '美食'],
    en: ['Hoan Kiem Lake', 'Old Quarter', 'St. Joseph Cathedral', 'Vietnamese food', 'Coffee', 'Culture', 'History', 'Water puppetry', 'Night market', 'Food'],
  },
  'ho chi minh': {
    zh: ['统一宫', '战争遗迹博物馆', '范五老街', '美食', '咖啡', '购物', '文化', '历史', '湄公河', '夜市'],
    en: ['Independence Palace', 'War Remnants Museum', 'Pham Ngu Lao', 'Food', 'Coffee', 'Shopping', 'Culture', 'History', 'Mekong Delta', 'Night market'],
  },
  '胡志明市': {
    zh: ['统一宫', '战争遗迹博物馆', '范五老街', '美食', '咖啡', '购物', '文化', '历史', '湄公河', '夜市'],
    en: ['Independence Palace', 'War Remnants Museum', 'Pham Ngu Lao', 'Food', 'Coffee', 'Shopping', 'Culture', 'History', 'Mekong Delta', 'Night market'],
  },

  // 西班牙
  'barcelona': {
    zh: ['圣家堂', '高迪建筑', '兰布拉大道', '海鲜饭', '海滩', '艺术', '文化', '古埃尔公园', '美食', '夜生活'],
    en: ['Sagrada Familia', 'Gaudi buildings', 'La Rambla', 'Paella', 'Beaches', 'Art', 'Culture', 'Park Guell', 'Food', 'Nightlife'],
  },
  '巴塞罗那': {
    zh: ['圣家堂', '高迪建筑', '兰布拉大道', '海鲜饭', '海滩', '艺术', '文化', '古埃尔公园', '美食', '夜生活'],
    en: ['Sagrada Familia', 'Gaudi buildings', 'La Rambla', 'Paella', 'Beaches', 'Art', 'Culture', 'Park Guell', 'Food', 'Nightlife'],
  },

  // 阿联酋
  'dubai': {
    zh: ['哈利法塔', '棕榈岛', '沙漠冲沙', '购物', '奢华酒店', '美食', '文化', '迪拜购物中心', '音乐喷泉', '游艇'],
    en: ['Burj Khalifa', 'Palm Jumeirah', 'Desert safari', 'Shopping', 'Luxury hotels', 'Food', 'Culture', 'Dubai Mall', 'Fountain', 'Yacht'],
  },
  '迪拜': {
    zh: ['哈利法塔', '棕榈岛', '沙漠冲沙', '购物', '奢华酒店', '美食', '文化', '迪拜购物中心', '音乐喷泉', '游艇'],
    en: ['Burj Khalifa', 'Palm Jumeirah', 'Desert safari', 'Shopping', 'Luxury hotels', 'Food', 'Culture', 'Dubai Mall', 'Fountain', 'Yacht'],
  },

  // 土耳其
  'istanbul': {
    zh: ['圣索菲亚', '蓝色清真寺', '大巴扎', '博斯普鲁斯', '土耳其浴', '美食', '文化', '历史', '加拉塔塔', '咖啡'],
    en: ['Hagia Sophia', 'Blue Mosque', 'Grand Bazaar', 'Bosphorus', 'Turkish bath', 'Food', 'Culture', 'History', 'Galata Tower', 'Coffee'],
  },
  '伊斯坦布尔': {
    zh: ['圣索菲亚', '蓝色清真寺', '大巴扎', '博斯普鲁斯', '土耳其浴', '美食', '文化', '历史', '加拉塔塔', '咖啡'],
    en: ['Hagia Sophia', 'Blue Mosque', 'Grand Bazaar', 'Bosphorus', 'Turkish bath', 'Food', 'Culture', 'History', 'Galata Tower', 'Coffee'],
  },

  // 瑞士
  'zurich': {
    zh: ['湖景', '老城区', '购物', '巧克力', '钟表', '自然', '文化', '美食', '美术馆', '游船'],
    en: ['Lake view', 'Old Town', 'Shopping', 'Chocolate', 'Watches', 'Nature', 'Culture', 'Food', 'Art museum', 'Boat cruise'],
  },
  '苏黎世': {
    zh: ['湖景', '老城区', '购物', '巧克力', '钟表', '自然', '文化', '美食', '美术馆', '游船'],
    en: ['Lake view', 'Old Town', 'Shopping', 'Chocolate', 'Watches', 'Nature', 'Culture', 'Food', 'Art museum', 'Boat cruise'],
  },

  // 奥地利
  'vienna': {
    zh: ['美泉宫', '音乐', '艺术史博物馆', '咖啡', '文化', '历史', '金色大厅', '霍夫堡宫', '美食', '摩天轮'],
    en: ['Schoenbrunn Palace', 'Music', 'Art History Museum', 'Coffee', 'Culture', 'History', 'Musikverein', 'Hofburg', 'Food', 'Ferris wheel'],
  },
  '维也纳': {
    zh: ['美泉宫', '音乐', '艺术史博物馆', '咖啡', '文化', '历史', '金色大厅', '霍夫堡宫', '美食', '摩天轮'],
    en: ['Schoenbrunn Palace', 'Music', 'Art History Museum', 'Coffee', 'Culture', 'History', 'Musikverein', 'Hofburg', 'Food', 'Ferris wheel'],
  },

  // 捷克
  'prague': {
    zh: ['查理大桥', '布拉格城堡', '天文钟', '历史', '文化', '美食', '啤酒', '老城区', '教堂', '游船'],
    en: ['Charles Bridge', 'Prague Castle', 'Astronomical Clock', 'History', 'Culture', 'Food', 'Beer', 'Old Town', 'Churches', 'Boat cruise'],
  },
  '布拉格': {
    zh: ['查理大桥', '布拉格城堡', '天文钟', '历史', '文化', '美食', '啤酒', '老城区', '教堂', '游船'],
    en: ['Charles Bridge', 'Prague Castle', 'Astronomical Clock', 'History', 'Culture', 'Food', 'Beer', 'Old Town', 'Churches', 'Boat cruise'],
  },

  // 希腊
  'santorini': {
    zh: ['白房子', '蓝顶教堂', '日落', '海滩', '火山', '美食', '葡萄酒', '浪漫', '摄影', '游船'],
    en: ['White houses', 'Blue domes', 'Sunset', 'Beaches', 'Volcano', 'Food', 'Wine', 'Romantic', 'Photography', 'Boat tour'],
  },
  '圣托里尼': {
    zh: ['白房子', '蓝顶教堂', '日落', '海滩', '火山', '美食', '葡萄酒', '浪漫', '摄影', '游船'],
    en: ['White houses', 'Blue domes', 'Sunset', 'Beaches', 'Volcano', 'Food', 'Wine', 'Romantic', 'Photography', 'Boat tour'],
  },

  // 葡萄牙
  'lisbon': {
    zh: ['贝伦塔', '热罗尼莫斯修道院', '蛋挞', '电车', '历史', '文化', '美食', '法朵', '观景台', '海滩'],
    en: ['Belem Tower', 'Jeronimos Monastery', 'Pastel de nata', 'Trams', 'History', 'Culture', 'Food', 'Fado', 'Viewpoints', 'Beaches'],
  },
  '里斯本': {
    zh: ['贝伦塔', '热罗尼莫斯修道院', '蛋挞', '电车', '历史', '文化', '美食', '法朵', '观景台', '海滩'],
    en: ['Belem Tower', 'Jeronimos Monastery', 'Pastel de nata', 'Trams', 'History', 'Culture', 'Food', 'Fado', 'Viewpoints', 'Beaches'],
  },
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

/**
 * 从本地城市词库中查找（最稳定，秒级响应）
 */
function searchLocal(destination: string, lang: Lang): string[] | null {
  const raw = destination.trim();
  if (!raw) return null;

  const key = raw.toLowerCase();

  // 1. 精确匹配
  const exactEntry = CITY_DATABASE[key];
  if (exactEntry) {
    return exactEntry[lang];
  }

  // 2. 纯字母前缀匹配（如拼音 "beij" → beijing），长度≥3 避免误命中
  if (/^[a-z]{3,}$/.test(key)) {
    const prefixMatches = Object.keys(CITY_DATABASE)
      .filter(city => city.length > key.length && /^[a-z]+$/.test(city) && city.startsWith(key));
    if (prefixMatches.length > 0) {
      prefixMatches.sort((a, b) => a.length - b.length);
      return CITY_DATABASE[prefixMatches[0]][lang];
    }
  }

  // 3. 提取逗号前的部分（如 "Kyoto, Japan" → "kyoto"）
  const commaIndex = key.indexOf(',');
  if (commaIndex > 0) {
    const beforeComma = key.substring(0, commaIndex).trim();
    const entry = CITY_DATABASE[beforeComma];
    if (entry) return entry[lang];
  }

  // 3. 提取空格分隔的第一部分
  const spaceIndex = key.indexOf(' ');
  if (spaceIndex > 0) {
    const firstWord = key.substring(0, spaceIndex).trim();
    const entry = CITY_DATABASE[firstWord];
    if (entry) return entry[lang];
  }

  // 4. 移除常见后缀后匹配（如 "市"、"市"）
  const withoutSuffix = key.replace(/市$/g, '').trim();
  if (withoutSuffix !== key) {
    const entry = CITY_DATABASE[withoutSuffix];
    if (entry) return entry[lang];
  }

  // 5. 双向包含匹配（输入包含城市名，或城市名包含输入）
  let bestMatch: { data: { zh: string[]; en: string[] }; score: number } | null = null;
  for (const [cityName, data] of Object.entries(CITY_DATABASE)) {
    const cityLower = cityName.toLowerCase();
    let score = 0;
    // 输入包含城市名（如 "日本京都" 包含 "京都"）
    if (key.includes(cityLower)) {
      score = cityLower.length; // 城市名越长，匹配越精确
    }
    // 城市名包含输入（如输入 "京" 匹配 "京都"）
    else if (cityLower.includes(key) && key.length >= 2) {
      score = key.length * 0.8;
    }
    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { data, score };
    }
  }
  if (bestMatch) {
    return bestMatch.data[lang];
  }

  return null;
}

/**
 * Wikipedia 搜索（国际网络可用时）
 */
async function searchWikipedia(destination: string, lang: Lang): Promise<string[]> {
  const wikiLang = lang === 'zh' ? 'zh' : 'en';
  const searchTerms = lang === 'zh'
    ? [`${destination} 旅游景点`, `${destination} 美食`, `${destination} 文化`]
    : [`${destination} tourist attractions`, `${destination} food`, `${destination} culture`];

  // 三个搜索词并行请求（原先串行最坏 12s 才能回退，现整体最多约 3s）
  const settled = await Promise.allSettled(
    searchTerms.map(async (term) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const url = `https://${wikiLang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(term)}&srlimit=8&format=json&origin=*`;
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) return [] as Array<{ title: string; snippet: string }>;
        const data = await res.json();
        const results = data?.query?.search;
        return Array.isArray(results) ? results : [];
      } finally {
        clearTimeout(timeout);
      }
    })
  );

  const allTitles: string[] = [];
  const categories: string[] = [];
  const categoryLabels: Record<string, { en: string; zh: string }> = {
    temple: { en: 'Temples', zh: '寺庙' },
    museum: { en: 'Museums', zh: '博物馆' },
    park: { en: 'Parks', zh: '公园' },
    castle: { en: 'Castles', zh: '城堡' },
    beach: { en: 'Beaches', zh: '海滩' },
    restaurant: { en: 'Restaurants', zh: '餐厅' },
    hotel: { en: 'Hotels', zh: '酒店' },
    market: { en: 'Markets', zh: '市场' },
    nightlife: { en: 'Nightlife', zh: '夜生活' },
    garden: { en: 'Gardens', zh: '庭园' },
  };

  for (const outcome of settled) {
    if (outcome.status !== 'fulfilled') continue;
    {
      const results = outcome.value;
      if (Array.isArray(results)) {
        for (const item of results) {
          const title = item.title as string;
          if (title && !title.includes('List of') && !title.includes('列表') && !title.includes('Disambiguation') && !title.includes('消歧义')) {
            if (!allTitles.includes(title)) {
              allTitles.push(title);
            }
          }
          const snippet = stripHtml(item.snippet || '');
          for (const [cat, labels] of Object.entries(categoryLabels)) {
            const keywords = [cat, labels.en, labels.zh];
            if (keywords.some(k => snippet.toLowerCase().includes(k.toLowerCase()) || title.toLowerCase().includes(k.toLowerCase()))) {
              if (!categories.includes(cat)) {
                categories.push(cat);
              }
            }
          }
        }
      }
    }
  }

  const categoryKeywords = categories
    .slice(0, 4)
    .map(cat => categoryLabels[cat]?.[lang] ?? cat);

  const uniqueTitles = [...new Set(allTitles)]
    .filter(t => !t.toLowerCase().includes(destination.toLowerCase()))
    .slice(0, 4);

  return [...categoryKeywords, ...uniqueTitles];
}

export async function searchKeywords(destination: string, lang: Lang): Promise<KeywordResult> {
  if (!destination.trim()) {
    return { keywords: DEFAULT_KEYWORDS[lang], source: 'default' };
  }

  // 1. 先查本地词库（秒级响应，覆盖热门目的地）
  const localResults = searchLocal(destination, lang);
  if (localResults && localResults.length > 0) {
    return { keywords: localResults, source: 'local' };
  }

  // 2. 再尝试 Wikipedia 在线搜索（超时短，避免卡住）
  try {
    const wikiResults = await searchWikipedia(destination, lang);
    if (wikiResults.length > 0) {
      return { keywords: wikiResults, source: 'wiki' };
    }
  } catch {
    // 网络不可用，继续回退
  }

  // 3. 回退到默认关键词
  return { keywords: DEFAULT_KEYWORDS[lang], source: 'fallback' };
}
