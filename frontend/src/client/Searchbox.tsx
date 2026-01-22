import { useHistory } from 'react-router-dom';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import styled from 'styled-components';
import { filteredAnalysesQuery, geneSymbolsQuery } from './queryStates';
import { v4 as uuidv4 } from 'uuid';
import {
  analysisIdAtom,
  geneIdAtom,
  regionIdAtom,
  resultIndexAtom,
  resultLayoutAtom,
  selectedAnalyses,
} from './sharedState';
import { AnalysisMetadata, GeneSymbol } from './types';

export const SearchBarContainer = styled.div`
  display: flex;
  align-items: center;
  background-color: #e0ebf5;
  border-radius: 10px;
  padding: 8px 16px;
  width: 280px;
`;

const Input = styled.input`
  border: none;
  outline: none;
  flex-grow: 1;
  background: transparent;
  font-size: 16px;
  color: #1a1a1a;
`;

const Icon = styled.span`
  margin-right: 8px;
  color: #1a1a1a;
  cursor: pointer;
`;

const CloseIcon = styled.span`
  margin-left: auto;
  cursor: pointer;
  color: #1a1a1a;
`;

export const ModalContainer = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: #e0ebf5;
  z-index: 1000;
  width: 60vw;
  max-height: 40vh;
  overflow-y: auto;
  border: 1px solid #ddd;
  border-radius: 10px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  padding: 16px;
  color: black;
  font-size: 16px;
`;

export const CloseModalButton = styled.button`
  position: absolute;
  top: 8px;
  right: 8px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  color: #1a1a1a;
`;

const SectionTitle = styled.h3`
  margin-top: 16px;
  margin-bottom: 8px;
  color: #1a1a1a;
`;

const QueryBox = styled.div`
  display: flex;
  align-items: center;
  border: 1px solid #1a1a1a;
  border-radius: 5px;
  padding: 8px;
  margin-bottom: 16px;
  background-color: white;
`;

const Magnifier = styled.span`
  margin-right: 8px;
  color: #1a1a1a;
