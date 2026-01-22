import { Checkbox } from '@gnomad/ui'
import React from 'react'
import { useRecoilState, useRecoilValue, useResetRecoilState } from 'recoil'
import styled from 'styled-components'
import {
  hideGeneOptsAtom,
  phewasOptsAtom,
  regionIdAtom,
  resizableWidthAtom,
  ResultIndex,
  resultIndexAtom,
  ResultLayout,
  resultLayoutAtom,
  useGetActiveItems,
} from './sharedState'

const Container = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-evenly;
  align-items: center;
  height: 50%;
  background-color: rbg(245, 245, 245);

  margin-right: 40px;

  color: #fafafa;
  label {
    font-weight: bold;
  }

  .side-nav-button {
    display: inline-block;
    cursor: pointer;
    border: 0.1em solid black;
    padding: 0 0.2em;
    margin: 0.3em 0.3em 0.3em 0.3em;
    border-radius: 0.12em;
    box-sizing: border-box;
    text-decoration: none;
    font-size: 12px;
    font-weight: 300;
    color: #black;
    background-color: #fafafa;
    text-align: center;
    transition: all 0.2s;
    min-height: 3.5em;
    max-height: 3.5em;
    max-width: 8em;
  }
  .side-nav-button-active,
  .side-nav-button:hover {
    color: #000000;
    background-color: darkgrey;
  }

  .side-nav-button:disabled {
    opacity: 0.2;
    cursor: not-allowed;
  }
`

export const NavButtons: React.FC = () => {
  const [resultLayout, setResultLayout] = useRecoilState(resultLayoutAtom)
  const [resultIndex, setResultIndex] = useRecoilState(resultIndexAtom)
  const [hideGeneOpts, setHideGeneOpts] = useRecoilState(hideGeneOptsAtom)
  const [showPhewasControls, setShowPhewasControls] = useRecoilState(phewasOptsAtom)

  const regionId = useRecoilValue(regionIdAtom)

  const resetResizableWidth = useResetRecoilState(resizableWidthAtom)
  const { variantId } = useGetActiveItems()

  const onClickButtonResultIndex = (mode: ResultIndex) => () => {
    setResultIndex(mode)
    if (resultLayout === 'hidden') {
      resetResizableWidth()
    }
  }
  const onClickButtonResultLayout = (mode: ResultLayout) => () => {
    setResultLayout(mode)
    resetResizableWidth()
  }

  const buttonClassName = (
    buttonResultIndex: string,
    activeResultIndex: string | null | undefined
  ) => {
    return `side-nav-button  ${buttonResultIndex === activeResultIndex && 'side-nav-button-active'}`
  }

  return (
    <Container>
      {/* <label>Result view:</label> */}
      {/* <button */}
      {/*   className={buttonClassName('top-associations', resultIndex)} */}
      {/*   onClick={onClickButtonResultIndex('top-associations')} */}
      {/* > */}
      {/*   Top gene associations */}
      {/* </button> */}
      <button
        className={buttonClassName('gene-manhattan', resultIndex)}
        onClick={onClickButtonResultIndex('gene-manhattan')}
      >
        Gene manhattan
      </button>
      <button
        className={buttonClassName('variant-manhattan', resultIndex)}
        onClick={onClickButtonResultIndex('variant-manhattan')}
      >
        Variant manhattan
      </button>
      <button
        className={buttonClassName('pheno-info', resultIndex)}
        onClick={onClickButtonResultIndex('pheno-info')}
      >
        Phenotype info
      </button>
      <button
        className={buttonClassName('gene-phewas', resultIndex)}
        onClick={onClickButtonResultIndex('gene-phewas')}
      >
        Gene PheWAS
      </button>
      <button
        className={buttonClassName('locus-phewas', resultIndex)}
        onClick={onClickButtonResultIndex('locus-phewas')}
        disabled={regionId == undefined || regionId == null}
      >
        Locus PheWAS
      </button>
      <button
        className={buttonClassName('variant-phewas', resultIndex)}
        onClick={onClickButtonResultIndex('variant-phewas')}
        disabled={variantId === undefined || variantId === null}
      >
        Variant PheWAS
      </button>
      {/* <label style={{ marginLeft: 40 }}>Result pane width:</label> */}
      <button className='side-nav-button' onClick={onClickButtonResultLayout('hidden')}>
        hide
      </button>
      {/* <button className='side-nav-button' onClick={onClickButtonResultLayout('smallest')}> */}
      {/*   1/4 */}
      {/* </button> */}
      {/* <button className='side-nav-button' onClick={onClickButtonResultLayout('small')}> */}
      {/*   1/3 */}
      {/* </button> */}
      {/* <button className='side-nav-button' onClick={onClickButtonResultLayout('half')}> */}
      {/*   1/2 */}
      {/* </button> */}
      {/* <button */}
      {/*   className='side-nav-button' */}
      {/*   onClick={(e) => { */}
      {/*     e.preventDefault() */}
      {/*     onClickButtonResultLayout('large')() */}
      {/*   }} */}
      {/* > */}
      {/*   2/3 */}
      {/* </button> */}
      <button
        style={{ marginRight: 40 }}
        className='side-nav-button'
        onClick={onClickButtonResultLayout('full')}
      >
        full
      </button>
      <Checkbox
        label='Phewas options'
        checked={showPhewasControls}
        id='phewas-controls-checkbox'
        disabled={false}
        onChange={(_: any) => {
          setShowPhewasControls(!showPhewasControls)
        }}
        style={{ color: '#000' }}
      />
      <Checkbox
        label='Gene options'
        checked={!hideGeneOpts}
        id='gene-controls-checkbox'
        disabled={false}
        onChange={(_: any) => {
          setHideGeneOpts(!hideGeneOpts)
        }}
        style={{ color: '#000' }}
      />
    </Container>
  )
}
