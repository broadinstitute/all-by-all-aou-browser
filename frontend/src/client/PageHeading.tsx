const SearchBarWrapper = styled.div`
  @media (max-width: 1400px) {
    display: none;
  }
`
import { useState } from 'react'
import styled from 'styled-components'
import { ExternalLink } from '@gnomad/ui'
import { useSetRecoilState } from 'recoil'
import { resultIndexAtom, resultLayoutAtom } from './sharedState'
import { PageHeadingRouterLink, PageHeadingExternalLink } from './UserInterface'
import { NewSearchBar } from './Searchbox'

// @ts-ignore
import AoULogo from './assets/AoU_Logo.svg'
// @ts-ignore
import NIHLogo from './assets/NIH_Logo.svg'
// @ts-ignore
import RegisterButton from './assets/register.svg'

interface PageHeadingWrapperProps {
  dropdownOpen: boolean;
}

const PageHeadingWrapper = styled.div<PageHeadingWrapperProps>`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  background-color: #262262;
  color: white;
  box-shadow: 0 4px 2px -2px gray;
  z-index: 11;
  padding: 10px 30px;

  .logos {
    display: flex;
    align-items: center;

    & > * {
      margin-right: 20px;
    }
  }

  .nav-items {
    display: flex;
    align-items: center;
    margin-left: 20px;

    /* Links Button for Mobile */
    .links-button {
      background: none;
      border: none;
      color: white;
      font-size: 22px;
      font-weight: 900;
      cursor: pointer;
      display: none;

      &:hover {
        opacity: 0.7;
      }

      @media (max-width: 1400px) {
        display: block;
      }
    }

    /* Inline Links for Desktop */
    .inline-links {
      display: flex;

      a {
        color: white;
        padding: 4px 10px;
        text-decoration: none;
        font-size: 18px;
        font-weight: 900;
        margin-right: 10px;

        &:hover {
          background-color: #3e3e7e;
        }
      }

      @media (max-width: 1400px) {
        display: none;
      }
    }

    /* Dropdown Content for Mobile */
    .dropdown-content {
      display: ${({ dropdownOpen }) => (dropdownOpen ? 'block' : 'none')};
      position: absolute;
      top: 50px; /* Adjusted to appear below the header */
      right: 0px; /* Align with padding */
      background-color: #262262;
      min-width: 160px;
      box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
      z-index: 1;

      a {
        color: white;
        padding: 12px 16px;
        text-decoration: none;
        display: block;

        &:hover {
          background-color: #3e3e7e;
        }
      }

      @media (min-width: 1400px) {
        display: none;
      }
    }
  }

  .register {
    display: flex;
    align-items: center;

    @media (max-width: 1400px) {
      display: none;
    }

    & > a {
      display: flex;
      align-items: center;
      padding: 12px 16px;

      svg, img {
        height: 32px;
        width: auto;
      }

      &:hover {
        opacity: 0.7;
      }
    }
  }

  @media (max-width: 1400px) {
    flex-direction: row;
    justify-content: space-between;
    padding: 10px 20px;

    .nav-items {
      margin-left: 0;
    }
  }
`

const LogoItem = styled.div`
  display: flex;
  align-items: center;

  & + & {
    margin-left: 20px;
    margin-right: 20px;
  }

  svg, img {
    height: 40px;
    width: auto;

    @media (max-width: 1400px) {
      height: 30px;
    }
  }
`


const PageHeading = () => {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const setResultIndex = useSetRecoilState(resultIndexAtom)
  const setResultsLayout = useSetRecoilState(resultLayoutAtom)

  const toggleDropdown = () => setDropdownOpen(!dropdownOpen)
  const closeDropdown = () => setDropdownOpen(false)

  return (
    <PageHeadingWrapper dropdownOpen={dropdownOpen}>
      <div className="logos">
        <ExternalLink href="https://www.nih.gov/">
          <LogoItem>
            <NIHLogo />
          </LogoItem>
        </ExternalLink>
        <ExternalLink href="https://allofus.nih.gov/" >
          <LogoItem>
            <AoULogo />
          </LogoItem>
        </ExternalLink>
      </div>
      <div className="nav-items">
        {/* Links Button for Mobile */}
        <button className="links-button" onClick={toggleDropdown}>
          ☰
        </button>
        {/* Inline Links for Desktop */}
        <div className="inline-links">
          <PageHeadingRouterLink to="/" onClick={closeDropdown}>
            Home
          </PageHeadingRouterLink>
          <PageHeadingRouterLink to="/about" onClick={closeDropdown}>
            About
          </PageHeadingRouterLink>
          <PageHeadingRouterLink to="/walkthrough" onClick={closeDropdown}>
            Walkthrough
          </PageHeadingRouterLink>
          <PageHeadingRouterLink to="/app" onClick={() => {
            setResultIndex('top-associations')
            setResultsLayout('half')
          }}>
            Results
          </PageHeadingRouterLink>
          <PageHeadingExternalLink href="https://support.researchallofus.org/hc/en-us" onClick={closeDropdown}>
            Support
          </PageHeadingExternalLink>
        </div>
        {/* Dropdown Content for Mobile */}
        <div className="dropdown-content">
          <PageHeadingRouterLink to="/" onClick={closeDropdown}>
            Home
          </PageHeadingRouterLink>
          <PageHeadingRouterLink to="/about" onClick={closeDropdown}>
            About
          </PageHeadingRouterLink>
          <PageHeadingRouterLink to="/walkthrough" onClick={closeDropdown}>
            Walkthrough
          </PageHeadingRouterLink>

          <PageHeadingRouterLink to="/app" onClick={() => {
            setResultIndex('top-associations')
            setResultsLayout('half')
            closeDropdown()
          }}>
            Results
          </PageHeadingRouterLink>
          <PageHeadingExternalLink href="https://support.researchallofus.org/hc/en-us" onClick={closeDropdown}>
            Support
          </PageHeadingExternalLink>
          {/* Register Link for Mobile */}
          <ExternalLink href="https://www.researchallofus.org/register">
            <RegisterButton style={{ height: 33 }} />
          </ExternalLink>
        </div>
      </div>
      <SearchBarWrapper><NewSearchBar /></SearchBarWrapper>
      {/* Register Button for Desktop */}
      <div className="register">
        <ExternalLink href="https://www.researchallofus.org/register">
          <RegisterButton />
        </ExternalLink>
      </div>
    </PageHeadingWrapper>
  )
}

export default PageHeading

