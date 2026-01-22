import { BrowserRouter as Router } from 'react-router-dom'
import { RecoilRoot } from 'recoil'
import { RecoilURLSyncJSON } from 'recoil-sync'
import styled from 'styled-components'
import { useAuth0, Auth0Provider } from '@auth0/auth0-react'

import Login from './Login'
import Logout from './Logout'
import App from './App'

const LoginPage = styled.div`
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`

const MainApp = ({ showLogout }: { showLogout: boolean }) => {
  return (
    <Router>
      <RecoilRoot>
        <RecoilURLSyncJSON location={{ part: 'queryParams', param: 'state' }}>
          <App showLogout={showLogout} />
        </RecoilURLSyncJSON>
      </RecoilRoot>
    </Router>
  )
}

const Main = () => {
  const { user, isAuthenticated, error } = useAuth0()

  const isLocalhost = window.location.hostname === 'localhost'
  const isAuthEnabled = process.env.AUTH0_ENABLE === 'true'

  const showLogout = isAuthEnabled && !isLocalhost && isAuthenticated

  if (isAuthEnabled && !isLocalhost && error) {
    return (
      <LoginPage>
        <h2 style={{ marginBottom: 20 }}>
          Your email domain {user && user.email && user.email.split('@')[1]} is
          not authorized or has not been verified.
        </h2>
        <Logout />
      </LoginPage>
    )
  }

  if (isAuthEnabled && !isLocalhost && !isAuthenticated) {
    return (
      <LoginPage>
        <Login />
      </LoginPage>
    )
  }

  return <MainApp showLogout={showLogout} />
}

const MainWithAuth = () => {
  const isAuthEnabled = process.env.AUTH0_ENABLE === 'true'

  return (
    <>
      {isAuthEnabled ? (
        <Auth0Provider
          domain={process.env.AUTH0_DOMAIN || ''}
          clientId={process.env.AUTH0_CLIENT_ID || ''}
          redirectUri={window.location.origin}
        >
          <Main />
        </Auth0Provider>
      ) : (
        <Main />
      )}
    </>
  )
}

export default MainWithAuth


