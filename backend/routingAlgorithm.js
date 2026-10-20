
const PRIORITY_WEIGHTS = {
  High: { workload: 0.8, specialization: 0.2 },
  Medium: { workload: 0.7, specialization: 0.3 },
  Low: { workload: 0.6, specialization: 0.4 }
}

function recommendEngineers(ticket, engineers) {
  const weights = PRIORITY_WEIGHTS[ticket.priority]

  if (!weights) {
    throw new Error('Unsupported ticket priority')
  }

  const candidates = engineers
    .filter(engineer => {
      return (
        engineer.is_available === true &&
        engineer.skills.includes(ticket.category) &&
        engineer.active_tickets < engineer.max_active_tickets
      )
    })
    .map(engineer => {
      const workloadScore =
        (1 - engineer.active_tickets /
          engineer.max_active_tickets) * 100

      // Prototype assumption: fewer listed skills
      // indicate greater category specialization.
      const specializationScore =
        100 / engineer.skills.length

      const score =
        weights.workload * workloadScore +
        weights.specialization * specializationScore

      return {
        engineer_id: engineer.id,
        name: engineer.name,
        score: Number(score.toFixed(2)),
        active_tickets: engineer.active_tickets,
        max_active_tickets: engineer.max_active_tickets,
        explanation: [
          `Matches required ${ticket.category} skill`,
          `${engineer.active_tickets} of ${engineer.max_active_tickets} slots currently used`,
          `Workload score: ${workloadScore.toFixed(1)}`,
          `Specialization score: ${specializationScore.toFixed(1)}`,
          `Priority weighting: ${ticket.priority}`
        ]
      }
    })

  candidates.sort((a, b) =>
    b.score - a.score ||
    a.engineer_id.localeCompare(b.engineer_id)
  )

  return candidates
}

module.exports = { recommendEngineers }
