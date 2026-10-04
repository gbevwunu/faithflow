export function CounterCards({
  present,
  notTicked,
  newcomers,
}: {
  present: number;
  notTicked: number;
  newcomers: number;
}) {
  const cards = [
    { value: present, label: "Present", valueClass: "text-success" },
    { value: notTicked, label: "Not ticked", valueClass: "text-ink" },
    { value: newcomers, label: "Newcomers today", valueClass: "text-warning" },
  ];
  return (
    <dl className="grid grid-cols-3 gap-2">
      {cards.map((card) => (
        <div
          key={card.label}
          className="flex flex-col-reverse justify-end rounded-card border border-border bg-surface px-3 py-2.5"
        >
          <dt className="text-[13px] leading-snug text-muted">{card.label}</dt>
          <dd className={`text-[22px] leading-tight font-bold tabular-nums ${card.valueClass}`}>
            {card.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
