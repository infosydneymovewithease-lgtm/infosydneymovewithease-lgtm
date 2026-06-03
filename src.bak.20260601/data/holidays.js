// NSW Public Holidays 2026
export const NSW_HOLIDAYS_2026 = [
  { date: '2026-01-01', name: "New Year's Day 元旦" },
  { date: '2026-01-26', name: "Australia Day 澳大利亚日" },
  { date: '2026-04-03', name: "Good Friday 耶稣受难日" },
  { date: '2026-04-04', name: "Easter Saturday 复活节前夕" },
  { date: '2026-04-05', name: "Easter Sunday 复活节" },
  { date: '2026-04-06', name: "Easter Monday 复活节周一" },
  { date: '2026-04-25', name: "Anzac Day 澳新军团纪念日" },
  { date: '2026-06-08', name: "King's Birthday 国王诞辰" },
  { date: '2026-08-03', name: "Bank Holiday 银行假日" },
  { date: '2026-10-05', name: "Labour Day 劳工节" },
  { date: '2026-12-25', name: "Christmas Day 圣诞节" },
  { date: '2026-12-26', name: "Boxing Day 节礼日" },
]

export function getTodayHoliday() {
  const today = new Date().toISOString().slice(0, 10)
  return NSW_HOLIDAYS_2026.find(h => h.date === today) || null
}