`;

interface SearchChoice {
  resultType: string;
  id: string;
  render_id: string;
}

interface SearchResult {
  label: string;
  value: SearchChoice;
}

export const NewSearchBar: React.FC = () => {
  const [inputValue, setInputValue] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const geneSymbols = useRecoilValue(geneSymbolsQuery);
  const analysisMetadata = useRecoilValue(filteredAnalysesQuery);
  const setGeneId = useSetRecoilState(geneIdAtom);
  const setRegionId = useSetRecoilState(regionIdAtom);
  const setAnalysisId = useSetRecoilState(analysisIdAtom);
  const setSelectedAnalyses = useSetRecoilState(selectedAnalyses);
  const setResultIndex = useSetRecoilState(resultIndexAtom);
  const setResultsLayout = useSetRecoilState(resultLayoutAtom);
  const inputRef = useRef<HTMLInputElement>(null);
  const history = useHistory();

  const focusSearchBar = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === '/') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    },
    [inputRef]
  );

  useEffect(() => {
    window.addEventListener('keydown', focusSearchBar);
    return () => {
      window.removeEventListener('keydown', focusSearchBar);
    };
  }, [focusSearchBar]);

  useEffect(() => {
    if (searchResults.length > 0) {
      setHighlightedIndex(0);
    } else {
      setHighlightedIndex(null);
    }
  }, [searchResults]);

  const searchGeneSymbols = (
    query: string,
    geneSymbols: GeneSymbol[]
  ): SearchResult[] => {
    return geneSymbols
      .filter((symbol) =>
        symbol.gene_symbol.toLowerCase().includes(query.toLowerCase())
      )
      .sort((a, b) => {
        const queryLower = query.toLowerCase();
        const aSymbol = a.gene_symbol.toLowerCase();
        const bSymbol = b.gene_symbol.toLowerCase();

        if (aSymbol.startsWith(queryLower) && !bSymbol.startsWith(queryLower)) {
          return -1;
        }
        if (!aSymbol.startsWith(queryLower) && bSymbol.startsWith(queryLower)) {
          return 1;
        }
        if (aSymbol === queryLower && bSymbol !== queryLower) {
          return -1;
        }
        if (aSymbol !== queryLower && bSymbol === queryLower) {
          return 1;
        }
        return 0;
      })
      .map((symbol) => ({
        label: symbol.gene_symbol,
        value: { resultType: 'gene', id: symbol.gene_id, render_id: symbol.gene_id },
      }));
  };

  const searchAnalysisMetadata = (
    query: string,
    analysisMetadata: AnalysisMetadata[]
  ): SearchResult[] => {
    return analysisMetadata
      .filter(
        (metadata) =>
          metadata.analysis_id.toLowerCase().includes(query.toLowerCase()) ||
          metadata.category.toLowerCase().includes(query.toLowerCase()) ||
          metadata.description.toLowerCase().includes(query.toLowerCase())
      )
      .map((metadata) => ({
        label: `${metadata.analysis_id} - ${metadata.description}`,
        value: { resultType: 'analysis', id: metadata.analysis_id, render_id: uuidv4() },
      }));
  };

  const fetchSearchResults = (query: string) => {
    const geneResults = searchGeneSymbols(query, geneSymbols.data || []);
    const analysisResults = searchAnalysisMetadata(query, analysisMetadata || []);
    setSearchResults([...geneResults, ...analysisResults]);
    setShowModal(true);
  };

  const onSelect = (searchChoice: SearchChoice) => {
    if (searchChoice.resultType === 'gene') {
      setRegionId(null);
      setGeneId(searchChoice.id);
      setResultIndex('gene-phewas');
    }
    if (searchChoice.resultType === 'analysis') {
      setAnalysisId(searchChoice.id);
      setSelectedAnalyses([]);
      setResultIndex('pheno-info');
    }
    setResultsLayout("full")
    setShowModal(false);
    setInputValue('');
    history.push('/app');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setInputValue(query);
    if (query) {
      fetchSearchResults(query);
    } else {
      setShowModal(false);
      setSearchResults([]);
    }
  };

  const handleClearInput = () => {
    setInputValue('');
    setShowModal(false);
    setSearchResults([]);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showModal) {
      if (e.key === 'Tab' && searchResults.length > 0) {
        e.preventDefault();
        setShowModal(true);
        setHighlightedIndex(0);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prevIndex) =>
          prevIndex === null || prevIndex === searchResults.length - 1
            ? 0
            : prevIndex + 1
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prevIndex) =>
          prevIndex === null || prevIndex === 0
            ? searchResults.length - 1
            : prevIndex - 1
        );
        break;
      case 'Tab':
        e.preventDefault();
        if (e.shiftKey) {
          setHighlightedIndex((prevIndex) =>
            prevIndex === null || prevIndex === 0
              ? searchResults.length - 1
              : prevIndex - 1
          );
        } else {
          setHighlightedIndex((prevIndex) =>
            prevIndex === null || prevIndex === searchResults.length - 1
              ? 0
              : prevIndex + 1
          );
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex !== null && highlightedIndex >= 0) {
          onSelect(searchResults[highlightedIndex].value);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowModal(false);
        setSearchResults([]);
        break;
      default:
        break;
    }
  };

  const geneResults = searchResults.filter(
    (result) => result.value.resultType === 'gene'
  );
  const analysisResults = searchResults.filter(
    (result) => result.value.resultType === 'analysis'
  );

  return (
    <>
      <SearchBarContainer>
        <Icon>🔍</Icon>
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search by gene or phenotype"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          aria-autocomplete="list"
          aria-expanded={showModal}
          aria-controls="search-results"
        />
        {inputValue && <CloseIcon onClick={handleClearInput}>✖</CloseIcon>}
      </SearchBarContainer>
      {showModal && (geneResults.length > 0 || analysisResults.length > 0) && (
        <ModalContainer role="dialog" aria-modal="true" id="search-results">
          <CloseModalButton onClick={() => setShowModal(false)}>✖</CloseModalButton>
          <QueryBox>
            <Magnifier>🔍</Magnifier>
            <span>{inputValue}</span>
          </QueryBox>
          {geneResults.length > 0 && (
            <>
              <SectionTitle>Genes</SectionTitle>
              {geneResults.map((result) => {
                const globalIndex = searchResults.indexOf(result);
                return (
                  <div
                    key={`gene-${result.value.render_id}`}
                    style={{
                      padding: '10px',
                      cursor: 'pointer',
                      backgroundColor:
                        highlightedIndex === globalIndex ? '#d3d3d3' : 'transparent',
                    }}
                    onClick={() => onSelect(result.value)}
                    onMouseEnter={() => setHighlightedIndex(globalIndex)}
                    role="option"
                    aria-selected={highlightedIndex === globalIndex}
                  >
                    {result.label}
                  </div>
                );
              })}
            </>
          )}
          {analysisResults.length > 0 && (
            <>
              <SectionTitle>Analyses</SectionTitle>
              {analysisResults.map((result) => {
                const globalIndex = searchResults.indexOf(result);
                return (
                  <div
                    key={`analysis-${result.value.render_id}`}
                    style={{
                      padding: '10px',
                      cursor: 'pointer',
                      backgroundColor:
                        highlightedIndex === globalIndex ? '#d3d3d3' : 'transparent',
                    }}
                    onClick={() => onSelect(result.value)}
                    onMouseEnter={() => setHighlightedIndex(globalIndex)}
                    role="option"
                    aria-selected={highlightedIndex === globalIndex}
                  >
                    {result.label}
                  </div>
                );
              })}
            </>
          )}
        </ModalContainer>
      )}
    </>
  );
};

export default NewSearchBar;

