import { useAuth0 } from '@auth0/auth0-react'
import { Button } from '@gnomad/ui'

const LoginButton = () => {
  const { loginWithRedirect } = useAuth0()

  return <Button onClick={() => loginWithRedirect()}>Log in to All by All</Button>
}

export default LoginButton
