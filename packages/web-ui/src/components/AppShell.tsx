import { useState, useEffect } from 'react'
import { useStore } from '../store'
import type { AutomationStatus } from '../lib/types'
import ChatView from './Chat/ChatView'
import JobsView from './Jobs/JobsView'
import StatusView from './Status/StatusView'
import BottomNav, { type Tab } from './Nav/BottomNav'

export default function AppShell(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<Tab>('chat')
  const rpcClient = useStore((s) => s.rpcClient)
  const setAutomationStatus = useStore((s) => s.setAutomationStatus)

  useEffect(() => {
    if (!rpcClient) return
    return rpcClient.onPush((event, data) => {
      if (event === 'automation:status') {
        setAutomationStatus(data as AutomationStatus)
      }
    })
  }, [rpcClient, setAutomationStatus])

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'chat' && <ChatView />}
        {activeTab === 'jobs' && <JobsView />}
        {activeTab === 'status' && <StatusView />}
      </div>
      <BottomNav activeTab={activeTab} onSelect={setActiveTab} />
    </div>
  )
}
