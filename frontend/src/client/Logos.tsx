import React from 'react'
import styled from 'styled-components'
import { staticUrl } from './Query'

const Container = styled.div`
  display: flex;
  width: 100%;
  max-width: 1000px;

  margin-top: 30px;
  margin-bottom: 30px;

  flex-direction: row;
  justify-content: space-between;
  align-items: center;

  @media (max-width: 992px) {
    flex-direction: row;
    margin-top: 5px;

    img {
      margin-top: 20px;
    }
  }

  #pfizer-logo {
  }

  #broad-logo {
    max-height: 50px;
  }

  img {
    width: 20%;
    max-width: 200px;
  }
`

const Logos: React.FC = () => {
  return (
    <Container>
      <img src={`${staticUrl}/abbvie-logo.svg`} />
      <img src={`${staticUrl}/biogen-logo.svg`} />
      <img id="pfizer-logo" src={`${staticUrl}/pfizer-logo.png`} />
      <img id="broad-logo" src={`${staticUrl}/broad-logo.png`} />
    </Container>
  )
}

export default Logos
