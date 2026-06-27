const { Solar, Lunar } = require("lunar-javascript");

const GAN_LABELS = {
  "甲": "갑목",
  "乙": "을목",
  "丙": "병화",
  "丁": "정화",
  "戊": "무토",
  "己": "기토",
  "庚": "경금",
  "辛": "신금",
  "壬": "임수",
  "癸": "계수"
};

const ZHI_LABELS = {
  "子": "자수",
  "丑": "축토",
  "寅": "인목",
  "卯": "묘목",
  "辰": "진토",
  "巳": "사화",
  "午": "오화",
  "未": "미토",
  "申": "신금",
  "酉": "유금",
  "戌": "술토",
  "亥": "해수"
};

const GAN_ELEMENTS = {
  "甲": "목",
  "乙": "목",
  "丙": "화",
  "丁": "화",
  "戊": "토",
  "己": "토",
  "庚": "금",
  "辛": "금",
  "壬": "수",
  "癸": "수"
};

const ZHI_ELEMENTS = {
  "子": "수",
  "丑": "토",
  "寅": "목",
  "卯": "목",
  "辰": "토",
  "巳": "화",
  "午": "화",
  "未": "토",
  "申": "금",
  "酉": "금",
  "戌": "토",
  "亥": "수"
};

const ELEMENT_LABELS = {
  "목": "목(木)",
  "화": "화(火)",
  "토": "토(土)",
  "금": "금(金)",
  "수": "수(水)"
};

const TEN_STAR_LABELS = {
  "比肩": "비견",
  "劫财": "겁재",
  "食神": "식신",
  "伤官": "상관",
  "偏财": "편재",
  "正财": "정재",
  "七杀": "편관",
  "正官": "정관",
  "偏印": "편인",
  "正印": "정인",
  "日主": "일간"
};

const SEASON_LABELS = {
  "孟春": "초봄",
  "仲春": "한봄",
  "季春": "늦봄",
  "孟夏": "초여름",
  "仲夏": "한여름",
  "季夏": "늦여름",
  "孟秋": "초가을",
  "仲秋": "한가을",
  "季秋": "늦가을",
  "孟冬": "초겨울",
  "仲冬": "한겨울",
  "季冬": "늦겨울"
};

const BRANCH_HOURS = {
  "子": 0,
  "丑": 2,
  "寅": 4,
  "卯": 6,
  "辰": 8,
  "巳": 10,
  "午": 12,
  "未": 14,
  "申": 16,
  "酉": 18,
  "戌": 20,
  "亥": 22
};

const BRANCH_TIME_LABELS = {
  "子": "자시",
  "丑": "축시",
  "寅": "인시",
  "卯": "묘시",
  "辰": "진시",
  "巳": "사시",
  "午": "오시",
  "未": "미시",
  "申": "신시",
  "酉": "유시",
  "戌": "술시",
  "亥": "해시"
};

const SOLAR_TERM_LABELS = {
  "立春": "입춘",
  "雨水": "우수",
  "惊蛰": "경칩",
  "春分": "춘분",
  "清明": "청명",
  "谷雨": "곡우",
  "立夏": "입하",
  "小满": "소만",
  "芒种": "망종",
  "夏至": "하지",
  "小暑": "소서",
  "大暑": "대서",
  "立秋": "입추",
  "处暑": "처서",
  "白露": "백로",
  "秋分": "추분",
  "寒露": "한로",
  "霜降": "상강",
  "立冬": "입동",
  "小雪": "소설",
  "大雪": "대설",
  "冬至": "동지",
  "小寒": "소한",
  "大寒": "대한"
};

const GENERATES = {
  "목": "화",
  "화": "토",
  "토": "금",
  "금": "수",
  "수": "목"
};

const CONTROLS = {
  "목": "토",
  "토": "수",
  "수": "화",
  "화": "금",
  "금": "목"
};

function parseDate(date) {
  if (typeof date !== "string") return null;
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3])
  };
}

function hourFromBranch(birthTime) {
  if (!birthTime || birthTime === "unknown") return { hour: 12, known: false };
  return { hour: BRANCH_HOURS[birthTime] ?? 12, known: Boolean(BRANCH_HOURS[birthTime] !== undefined) };
}

function timeLabel(birthTime) {
  if (!birthTime || birthTime === "unknown") return "";
  return BRANCH_TIME_LABELS[birthTime] || birthTime;
}

