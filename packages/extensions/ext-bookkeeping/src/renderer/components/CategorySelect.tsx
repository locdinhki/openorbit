interface Category {
  id: string
  name: string
  type: string
  parent_id: string | null
}

interface Props {
  categories: Category[]
  value: string | null
  onChange: (categoryId: string | null) => void
  transactionAmount?: number
}

export default function CategorySelect({
  categories,
  value,
  onChange,
  transactionAmount = 0
}: Props): React.JSX.Element {
  // Filter to show appropriate categories based on transaction type
  const isExpense = transactionAmount < 0
  const relevantCategories = categories.filter((c) =>
    isExpense ? c.type === 'expense' : c.type === 'income'
  )

  // Build hierarchical options
  const rootCategories = relevantCategories.filter((c) => !c.parent_id)
  const childMap = new Map<string, Category[]>()
  for (const cat of relevantCategories) {
    if (cat.parent_id) {
      const children = childMap.get(cat.parent_id) ?? []
      children.push(cat)
      childMap.set(cat.parent_id, children)
    }
  }

  const buildOptions = (cats: Category[], level = 0): React.JSX.Element[] => {
    const options: React.JSX.Element[] = []
    for (const cat of cats) {
      const prefix = level > 0 ? '└ '.padStart(level * 2 + 2, ' ') : ''
      options.push(
        <option key={cat.id} value={cat.id}>
          {prefix}
          {cat.name}
        </option>
      )
      const children = childMap.get(cat.id)
      if (children) {
        options.push(...buildOptions(children, level + 1))
      }
    }
    return options
  }

  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className={`px-2 py-1 text-xs rounded border cursor-pointer focus:outline-none focus:border-indigo-500 ${
        value
          ? 'bg-[var(--cos-bg-primary)] border-[var(--cos-border)] text-[var(--cos-text-primary)]'
          : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
      }`}
    >
      <option value="">Uncategorized</option>
      <optgroup label={isExpense ? 'Expenses' : 'Income'}>{buildOptions(rootCategories)}</optgroup>
    </select>
  )
}
