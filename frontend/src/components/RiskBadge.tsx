import { getRiskLevel, riskConfig } from '../constants/theme'

export default function RiskBadge({ score }: { score: number }) {
  const level = getRiskLevel(score)
  const config = riskConfig[level]

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label} · {score}%
    </span>
  )
}