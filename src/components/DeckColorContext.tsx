'use client';

import { createContext, useContext } from 'react';

const DeckColorContext = createContext<boolean>(false); // false = 2-color, true = 4-color

export function DeckColorProvider({ fourColor, children }: { fourColor: boolean; children: React.ReactNode }) {
  return <DeckColorContext.Provider value={fourColor}>{children}</DeckColorContext.Provider>;
}

export function useFourColor(): boolean {
  return useContext(DeckColorContext);
}
