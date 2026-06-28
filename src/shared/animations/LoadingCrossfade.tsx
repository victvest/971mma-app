import React from 'react';

type Props = {
  isLoaded: boolean;
  skeleton: React.ReactNode;
  children: React.ReactNode;
};

export function LoadingCrossfade({ isLoaded, skeleton, children }: Props) {
  return <>{isLoaded ? children : skeleton}</>;
}