function createLunar(date, birthTime, calendarType) {
  const parsed = parseDate(date);
  if (!parsed) return null;
  const { hour } = hourFromBranch(birthTime);
  try {
    if (calendarType === "lunar") {
      return Lunar.fromYmdHms(parsed.year, parsed.month, parsed.day, hour, 0, 0);
    }
    return Solar.fromYmdHms(parsed.year, parsed.month, parsed.day, hour, 0, 0).getLunar();
  } catch {
    return null;
  }
}

function labelPair(gan, zhi) {
  return `${GAN_LABELS[gan] || gan}${ZHI_LABELS[zhi] ? ` ${ZHI_LABELS[zhi]}` : zhi}`;
}

function translateTenStar(value) {
  if (Array.isArray(value)) return value.map((item) => TEN_STAR_LABELS[item] || item).join(", ");
  return TEN_STAR_LABELS[value] || value || "";
}

function translateHiddenGan(value) {
  return Array.isArray(value) ? value.map((item) => GAN_LABELS[item] || item).join(", ") : "";
}

function pillar(label, gan, zhi, tenStarGan, tenStarZhi, hiddenGan) {
  return {
    label,
    text: `${gan}${zhi}`,
    gan,
    zhi,
    korean: labelPair(gan, zhi),
    element: `${ELEMENT_LABELS[GAN_ELEMENTS[gan]] || ""}/${ELEMENT_LABELS[ZHI_ELEMENTS[zhi]] || ""}`,
    tenStar: translateTenStar(tenStarGan),
    branchTenStars: translateTenStar(tenStarZhi),
    hiddenGan: translateHiddenGan(hiddenGan)
  };
}

function elementCounts(pillars) {
  const counts = { "목": 0, "화": 0, "토": 0, "금": 0, "수": 0 };
  pillars.forEach((item) => {
    if (!item) return;
    const ganElement = GAN_ELEMENTS[item.gan];
    const zhiElement = ZHI_ELEMENTS[item.zhi];
    if (ganElement) counts[ganElement] += 1;
    if (zhiElement) counts[zhiElement] += 1;
  });
  return counts;
}

function elementSummary(counts) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const strongest = entries.filter(([, count]) => count === entries[0][1]).map(([element]) => ELEMENT_LABELS[element]);
  const weakest = entries.filter(([, count]) => count === entries[entries.length - 1][1]).map(([element]) => ELEMENT_LABELS[element]);
  return {
    counts,
    strongest,
    weakest
  };
}

function relationBetweenElements(a, b) {
  if (!a || !b) return "정보 부족";
  if (a === b) return "같은 기운이라 공감과 경쟁심이 함께 생기기 쉬운 관계";
  if (GENERATES[a] === b) return "내 기운이 상대를 북돋우는 상생 관계";
  if (GENERATES[b] === a) return "상대 기운이 나를 북돋우는 상생 관계";
  if (CONTROLS[a] === b) return "내 기운이 상대 기운을 조절하려는 상극 관계";
  if (CONTROLS[b] === a) return "상대 기운이 내 기운을 조절하려는 상극 관계";
  return "서로 다른 리듬을 조율해야 하는 관계";
}

function safeCall(fn) {
  try {
    return fn();
  } catch {
    return "";
  }
}

function termName(term) {
  const raw = safeCall(() => term?.getName?.());
  return SOLAR_TERM_LABELS[raw] || raw;
}

