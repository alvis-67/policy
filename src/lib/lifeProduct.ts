import { supportYears, yearsUntil, type LifePlanInput } from './lifeNeed'

export interface LifePick {
  name: string
  fit: '首選' | '亦可考慮'
  reason: string
}

const YOUYUE =
  '終身人壽，槓桿較高，保障不會在 75 歲結束。與卓越終身保同一本小冊子：優越側重保障，卓越側重回報。保單貨幣是美元，不會兌換，亦不會從港幣缺口扣除。繳付期有整付、5、10、20、25 年。'

const YINGCHUAN =
  '分紅終身壽險，結構較簡單，適合財富傳承。繳付期有整付、5 年、10 年。最低名義金額 25 萬美元，不會兌換成港幣缺口。'

export function coverExtendsPast75(age: number | null, plan: LifePlanInput) {
  if (age == null) return false
  const years = [
    ...plan.members
      .filter((member) => member.monthlyCost > 0)
      .map((member) => supportYears(member.role, member.age, member.role === 'child' ? plan.childUntil : plan.parentUntil)),
    ...(plan.spouse && plan.spouse.monthlyCost > 0 ? [yearsUntil(plan.spouse.age, plan.spouse.untilAge)] : []),
  ]
  return years.some((year) => year > 0 && age + year > 75)
}

function termReason(age: number | null) {
  const term20 = age != null && age >= 16 && age <= 55
  const term10 = age != null && age >= 16 && age <= 65
  const band = term20
    ? '10 年計劃投保年齡 16 至 65 歲，20 年計劃 16 至 55 歲。'
    : term10
      ? '這位客人只適用 10 年水平保費（投保年齡 16 至 65 歲），20 年計劃只到 55 歲。'
      : '未有出生日期，投保年齡要再核對：10 年計劃 16 至 65 歲，20 年計劃 16 至 55 歲。'
  return `保障至 75 歲，首 10 年或 20 年保費維持不變，用來補港幣人壽缺口，保費通常低於終身計劃。${band}65 歲前可轉換為終身壽險。保費率表是港幣，按每 1,000 名義金額、性別、吸煙習慣和組別計算，系統未自動報價。`
}

export function suggestManulifeLife(input: { age: number | null; gap: number; coverPast75: boolean }) {
  const { age, gap, coverPast75 } = input
  const term10 = age == null || (age >= 16 && age <= 65)
  const youyue = { name: '優越終身保', fit: '亦可考慮' as const, reason: YOUYUE }
  const yingchuan = { name: '盈傳創富保障計劃3', fit: '亦可考慮' as const, reason: YINGCHUAN }

  if (age != null && age > 75) {
    return {
      lead: '這三款人壽的投保年齡大約到 75 歲。這位客人可能已經超過，請先核對最新小冊子，系統不建議。',
      picks: [] as LifePick[],
    }
  }

  if (gap <= 0) {
    return {
      lead: '港幣人壽缺口已經補上，不必為填補差額而加保。如果想做財富傳承，可以考慮下面的美元終身計劃。保費未自動計算。',
      picks: [
        { ...yingchuan, fit: '亦可考慮' as const },
        {
          name: '卓越終身保',
          fit: '亦可考慮' as const,
          reason: '同一系列裡側重回報的終身計劃，保單貨幣是美元。保障槓桿較高的是優越終身保。已上傳的保費率表標題是優越終身保，不能直接用作卓越的保費。',
        },
      ],
    }
  }

  if (age != null && age < 16) {
    return {
      lead: '精選定期壽險由 16 歲起保。終身計劃的投保年齡由 0 歲起。保費未自動計算。',
      picks: [{ ...youyue, fit: '首選' as const }, yingchuan],
    }
  }

  const preferWhole = coverPast75 || (age != null && age >= 56)
  const picks: LifePick[] = []
  if (!preferWhole) {
    picks.push({ name: '精選定期壽險', fit: '首選', reason: termReason(age) })
    picks.push(youyue, yingchuan)
  } else {
    const why = coverPast75
      ? '照顧年期會延伸到客人 75 歲之後，定期壽險屆時已經完結。'
      : '客人已 56 歲或以上，定期壽險只保到 75 歲，剩餘年期較短。'
    picks.push({ ...youyue, fit: '首選', reason: why + YOUYUE })
    picks.push(yingchuan)
    if (term10 && age != null) picks.push({ name: '精選定期壽險', fit: '亦可考慮', reason: termReason(age) })
  }

  const lead =
    age == null
      ? '按港幣人壽缺口建議。未有出生日期，投保年齡和保費都要再核對。'
      : '按港幣人壽缺口和照顧年期建議。保費仍要按年齡、性別、吸煙習慣和組別，打開保費率表核對。'

  return { lead, picks }
}

export function documentsForProduct<T extends { productName: string; fileName: string }>(name: string, docs: T[]) {
  return docs.filter((doc) => {
    const text = `${doc.productName} ${doc.fileName}`
    if (name.startsWith('精選')) return text.includes('精選')
    if (name.startsWith('盈傳')) return text.includes('盈傳')
    if (name.startsWith('卓越')) return /手冊|小冊/.test(doc.fileName) && /優越|卓越/.test(text)
    return /優越|卓越/.test(text)
  })
}
