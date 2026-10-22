import type { PolicyType } from './labels'

const CATALOG: Record<string, Partial<Record<PolicyType, readonly string[]>>> = {
  '宏利 Manulife': {
    life: ['盈傳創富保障計劃3', '盈傳創富保障計劃3 - 優選版', '優越終身保', '赤霞珠終身壽險計劃2', '盈傳創富保障計劃'],
    critical: ['活耀人生危疾保PRO', '活耀人生危疾保2（加強版）', '活耀人生危疾保2', '守護無間危疾保', '守護無間危疾保（保寶未來）', '宏健守護危疾入息保障'],
    medical: ['宏利晉悅自願醫保靈活計劃', '宏利全護航自願醫保靈活計劃', '倍康醫療加保計劃'],
    accident: ['相伴無憂個人意外保險計劃'],
    savings: ['宏摯傳承保障計劃', '宏摯家傳承保險計劃', '宏浚傳承保障計劃', '世紀傳承保障計劃', '財摯宏耀保險計劃'],
    annuity: ['宏瑞終身即期年金保險計劃', '靈活自在年金計劃'],
  },
  '友邦 AIA': {
    life: ['「簡愛・延續」保障計劃', '樂怡人生保障計劃', '充裕未來盈尚'],
    critical: ['「愛伴航」保險計劃', '加裕智倍保', '多重智倍保'],
    medical: ['至尊醫療計劃', '自願醫保尊尚計劃', '自願醫保靈活計劃'],
    savings: ['盈御多元貨幣計劃', '充裕未來盈尚', '充裕未來'],
  },
  '保誠 Prudential': {
    life: ['「美好人生」保障計劃'],
    critical: ['危疾首護保', '「誠保一生」危疾保', '守護健康危疾保'],
    medical: ['自主健康醫保計劃', '更美好醫療計劃'],
    savings: ['「雋富」多元貨幣計劃', '特級「雋陞」儲蓄保障計劃'],
  },
  '安盛 AXA': {
    life: ['摯愛保'],
    critical: ['愛唯守危疾保障'],
    medical: ['真智惠保', '安盛自願醫保靈活計劃'],
    savings: ['盛利儲蓄計劃'],
  },
  '富衛 FWD': {
    life: ['自主保', '衛一保險計劃'],
    critical: ['危疾晉御保'],
    medical: ['富衛自願醫保靈活計劃'],
    savings: ['盈聚天下壽險計劃'],
  },
  '永明金融 Sun Life': {
    life: ['永明彩虹終身壽險'],
    savings: ['萬年青・星河尊享計劃', '永越多元貨幣計劃'],
  },
  '滙豐保險 HSBC Life': {
    critical: ['病愈保'],
    medical: ['滙豐自願醫保靈活計劃'],
    savings: ['滙溢保險計劃'],
    annuity: ['聚富入息保險計劃'],
  },
  '中銀人壽 BOC Life': {
    critical: ['摯守護危疾保險計劃'],
    medical: ['中銀人壽自願醫保靈活計劃'],
    savings: ['鑄富世代環球終身壽險計劃'],
    annuity: ['中銀人壽延期年金計劃'],
  },
  '中國人壽 China Life': {
    savings: ['豐饒傳承儲蓄保險計劃'],
    annuity: ['優暇人生延期年金計劃'],
  },
  '周大福人壽 CTF Life': {
    critical: ['危疾全攻略'],
    savings: ['「匠心・傳承」儲蓄壽險計劃', '「晉裕傳承」儲蓄壽險計劃', '富緻128'],
  },
  '萬通保險 YF Life': {
    savings: ['富饒千秋儲蓄計劃', '富饒傳承儲蓄計劃'],
  },
  '保柏 Bupa': {
    medical: ['非凡自願醫保', '全保醫療'],
  },
  '藍十字 Blue Cross': {
    medical: ['藍十字自願醫保'],
  },
  '信諾 Cigna': {
    medical: ['信諾自願醫保靈活計劃'],
  },
}

export function catalogProducts(insurer: string, policyType: string): string[] {
  if (!insurer || !policyType) return []
  const list = CATALOG[insurer]?.[policyType as PolicyType]
  return list ? [...list] : []
}
