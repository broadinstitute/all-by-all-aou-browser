import React from 'react';
import { useRecoilState } from 'recoil';
import styled from 'styled-components';
import { selectedContigAtom } from '../sharedState';

const Select = styled.select`
  padding: 4px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #fff;
  font-size: 12px;
  cursor: pointer;

  &:hover {
    border-color: #999;
  }

  &:focus {
    outline: none;
    border-color: #666;
  }
`;

interface ChromosomeSelectorProps {
  /** Optional CSS class name */
  className?: string;
}

/**
 * Reusable chromosome selector dropdown.
 * Reads and writes to the shared `selectedContigAtom` state.
 * Value "all" represents the genome-wide view.
 */
export const ChromosomeSelector: React.FC<ChromosomeSelectorProps> = ({ className }) => {
  const [contig, setContig] = useRecoilState(selectedContigAtom);

  return (
    <Select
      value={contig}
      onChange={(e) => setContig(e.target.value)}
      className={className}
    >
      <option value="all">All Chromosomes</option>
      {[...Array(22)].map((_, i) => (
        <option key={`chr${i + 1}`} value={`chr${i + 1}`}>
          chr{i + 1}
        </option>
      ))}
      <option value="chrX">chrX</option>
      <option value="chrY">chrY</option>
    </Select>
  );
};

export default ChromosomeSelector;
