import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Dashboard from './components/Dashboard'
import Layout from './components/Layout'
import Login from './components/Login'
import Timekeeping from './components/Timekeeping'
import SettingsApps from './components/SettingsApps'
import EmployeeDirectory from './components/EmployeeDirectory'
import EmbedPage from './components/EmbedPage'
import LeaveManagement from './components/LeaveManagement'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState('settings')
  const [embedData, setEmbedData] = useState({ src: '', title: '' })

  const handleNavigate = (page, data = null) => {
    setCurrentPage(page);
    if (page === 'embed' && data) {
      setEmbedData(data);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const isGoogle = session?.user?.app_metadata?.provider === 'google'
    if (isGoogle && session?.user?.email && !session.user.email.endsWith('@nhtc.com.vn')) {
      alert('Chỉ email @nhtc.com.vn mới được phép truy cập!')
      supabase.auth.signOut()
    }
  }, [session])

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>
  }

  if (!session) {
    return <Login />
  }

  // Prevent flash of dashboard content before signout
  const isGoogle = session?.user?.app_metadata?.provider === 'google'
  if (isGoogle && !session.user.email.endsWith('@nhtc.com.vn')) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Đang kiểm tra quyền truy cập...</div>
  }

  return (
    <div className="App">
      <Layout activePage={currentPage} onNavigate={handleNavigate} session={session}>
        {currentPage === 'dashboard' && <Dashboard session={session} />}
        {currentPage === 'timekeeping' && <Timekeeping session={session} />}
        {currentPage === 'leave' && <LeaveManagement session={session} />}
        {currentPage === 'employees' && <EmployeeDirectory session={session} />}
        {/* Pass navigate to apps so they can trigger embed */}
        {currentPage === 'settings' && <SettingsApps session={session} onNavigate={handleNavigate} />}

        {currentPage === 'embed' && <EmbedPage src={embedData.src} title={embedData.title} />}
      </Layout>
    </div>
  )
}

export default App