function buildSajuProfile(input) {
  const lunar = createLunar(input.birthDate, input.birthTime, input.calendarType);
  if (!lunar) return null;

  const eight = lunar.getEightChar();
  const timeKnown = hourFromBranch(input.birthTime).known;
  const year = pillar("년주", eight.getYearGan(), eight.getYearZhi(), eight.getYearShiShenGan(), eight.getYearShiShenZhi(), eight.getYearHideGan());
  const month = pillar("월주", eight.getMonthGan(), eight.getMonthZhi(), eight.getMonthShiShenGan(), eight.getMonthShiShenZhi(), eight.getMonthHideGan());
  const day = pillar("일주", eight.getDayGan(), eight.getDayZhi(), eight.getDayShiShenGan(), eight.getDayShiShenZhi(), eight.getDayHideGan());
  const time = timeKnown
    ? pillar("시주", eight.getTimeGan(), eight.getTimeZhi(), eight.getTimeShiShenGan(), eight.getTimeShiShenZhi(), eight.getTimeHideGan())
    : null;
  const pillars = [year, month, day, time].filter(Boolean);
  const dayElement = GAN_ELEMENTS[day.gan];
  const summary = elementSummary(elementCounts(pillars));
  const solar = lunar.getSolar();
  const prevTerm = termName(lunar.getPrevJieQi?.());
  const nextTerm = termName(lunar.getNextJieQi?.());

  return {
    inputCalendar: input.calendarType === "lunar" ? "음력" : "양력",
    solarDate: solar?.toYmd?.() || input.birthDate,
    lunarDate: `${lunar.getYear()}년 ${Math.abs(lunar.getMonth())}월 ${lunar.getDay()}일`,
    timeKnown,
    timeNote: timeKnown ? `${timeLabel(input.birthTime)} 기준` : "태어난 시간을 몰라 시주는 해석에서 제외",
    season: SEASON_LABELS[lunar.getSeason()] || lunar.getSeason(),
    solarTerm: [prevTerm, nextTerm].filter(Boolean).join(" → "),
    dayMaster: {
      gan: day.gan,
      korean: GAN_LABELS[day.gan] || day.gan,
      element: ELEMENT_LABELS[dayElement] || dayElement
    },
    pillars,
    elementSummary: summary,
    auxiliary: {
      taiYuan: safeCall(() => eight.getTaiYuan()),
      mingGong: safeCall(() => eight.getMingGong())
    }
  };
}

function buildMatchProfile(me, partner) {
  if (!me || !partner) return null;
  const myElement = GAN_ELEMENTS[me.dayMaster.gan];
  const partnerElement = GAN_ELEMENTS[partner.dayMaster.gan];
  return {
    dayMasterRelation: relationBetweenElements(myElement, partnerElement),
    sharedStrongElements: me.elementSummary.strongest.filter((element) => partner.elementSummary.strongest.includes(element)),
    myDayMaster: me.dayMaster.korean,
    partnerDayMaster: partner.dayMaster.korean
  };
}

function formatSajuForPrompt(name, profile) {
  if (!profile) return [`${name} 원국 계산: 입력 정보 부족 또는 날짜 형식 오류`];
  const lines = [
    `${name} 원국 계산 결과:`,
    `- 기준 날짜: ${profile.inputCalendar} 입력 → 양력 ${profile.solarDate}, 음력 ${profile.lunarDate}`,
    `- 계절/절기 흐름: ${profile.season}${profile.solarTerm ? `, 절기 ${profile.solarTerm}` : ""}`,
    `- 일간: ${profile.dayMaster.korean} (${profile.dayMaster.element})`,
    `- 오행 분포: 목 ${profile.elementSummary.counts["목"]}, 화 ${profile.elementSummary.counts["화"]}, 토 ${profile.elementSummary.counts["토"]}, 금 ${profile.elementSummary.counts["금"]}, 수 ${profile.elementSummary.counts["수"]}`,
    `- 강한 기운: ${profile.elementSummary.strongest.join(", ") || "없음"}, 약한 기운: ${profile.elementSummary.weakest.join(", ") || "없음"}`,
    `- 시간 정보: ${profile.timeNote}`
  ];
  profile.pillars.forEach((item) => {
    lines.push(`- ${item.label}: ${item.text} (${item.korean}), 오행 ${item.element}, 천간 십신 ${item.tenStar}, 지지 십신 ${item.branchTenStars}, 지장간 ${item.hiddenGan}`);
  });
  if (profile.auxiliary.taiYuan || profile.auxiliary.mingGong) {
    lines.push(`- 보조 지표: 태원 ${profile.auxiliary.taiYuan || "없음"}, 명궁 ${profile.auxiliary.mingGong || "없음"}`);
  }
  return lines;
}

function formatMatchForPrompt(match) {
  if (!match) return [];
  return [
    "궁합 원국 비교:",
    `- 본인 일간: ${match.myDayMaster}`,
    `- 상대 일간: ${match.partnerDayMaster}`,
    `- 일간 관계: ${match.dayMasterRelation}`,
    `- 함께 강한 기운: ${match.sharedStrongElements.join(", ") || "뚜렷하게 겹치지 않음"}`
  ];
}

module.exports = {
  buildSajuProfile,
  buildMatchProfile,
  formatSajuForPrompt,
  formatMatchForPrompt
};
