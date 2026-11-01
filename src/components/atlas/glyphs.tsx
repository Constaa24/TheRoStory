import React from 'react';

/** The four-pointed star that marks a timeless story, on the map and the timeline. */
export const STAR_PATH = 'M0,-10 L2.7,-2.7 L10,0 L2.7,2.7 L0,10 L-2.7,2.7 L-10,0 L-2.7,-2.7Z';

export const StarIcon: React.FC = () => (
  <svg className="at-star-ico" viewBox="-11 -11 22 22" aria-hidden="true"><path d={STAR_PATH} fill="currentColor" /></svg>
);

export const BackIcon: React.FC = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><path d="M7.5 2.5 4 6l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
);

export const CaretIcon: React.FC = () => (
  <svg className="at-caret" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>
);

export const CrossIcon: React.FC = () => (
  <svg className="at-x" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 2l6 6M8 2 2 8" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
);
