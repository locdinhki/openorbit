import { useExtGhlStore } from '../store/index'
import ContactDetail from './contacts/ContactDetail'
import OpportunityDetail from './pipeline/OpportunityDetail'

export default function GhlWorkspace(): React.JSX.Element {
  const selectedContact = useExtGhlStore((s) => s.selectedContact)
  const selectedOpportunity = useExtGhlStore((s) => s.selectedOpportunity)

  if (selectedContact) {
    return <ContactDetail />
  }

  if (selectedOpportunity) {
    return <OpportunityDetail />
  }

  return (
    <div className="flex items-center justify-center h-full text-[var(--cos-text-muted)] text-sm">
      Select a contact or opportunity to view details
    </div>
  )
}
