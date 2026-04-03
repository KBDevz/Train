export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {Icon && <Icon size={40} className="text-muted/30 mb-4" strokeWidth={1.2} />}
      <h3 className="text-base font-semibold text-text mb-1">{title}</h3>
      {description && <p className="text-sm text-muted mb-4">{description}</p>}
      {action}
    </div>
  )
}
