'use client';

import { useState, useEffect, RefObject } from 'react';
import { getGridClass, calculateGridColumns } from '../constants';

interface UseResponsiveGridProps {
  containerRef: RefObject<HTMLDivElement | null>;
  itemCount: number;
}

export function useResponsiveGrid({ containerRef, itemCount }: UseResponsiveGridProps) {
  const [gridClass, setGridClass] = useState('grid-cols-3');

  useEffect(() => {
    const updateGrid = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        const columns = calculateGridColumns(itemCount, width);
        setGridClass(getGridClass(columns));
      }
    };
    
    updateGrid();
    window.addEventListener('resize', updateGrid);
    return () => window.removeEventListener('resize', updateGrid);
  }, [itemCount, containerRef]);

  return gridClass;
}
