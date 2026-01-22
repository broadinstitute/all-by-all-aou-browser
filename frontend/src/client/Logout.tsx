import { Button } from '@gnomad/ui'
import { useAuth0 } from '@auth0/auth0-react'

const LogoutButton = () => {
  const { logout } = useAuth0()

  return (
    <Button
      style={{ marginRight: 10 }}
      onClick={() => logout({ returnTo: window.location.origin })}
    >
      Log Out
    </Button>
  )
}

export default LogoutButton
